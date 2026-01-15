// supabase/functions/disconnect-polar/index.ts
// Supabase Edge Function: disconnect-polar
// Deploy with: supabase functions deploy disconnect-polar
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
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ success: false, error: "Supabase not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let userId: string | null = null;
    try {
      const body = await req.json();
      userId = body?.user_id ?? null;
    } catch {
      userId = null;
    }

    if (!userId) return jsonResponse({ success: false, error: "Missing user_id" }, 400);

    // Delete tokens
    const { error: delErr } = await supabase
      .from("oauth_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("provider", "polar");

    if (delErr) return jsonResponse({ success: false, error: delErr.message }, 500);

    // Optional: mark profile disconnected (only if these columns exist in your profiles table)
    await supabase
      .from("profiles")
      .update({
        polar_connected_at: null,
      })
      .eq("id", userId);

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

export {};