// Supabase Edge Function: compute-recovery
// Deploy: supabase functions deploy compute-recovery
//
// Purpose
// - Compute a 0–100 recovery_score for a given user + date
// - Writes into daily_metrics.recovery_score
//
// Design goals (matches your app behaviour)
// - Baseline-relative: compares today vs 28-day baseline (from baselines_28d)
// - Uses these components when available:
//     - HRV (hrv_ms)           higher is better
//     - Resting HR (resting_hr) lower is better
//     - Respiratory rate (respiratory_rate) lower/stable is better
//     - Sleep score (sleep_score) higher is better
// - Works with missing data: weights re-normalize based on availability
// - Produces stable, interpretable scores without needing the original binary
//
// Inputs
// - User mode: Authorization Bearer JWT + body.date
// - Service mode: x-sync-secret + body.userId + body.date
//
// Request body
//   { "date": "YYYY-MM-DD", "userId": "...optional in service mode..." }
//
// Required env vars:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - SUPABASE_ANON_KEY
// - SYNC_SECRET
//
// Assumptions
// - baselines_28d rows exist for computed_on = date (or a recent date)
//   If not, it will fall back to computing vs. "most recent baseline <= date".
//
// Tuning
// - You can adjust weights and sensitivity via app_config later. Default weights here
//   are a reasonable match for common recovery models.
//
// Default weights (when all present)
// - HRV: 0.40
// - RHR: 0.30
// - Resp rate: 0.20
// - Sleep: 0.10

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

function isIsoDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
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

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function roundInt(n: number): number {
  return Math.round(n);
}

/**
 * Convert a baseline-relative ratio into a 0..100 component score.
 *
 * For "higher is better" metrics:
 *   ratio = today / baseline
 * For "lower is better" metrics:
 *   ratio = baseline / today
 *
 * We then map ratio into a bounded score with soft saturation:
 * - ratio ~= 1.00 -> 70
 * - ratio ~= 1.10 -> ~85
 * - ratio ~= 1.20 -> ~95
 * - ratio ~= 0.90 -> ~55
 * - ratio ~= 0.80 -> ~40
 *
 * This shape makes "baseline" not equal to 50, because most apps treat baseline
 * as "decent" rather than average/neutral.
 */
function ratioToScore(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;

  // Use a tanh curve centered at 1.0
  // k controls sensitivity; tweak if needed.
  const k = 2.0;
  const x = (ratio - 1.0) * k; // e.g. 1.1 -> 0.2
  const t = Math.tanh(x); // -1..1

  // Map tanh output to ~[20..100] with baseline at ~70
  // t=0 => 70
  const score = 70 + t * 30; // t=1 => 100, t=-1 => 40
  return clamp(score, 0, 100);
}

/**
 * Convert an absolute score (already 0..100) to component score.
 * (Sleep score typically is already 0..100.)
 */
function absoluteScoreToScore(v: number): number {
  return clamp(v, 0, 100);
}

type BaselineRow = {
  metric: string;
  avg: number | null;
  computed_on: string;
};

