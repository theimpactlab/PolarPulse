// Supabase Edge Function: polar-disconnect
// Deploy with: supabase functions deploy polar-disconnect
//
// Deno runtime

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Supabase not configured" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Expect { user_id }
    let bodyUserId: string | null = null;
    try {
      const body = await req.json();
      bodyUserId = body?.user_id ?? null;
    } catch {
      // ignore
    }

    if (!bodyUserId) return jsonResponse({ error: "Missing user_id" }, 400);

    const { error: delErr } = await supabase
      .from("oauth_tokens")
      .delete()
      .eq("user_id", bodyUserId)
      .eq("provider", "polar");

    if (delErr) return jsonResponse({ error: delErr.message }, 500);

    // Optional: update profile if these columns exist
    await supabase
      .from("profiles")
      .update({
        polar_connected_at: null,
        polar_remote_user_id: null,
      })
      .eq("id", bodyUserId);

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

export {};