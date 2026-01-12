// Supabase Edge Function: polar-auth
// Deploy with: supabase functions deploy polar-auth
//
// This initiates the OAuth flow by redirecting to Polar's authorization page
// It uses Deno runtime which is not compatible with local TS checks

/*
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    const redirectUrl = url.searchParams.get("redirect_url"); // Web app URL to redirect back to

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("POLAR_CLIENT_ID");
    if (!clientId) {
      return new Response(JSON.stringify({ error: "Polar not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build Polar OAuth URL
    const callbackUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/polar-callback`;

    // Encode both user_id and redirect_url in the state parameter
    // Format: userId|redirectUrl (URL encoded)
    const state = redirectUrl
      ? `${userId}|${encodeURIComponent(redirectUrl)}`
      : userId;

    const polarAuthUrl = new URL("https://flow.polar.com/oauth2/authorization");
    polarAuthUrl.searchParams.set("response_type", "code");
    polarAuthUrl.searchParams.set("client_id", clientId);
    polarAuthUrl.searchParams.set("redirect_uri", callbackUri);
    polarAuthUrl.searchParams.set("state", state);
    polarAuthUrl.searchParams.set("scope", "accesslink.read_all");

    // Redirect to Polar's authorization page
    return Response.redirect(polarAuthUrl.toString(), 302);

  } catch (error) {
    console.error("Auth error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
*/

export {};
