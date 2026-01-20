// Supabase Edge Function: compute-daily-metrics
// Deploy: supabase functions deploy compute-daily-metrics
//
// Purpose
// - Build/refresh one row in daily_metrics for a given user + date
// - Aggregates from:
//   - sleep_sessions (sleep_score, duration, efficiency proxy fields if needed)
//   - workouts (steps not in workouts; workouts contribute to active calories/distance when available)
//   - intra_day_metrics (optional) for stress_avg if you store it there
//
// Inputs
// - User mode (recommended for "recompute my day"): Authorization Bearer JWT
// - Service mode (cron/admin): x-sync-secret header + body.userId
//
// Request body
//   { "date": "YYYY-MM-DD", "userId": "...optional in service mode..." }
//
// Outputs
//   { ok: true, userId, date, upserted: true }
//
// Required env vars:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - SUPABASE_ANON_KEY
// - SYNC_SECRET
//
// Notes
// - This does NOT compute recovery/strain/health indicator. Those are separate functions.
// - It only sets the raw daily inputs + any direct Polar-provided scores (sleep_score) if present.

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

function clampInt(n: number | null, lo: number, hi: number): number | null {
  if (n === null || !Number.isFinite(n)) return null;
  const x = Math.trunc(n);
  return Math.max(lo, Math.min(hi, x));
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

    // ------------------------------------------------------------
    // Aggregate Sleep for this date (sleep_date is "morning of")
    // If multiple sessions exist, pick the longest duration.
    // ------------------------------------------------------------
    const { data: sleeps, error: sleepErr } = await supabaseAdmin
      .from("sleep_sessions")
      .select("id, duration_min, time_in_bed_min, efficiency_pct, sleep_score, avg_hr, avg_resp_rate")
      .eq("user_id", userId)
      .eq("sleep_date", date);

    if (sleepErr) throw sleepErr;

    let bestSleep = null as null | {
      id: string;
      duration_min: number | null;
      time_in_bed_min: number | null;
      efficiency_pct: number | null;
      sleep_score: number | null;
      avg_hr: number | null;
      avg_resp_rate: number | null;
    };

    if (Array.isArray(sleeps) && sleeps.length) {
      bestSleep = sleeps
        .slice()
        .sort((a, b) => (Number(b.duration_min ?? 0) - Number(a.duration_min ?? 0)))[0] as any;
    }

    const sleep_score = clampInt(bestSleep?.sleep_score ?? null, 0, 100);

    // ------------------------------------------------------------
    // Aggregate Workouts for this date
    // Sum calories + distance. HRV/RHR/steps often come from other Polar endpoints
    // and should be written by separate ingestion or daily compute functions.
    // ------------------------------------------------------------
    const { data: workouts, error: wErr } = await supabaseAdmin
      .from("workouts")
      .select("duration_min, calories, distance_m")
      .eq("user_id", userId)
      .eq("workout_date", date);

    if (wErr) throw wErr;

    let active_calories: number | null = null;
    let distance_m: number | null = null;

    if (Array.isArray(workouts) && workouts.length) {
      let cal = 0;
      let dist = 0;
      let calSeen = false;
      let distSeen = false;

      for (const w of workouts) {
        if (typeof w.calories === "number") {
          cal += w.calories;
          calSeen = true;
        }
        if (typeof w.distance_m === "number") {
          dist += w.distance_m;
          distSeen = true;
        }
      }

      active_calories = calSeen ? Math.max(0, Math.trunc(cal)) : null;
      distance_m = distSeen ? Math.max(0, Math.trunc(dist)) : null;
    }

    // ------------------------------------------------------------
    // Optional: stress_avg from intra_day_metrics (if you store stress level there)
    // Metric names assumed: 'stress_level'
    // ------------------------------------------------------------
    const { data: stressPts, error: stressErr } = await supabaseAdmin
      .from("intra_day_metrics")
      .select("value")
      .eq("user_id", userId)
      .eq("date", date)
      .eq("metric", "stress_level");

    if (stressErr) throw stressErr;

    let stress_avg: number | null = null;
    if (Array.isArray(stressPts) && stressPts.length) {
      const vals = stressPts
        .map((p) => (typeof p.value === "number" ? p.value : null))
        .filter((v) => v !== null) as number[];
      if (vals.length) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        stress_avg = clampInt(avg, 0, 100);
      }
    }

    // ------------------------------------------------------------
    // Upsert daily_metrics
    // We do not overwrite existing computed scores unless they are null.
    // Strategy: upsert raw fields; keep recovery_score/strain_score if already set.
    // ------------------------------------------------------------
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("daily_metrics")
      .select("recovery_score, strain_score, hrv_ms, resting_hr, respiratory_rate, spo2, steps, total_calories")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    if (exErr) throw exErr;

    const payload: Record<string, any> = {
      user_id: userId,
      date,
      sleep_score,
      active_calories,
      distance_m,
      stress_avg,
      last_computed_at: new Date().toISOString(),
    };

    // Preserve existing values for fields we are not computing here.
    // (If those are being ingested elsewhere, they should be upserted there.)
    if (existing?.recovery_score != null) payload.recovery_score = existing.recovery_score;
    if (existing?.strain_score != null) payload.strain_score = existing.strain_score;
    if (existing?.hrv_ms != null) payload.hrv_ms = existing.hrv_ms;
    if (existing?.resting_hr != null) payload.resting_hr = existing.resting_hr;
    if (existing?.respiratory_rate != null) payload.respiratory_rate = existing.respiratory_rate;
    if (existing?.spo2 != null) payload.spo2 = existing.spo2;
    if (existing?.steps != null) payload.steps = existing.steps;
    if (existing?.total_calories != null) payload.total_calories = existing.total_calories;

    const { error: upErr } = await supabaseAdmin
      .from("daily_metrics")
      .upsert(payload, { onConflict: "user_id,date" });

    if (upErr) throw upErr;

    return jsonResponse({
      ok: true,
      userId,
      date,
      upserted: true,
      computed: {
        sleep_score,
        active_calories,
        distance_m,
        stress_avg,
      },
      note:
        "This function populates daily_metrics base fields. Run compute-baselines-28d and compute-recovery/strain next for full dashboard parity.",
    });
  } catch (e) {
    return jsonResponse(
      { ok: false, error: (e as Error)?.message ?? String(e) },
      500,
    );
  }
});