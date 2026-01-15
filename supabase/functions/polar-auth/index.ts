// Supabase Edge Function: polar-auth
// Deploy with: supabase functions deploy polar-auth
//
// Initiates the OAuth flow by redirecting to Polar's authorization page
// Deno runtime

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    const redirectUrl = url.searchParams.get("redirect_url"); // Web app URL to redirect back to

    if (!userId) return jsonResponse({ error: "Missing user_id" }, 400);

    const clientId = Deno.env.get("POLAR_CLIENT_ID") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    if (!clientId) return jsonResponse({ error: "Polar not configured" }, 500);
    if (!supabaseUrl) return jsonResponse({ error: "Supabase not configured" }, 500);

    // Callback must match the one used in polar-callback token exchange
    const callbackUri = `${supabaseUrl}/functions/v1/polar-callback`;

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
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

export {};