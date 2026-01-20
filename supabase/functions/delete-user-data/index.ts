// Supabase Edge Function: delete-user-data
// Deploy: supabase functions deploy delete-user-data
//
// Purpose
// - GDPR-safe teardown for a user: deletes all their rows across tables
// - Optionally also deletes the Supabase Auth user (requires Admin API; optional)
//
// Modes
// - User mode: Authorization Bearer JWT (deletes ONLY caller’s data)
// - Service mode: x-sync-secret + body.userId (admin/ops)
//
// Request body
// {
//   "userId": "uuid",          // service mode only
//   "deleteAuthUser": false    // optional; default false
// }
//
// Required env vars:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - SUPABASE_ANON_KEY
// - SYNC_SECRET
//
// Optional env vars (only needed if deleteAuthUser=true)
// - SUPABASE_AUTH_ADMIN_URL       (defaults to `${SUPABASE_URL}/auth/v1`)
// - SUPABASE_SERVICE_ROLE_KEY     (already required)
//
// IMPORTANT
// - If you have FK constraints with ON DELETE CASCADE, you can simplify this.
// - This function deletes child tables first to avoid FK errors.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string, required = true): string {
  const v = Deno.env.get(name);
  if (!v && required) throw new Error(`Missing env var: ${name}`);
  return v ?? "";
}

async function getUserIdFromJwt(opts: {
  supabaseUrl: string;
  anonKey: string;
  jwt: string;
}): Promise<string> {
  const supabaseUser = createClient(opts.supabaseUrl, opts.anonKey, {
    global: { headers: { Authorization: `Bearer ${opts.jwt}` } },
    auth: { persistSession: false },
  });

  const { data, error } = await supabaseUser.auth.getUser();
  if (error || !data?.user?.id) throw new Error("Invalid user token");
  return data.user.id;
}

async function deleteWhere(
  supabaseAdmin: any,
  table: string,
  match: Record<string, any>,
): Promise<number> {
  // PostgREST delete doesn’t reliably return counts unless you select; use select minimal.
  const { data, error } = await supabaseAdmin.from(table).delete().match(match).select("id");
  if (error) throw new Error(`Delete failed on ${table}: ${error.message}`);
  return Array.isArray(data) ? data.length : 0;
}

async function adminDeleteAuthUser(opts: {
  supabaseUrl: string;
  serviceRoleKey: string;
  userId: string;
}): Promise<void> {
  // Supabase Auth Admin API:
  // DELETE /admin/users/{userId}
  const authAdminUrl =
    Deno.env.get("SUPABASE_AUTH_ADMIN_URL") ??
    `${opts.supabaseUrl.replace(/\/+$/, "")}/auth/v1`;

  const url = `${authAdminUrl.replace(/\/+$/, "")}/admin/users/${encodeURIComponent(opts.userId)}`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${opts.serviceRoleKey}`,
      apikey: opts.serviceRoleKey,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Auth user delete failed: ${res.status} ${text.slice(0, 300)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = getEnv("SUPABASE_URL");
    const SERVICE_ROLE = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY = getEnv("SUPABASE_ANON_KEY");
    const SYNC_SECRET = getEnv("SYNC_SECRET");

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));

    const syncSecretHeader = req.headers.get("x-sync-secret");
    const isServiceMode = syncSecretHeader && syncSecretHeader === SYNC_SECRET;

    let userId: string | null = null;

    if (isServiceMode) {
      userId = typeof body?.userId === "string" ? body.userId : null;
      if (!userId) return jsonResponse({ ok: false, error: "Missing userId (service mode)" }, 400);
    } else {
      const authHeader = req.headers.get("authorization") ?? "";
      const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!jwt) return jsonResponse({ ok: false, error: "Missing Authorization bearer token" }, 401);
      userId = await getUserIdFromJwt({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, jwt });
    }

    const deleteAuthUser = body?.deleteAuthUser === true;

    // Order matters if you have FKs without CASCADE.
    // Child tables first:
    const counts: Record<string, number> = {};

    // Workout children
    counts.workout_hr_series = await deleteWhere(supabaseAdmin, "workout_hr_series", { user_id: userId });
    counts.workout_hr_zones = await deleteWhere(supabaseAdmin, "workout_hr_zones", { user_id: userId });

    // Sleep children
    counts.sleep_hr_series = await deleteWhere(supabaseAdmin, "sleep_hr_series", { user_id: userId });
    counts.sleep_stages = await deleteWhere(supabaseAdmin, "sleep_stages", { user_id: userId });

    // Intra-day points
    counts.intra_day_metrics = await deleteWhere(supabaseAdmin, "intra_day_metrics", { user_id: userId });

    // Core records
    counts.workouts = await deleteWhere(supabaseAdmin, "workouts", { user_id: userId });
    counts.sleep_sessions = await deleteWhere(supabaseAdmin, "sleep_sessions", { user_id: userId });

    // Aggregates
    counts.daily_metrics = await deleteWhere(supabaseAdmin, "daily_metrics", { user_id: userId });
    counts.baselines_28d = await deleteWhere(supabaseAdmin, "baselines_28d", { user_id: userId });

    // Connection + config
    counts.polar_connections = await deleteWhere(supabaseAdmin, "polar_connections", { user_id: userId });
    counts.app_config = await deleteWhere(supabaseAdmin, "app_config", { user_id: userId });

    // Optional: also delete the auth user
    if (deleteAuthUser) {
      await adminDeleteAuthUser({ supabaseUrl: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE, userId });
    }

    return jsonResponse({
      ok: true,
      userId,
      deleted: counts,
      authUserDeleted: deleteAuthUser,
      note:
        "If any table names differ in your schema, adjust the list. If you add new user-owned tables later, include them here too.",
    });
  } catch (e) {
    return jsonResponse(
      { ok: false, error: (e as Error)?.message ?? String(e) },
      500,
    );
  }
});