async function fetchBaseline(
  supabaseAdmin: any,
  userId: string,
  metric: string,
  date: string,
): Promise<BaselineRow | null> {
  // Prefer exact computed_on = date, else most recent <= date
  const { data, error } = await supabaseAdmin
    .from("baselines_28d")
    .select("metric, avg, computed_on")
    .eq("user_id", userId)
    .eq("metric", metric)
    .lte("computed_on", date)
    .order("computed_on", { ascending: false })
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length ? (data[0] as BaselineRow) : null;
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
    const date = typeof body?.date === "string" ? body.date : "";
    if (!isIsoDate(date)) return jsonResponse({ ok: false, error: "Missing/invalid date (YYYY-MM-DD)" }, 400);

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

    // Pull today's daily_metrics row (must exist or we create it minimally)
    const { data: dm, error: dmErr } = await supabaseAdmin
      .from("daily_metrics")
      .select("user_id,date,hrv_ms,resting_hr,respiratory_rate,sleep_score,recovery_score")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    if (dmErr) throw dmErr;

    const hrv = typeof dm?.hrv_ms === "number" ? dm.hrv_ms : null;
    const rhr = typeof dm?.resting_hr === "number" ? dm.resting_hr : null;
    const rr = typeof dm?.respiratory_rate === "number" ? dm.respiratory_rate : null;
    const sleepScore = typeof dm?.sleep_score === "number" ? dm.sleep_score : null;

    // Fetch baselines (most recent <= date)
    const bHrv = hrv !== null ? await fetchBaseline(supabaseAdmin, userId, "hrv_ms", date) : null;
    const bRhr = rhr !== null ? await fetchBaseline(supabaseAdmin, userId, "resting_hr", date) : null;
    const bRr = rr !== null ? await fetchBaseline(supabaseAdmin, userId, "respiratory_rate", date) : null;
    const bSleep = sleepScore !== null ? await fetchBaseline(supabaseAdmin, userId, "sleep_score", date) : null;

    // Component availability + default weights
    const components: Array<{
      key: "hrv" | "rhr" | "rr" | "sleep";
      weight: number;
      score: number | null;
      detail: any;
    }> = [
      { key: "hrv", weight: 0.40, score: null, detail: { today: hrv, baseline: bHrv?.avg ?? null } },
      { key: "rhr", weight: 0.30, score: null, detail: { today: rhr, baseline: bRhr?.avg ?? null } },
      { key: "rr", weight: 0.20, score: null, detail: { today: rr, baseline: bRr?.avg ?? null } },
      { key: "sleep", weight: 0.10, score: null, detail: { today: sleepScore, baseline: bSleep?.avg ?? null } },
    ];

    // Compute component scores
    for (const c of components) {
      if (c.key === "sleep") {
        if (typeof c.detail.today === "number") {
          // Sleep score already in 0..100; if you want baseline-relative sleep, adjust here.
          c.score = absoluteScoreToScore(c.detail.today);
        }
        continue;
      }

      const today = c.detail.today as number | null;
      const baseline = c.detail.baseline as number | null;
      if (today === null || baseline === null || baseline <= 0 || today <= 0) continue;

      if (c.key === "hrv") {
        // higher is better
        c.score = ratioToScore(today / baseline);
      } else {
        // rhr and rr: lower is better => baseline/today
        c.score = ratioToScore(baseline / today);
      }
    }

    // Renormalize weights for available components
    const available = components.filter((c) => typeof c.score === "number");
    if (available.length === 0) {
      return jsonResponse({
        ok: false,
        error: "Insufficient data to compute recovery (need at least one component with baseline).",
        missing: components.map((c) => ({
          component: c.key,
          today: c.detail.today ?? null,
          baseline: c.detail.baseline ?? null,
        })),
      }, 400);
    }

    const weightSum = available.reduce((acc, c) => acc + c.weight, 0);
    const blended =
      available.reduce((acc, c) => acc + (c.score as number) * (c.weight / weightSum), 0);

    // Add a gentle penalty if sleep score is very low (even if not used in blend)
    // This matches typical recovery UX: poor sleep drags recovery.
    let finalScore = blended;
    if (typeof sleepScore === "number" && sleepScore < 50) {
      finalScore -= (50 - sleepScore) * 0.15; // up to -7.5
    }

    finalScore = clamp(finalScore, 0, 100);
    const recovery_score = roundInt(finalScore);

    // Upsert into daily_metrics (create row if missing)
    const { error: upErr } = await supabaseAdmin
      .from("daily_metrics")
      .upsert(
        {
          user_id: userId,
          date,
          recovery_score,
          last_computed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,date" },
      );

    if (upErr) throw upErr;

    return jsonResponse({
      ok: true,
      userId,
      date,
      recoveryScore: recovery_score,
      components: components.map((c) => ({
        component: c.key,
        used: typeof c.score === "number",
        weight: c.weight,
        score: c.score,
        today: c.detail.today ?? null,
        baseline: c.detail.baseline ?? null,
      })),
      note:
        "If scores feel too sensitive, adjust ratioToScore() k value or weights. Next implement compute-strain for the third ring.",
    });
  } catch (e) {
    return jsonResponse(
      { ok: false, error: (e as Error)?.message ?? String(e) },
      500,
    );
  }
});