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
  x_user_id?: string; // Polar Remote user id (string)
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
    else if (error) url.searchParams.set("error", error);
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

    // 1) Exchange code for Polar Remote tokens
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

    // 2) Register with Polar AccessLink to get numeric user-id
    // IMPORTANT: without this, /v3/users/{id}/exercise-transactions will 404
    let polarUserId: number | null = null;
    let polarUserResourceUri: string | null = null;

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
        const uri = regJson?.["resource-uri"];

        if (typeof direct === "number") polarUserId = direct;

        if (typeof uri === "string") {
          polarUserResourceUri = uri;
          if (!polarUserId) {
            const match = uri.match(/\/v3\/users\/(\d+)/);
            if (match) polarUserId = Number(match[1]);
          }
        }
      } catch {
        // ignore parse errors
      }
    } else {
      // If already registered, Polar often returns 409 conflict.
      // In that case, you STILL need the numeric id to sync.
      // Best approach: treat 409 as "already registered" and ask the user to reconnect only after we add a lookup.
      console.error("AccessLink registration failed:", regRes.status, regBodyText);

      // If it's a 409 conflict, we can’t derive user-id from response reliably.
      // We still store tokens so the user can retry once we implement a lookup method if needed.
      if (regRes.status === 409) {
        // Keep going, but we will return an error redirect because sync will fail without polarUserId
      }
    }

    // 3) Save tokens + ids to Supabase
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const upsertPayload: Record<string, unknown> = {
      user_id: userId,
      provider: "polar",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      polar_user_id: polarUserId,
      polar_user_resource_uri: polarUserResourceUri,
      polar_remote_user_id: tokens.x_user_id ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await supabase
      .from("oauth_tokens")
      .upsert(upsertPayload, { onConflict: "user_id,provider" });

    if (upsertErr) {
      console.error("oauth_tokens upsert failed:", upsertErr);
      return Response.redirect(getRedirectUrl(stateData, false, "token_store_failed"));
    }

    // Optional: keep profile info too (only if these columns exist)
    // If your profiles table doesn't have these fields, remove this block.
    await supabase
      .from("profiles")
      .update({
        polar_connected_at: new Date().toISOString(),
        polar_remote_user_id: tokens.x_user_id ?? null,
      })
      .eq("id", userId);

    // If we failed to obtain AccessLink numeric user id, syncing will fail
    if (!polarUserId) {
      return Response.redirect(getRedirectUrl(stateData, false, "accesslink_register_failed"));
    }

    return Response.redirect(getRedirectUrl(stateData, true));
  } catch (err) {
    console.error("Callback error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

export {};