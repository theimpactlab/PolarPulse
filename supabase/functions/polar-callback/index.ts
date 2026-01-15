// Supabase Edge Function: polar-callback
// Deploy with: supabase functions deploy polar-callback
//
// Deno runtime

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

interface PolarTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  x_user_id?: string; // Polar Remote user id (not AccessLink numeric id)
}

function parseState(state: string): { userId: string; redirectUrl?: string } {
  if (state.includes("|")) {
    const [userId, encodedRedirectUrl] = state.split("|");
    return { userId, redirectUrl: decodeURIComponent(encodedRedirectUrl) };
  }
  return { userId: state };
}

function getRedirectUrl(
  stateData: { userId: string; redirectUrl?: string },
  success: boolean,
  error?: string
): string {
  if (stateData.redirectUrl) {
    const url = new URL(stateData.redirectUrl);
    if (success) url.searchParams.set("polar", "connected");
    else url.searchParams.set("error", error || "unknown");
    return url.toString();
  }

  const appUrl = Deno.env.get("APP_URL") || "polarfitness://";
  if (success) return `${appUrl}/settings?polar=connected`;
  return `${appUrl}/settings?error=${error || "unknown"}`;
}

async function readTextSafe(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const stateData = state ? parseState(state) : { userId: "" };

    if (error) return Response.redirect(getRedirectUrl(stateData, false, "oauth_denied"));
    if (!code || !state) return jsonResponse({ error: "Missing code or state" }, 400);

    const userId = stateData.userId;

    const clientId = Deno.env.get("POLAR_CLIENT_ID") ?? "";
    const clientSecret = Deno.env.get("POLAR_CLIENT_SECRET") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!clientId || !clientSecret) return jsonResponse({ error: "Polar not configured" }, 500);
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Supabase not configured" }, 500);

    // 1) Exchange code for tokens (Polar Remote OAuth)
    const tokenResponse = await fetch("https://polarremote.com/v2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${supabaseUrl}/functions/v1/polar-callback`,
      }),
    });

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", await readTextSafe(tokenResponse));
      return Response.redirect(getRedirectUrl(stateData, false, "token_exchange"));
    }

    const tokens: PolarTokens = await tokenResponse.json();

    if (!tokens.access_token || !tokens.expires_in) {
      console.error("Token exchange returned incomplete token set");
      return Response.redirect(getRedirectUrl(stateData, false, "token_exchange"));
    }

    // 2) Register user with Polar AccessLink to get numeric AccessLink user-id
    // This is the key that must be used for /v3/users/{id}/... calls
    let accesslinkUserId: number | null = null;

    const regRes = await fetch("https://www.polaraccesslink.com/v3/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ "member-id": userId }),
    });

    const regBodyText = await readTextSafe(regRes);

    if (regRes.ok) {
      try {
        const regJson = JSON.parse(regBodyText);
        const direct = regJson?.["user-id"];
        if (typeof direct === "number") {
          accesslinkUserId = direct;
        } else {
          const uri = regJson?.["resource-uri"];
          const match = typeof uri === "string" ? uri.match(/\/v3\/users\/(\d+)/) : null;
          if (match) accesslinkUserId = Number(match[1]);
        }
      } catch {
        // ignore parse fail
      }
    } else {
      console.error("AccessLink registration failed:", regRes.status, regBodyText);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 3) Save tokens
    await supabase.from("oauth_tokens").upsert(
      {
        user_id: userId,
        provider: "polar",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );

    // 4) Save AccessLink numeric id into profiles.polar_user_id (as text)
    // Your schema has polar_user_id text unique, so store it as String(...)
    await supabase
      .from("profiles")
      .update({
        polar_user_id: accesslinkUserId ? String(accesslinkUserId) : null,
        polar_connected_at: accesslinkUserId ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (!accesslinkUserId) {
      return Response.redirect(getRedirectUrl(stateData, false, "accesslink_register_failed"));
    }

    return Response.redirect(getRedirectUrl(stateData, true));
  } catch (err) {
    console.error("Callback error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

export {};