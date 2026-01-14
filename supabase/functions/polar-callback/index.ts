// Supabase Edge Function: polar-callback
// Deploy with: supabase functions deploy polar-callback
//
// Deno runtime

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PolarTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  x_user_id: string;
}

// Parse the state parameter to extract userId and optional redirectUrl
function parseState(state: string): { userId: string; redirectUrl?: string } {
  if (state.includes("|")) {
    const [userId, encodedRedirectUrl] = state.split("|");
    return {
      userId,
      redirectUrl: decodeURIComponent(encodedRedirectUrl),
    };
  }
  return { userId: state };
}

// Get the appropriate redirect URL based on state
function getRedirectUrl(
  stateData: { userId: string; redirectUrl?: string },
  success: boolean,
  error?: string
): string {
  if (stateData.redirectUrl) {
    const url = new URL(stateData.redirectUrl);
    if (success) {
      url.searchParams.set("polar", "connected");
    } else if (error) {
      url.searchParams.set("error", error);
    }
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const stateData = state ? parseState(state) : { userId: "" };

    if (error) {
      return Response.redirect(getRedirectUrl(stateData, false, "oauth_denied"));
    }

    if (!code || !state) {
      return new Response(JSON.stringify({ error: "Missing code or state" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = stateData.userId;

    const clientId = Deno.env.get("POLAR_CLIENT_ID") ?? "";
    const clientSecret = Deno.env.get("POLAR_CLIENT_SECRET") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Polar not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Supabase not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange code for tokens
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

    // Register user with Polar AccessLink (IMPORTANT: check HTTP status)
    try {
      const regRes = await fetch("https://www.polaraccesslink.com/v3/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ "member-id": userId }),
      });

      // Polar often returns "already exists" style responses depending on state.
      // Accept common non-fatal statuses (409 conflict is typical for already-registered).
      if (!regRes.ok && regRes.status !== 409) {
        const regBody = await readTextSafe(regRes);
        console.error("Polar registration failed:", regRes.status, regBody);
        // We still continue so the user can retry sync, but we record the problem.
      }
    } catch (e) {
      console.error("Polar registration network error:", e);
    }

    // Save to Supabase
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    await supabase.from("oauth_tokens").upsert(
      {
        user_id: userId,
        provider: "polar",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      },
      { onConflict: "user_id,provider" }
    );

    await supabase
      .from("profiles")
      .update({
        polar_user_id: tokens.x_user_id,
        polar_connected_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return Response.redirect(getRedirectUrl(stateData, true));
  } catch (err) {
    console.error("Callback error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export {};