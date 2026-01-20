// Supabase Edge Function: nightly-recompute
// Deploy: supabase functions deploy nightly-recompute
//
// Purpose
// - Nightly cron job to keep data correct when Polar updates arrive late
// - For each connected user, recompute the last N days via post-sync-orchestrator
// - Also refreshes baselines for today
//
// Recommended schedule (Supabase Scheduled Functions):
// - Daily at 02:00 UTC
//
// Request
// - Typically called without auth from scheduler using x-sync-secret
// - Body optional: { "recomputeLastDays": 5, "onlyActive": true }
//
// Required env vars:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - SYNC_SECRET
//
// Optional env vars:
// - POST_SYNC_ORCHESTRATOR_URL
// - RECOMPUTE_LAST_DAYS_DEFAULT     (default 5)
// - MAX_USERS_PER_RUN               (default 500) safety limit
//
// Notes
// - Uses service role to list users from polar_connections
// - Calls post-sync-orchestrator in service mode per user
// - Soft-fails per user (continues processing)

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

function toIsoDateUTC(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

function addDays(dateIso: string, deltaDays: number): string {
  const dt = new Date(`${dateIso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return toIsoDateUTC(dt);
}

async function callOrchestrator(opts: {
  url: string;
  syncSecret: string;
  userId: string;
  recomputeLastDays: number;
}): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch(opts.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-secret": opts.syncSecret,
    },
    body: JSON.stringify({
      userId: opts.userId,
      recomputeLastDays: opts.recomputeLastDays,
      computeBaselines: true,
    }),
  });

  const json = await res.json().catch(() => ({}));
  const ok = res.ok && (json?.ok ?? true);
  return { ok, status: res.status, json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = getEnv("SUPABASE_URL");
    const SERVICE_ROLE = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const SYNC_SECRET = getEnv("SYNC_SECRET");

    const POST_SYNC_ORCHESTRATOR_URL =
      Deno.env.get("POST_SYNC_ORCHESTRATOR_URL") ??
      `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/post-sync-orchestrator`;

    const DEFAULT_DAYS = Number(Deno.env.get("RECOMPUTE_LAST_DAYS_DEFAULT") ?? "5");
    const MAX_USERS = Number(Deno.env.get("MAX_USERS_PER_RUN") ?? "500");

    const body = await req.json().catch(() => ({}));
    const recomputeLastDays =
      Number.isFinite(Number(body?.recomputeLastDays))
        ? Math.max(1, Math.min(14, Number(body.recomputeLastDays)))
        : Math.max(1, Math.min(14, DEFAULT_DAYS));

    const onlyActive = body?.onlyActive !== false; // default true

    // Require service mode secret (cron should send this)
    const syncSecretHeader = req.headers.get("x-sync-secret");
    if (!syncSecretHeader || syncSecretHeader !== SYNC_SECRET) {
      return jsonResponse({ ok: false, error: "Unauthorized (missing/invalid x-sync-secret)" }, 401);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Pull connected users
    // active definition: has refresh_token and (optionally) not revoked (if you add a status column)
    let query = supabaseAdmin
      .from("polar_connections")
      .select("user_id, refresh_token, access_token, expires_at, last_synced_at")
      .not("refresh_token", "is", null);

    if (onlyActive) {
      // If you add a status column later, update this filter.
      // For now: treat presence of refresh_token as active.
    }

    const { data, error } = await query.limit(MAX_USERS);
    if (error) throw error;

    const userIds = (data ?? []).map((r) => r.user_id).filter(Boolean);

    // Recompute date range summary (for logging only)
    const today = toIsoDateUTC(new Date());
    const start = addDays(today, -(recomputeLastDays - 1));

    const results: Array<{
      userId: string;
      ok: boolean;
      status: number;
      failures?: any[];
    }> = [];

    let okCount = 0;
    let failCount = 0;

    for (const uid of userIds) {
      try {
        const r = await callOrchestrator({
          url: POST_SYNC_ORCHESTRATOR_URL,
          syncSecret: SYNC_SECRET,
          userId: uid,
          recomputeLastDays,
        });

        if (r.ok) okCount++;
        else failCount++;

        results.push({
          userId: uid,
          ok: r.ok,
          status: r.status,
          failures: r.json?.failures ?? undefined,
        });
      } catch (e: any) {
        failCount++;
        results.push({
          userId: uid,
          ok: false,
          status: 0,
          failures: [{ step: "orchestrator_call", error: e?.message ?? String(e) }],
        });
      }
    }

    return jsonResponse({
      ok: failCount === 0,
      usersProcessed: userIds.length,
      okCount,
      failCount,
      recomputeLastDays,
      window: { startDate: start, endDate: today },
      // Keep result payload modest. If you want full per-user logs, store them in a table instead.
      results: results.slice(0, 50),
      note:
        "If you have more than MAX_USERS_PER_RUN, increase it or paginate. For full observability, add a sync_jobs table and insert per-user results.",
    });
  } catch (e) {
    return jsonResponse(
      { ok: false, error: (e as Error)?.message ?? String(e) },
      500,
    );
  }
});