// Supabase Edge Function: polar-callback
// Deploy with: supabase functions deploy polar-callback
//
// This file is for reference - deploy to Supabase Edge Functions
// It uses Deno runtime which is not compatible with local TS checks

/*
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
  if (state.includes('|')) {
    const [userId, encodedRedirectUrl] = state.split('|');
    return {
      userId,
      redirectUrl: decodeURIComponent(encodedRedirectUrl),
    };
  }
  return { userId: state };
}

// Get the appropriate redirect URL based on state
function getRedirectUrl(stateData: { userId: string; redirectUrl?: string }, success: boolean, error?: string): string {
  // If we have a web redirect URL, use it
  if (stateData.redirectUrl) {
    const url = new URL(stateData.redirectUrl);
    if (success) {
      url.searchParams.set('polar', 'connected');
    } else if (error) {
      url.searchParams.set('error', error);
    }
    return url.toString();
  }

  // Otherwise, use the mobile app deep link
  const appUrl = Deno.env.get("APP_URL") || 'polarfitness://';
  if (success) {
    return `${appUrl}/settings?polar=connected`;
  }
  return `${appUrl}/settings?error=${error || 'unknown'}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // Contains user_id and optional redirect_url
    const error = url.searchParams.get("error");

    // Parse the state to get userId and redirectUrl
    const stateData = state ? parseState(state) : { userId: '' };

    if (error) {
      return Response.redirect(getRedirectUrl(stateData, false, 'oauth_denied'));
    }

    if (!code || !state) {
      return new Response(JSON.stringify({ error: "Missing code or state" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = stateData.userId;

    // Exchange code for tokens
    const tokenResponse = await fetch("https://polarremote.com/v2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${Deno.env.get("POLAR_CLIENT_ID")}:${Deno.env.get("POLAR_CLIENT_SECRET")}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${Deno.env.get("SUPABASE_URL")}/functions/v1/polar-callback`,
      }),
    });

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", await tokenResponse.text());
      return Response.redirect(getRedirectUrl(stateData, false, 'token_exchange'));
    }

    const tokens: PolarTokens = await tokenResponse.json();

    // Register user with Polar AccessLink
    try {
      await fetch("https://www.polaraccesslink.com/v3/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ "member-id": userId }),
      });
    } catch (regError) {
      // User might already be registered, continue anyway
      console.log("User registration note:", regError);
    }

    // Save to Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase.from("oauth_tokens").upsert({
      user_id: userId,
      provider: "polar",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }, { onConflict: "user_id,provider" });

    await supabase.from("profiles").update({
      polar_user_id: tokens.x_user_id,
      polar_connected_at: new Date().toISOString(),
    }).eq("id", userId);

    return Response.redirect(getRedirectUrl(stateData, true));

  } catch (error) {
    console.error("Callback error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
*/

export {};
