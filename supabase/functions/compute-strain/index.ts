// Supabase Edge Function: compute-strain
// Deploy: supabase functions deploy compute-strain
//
// Purpose
// - Compute a strain_score for a given user + date
// - Writes into daily_metrics.strain_score
//
// What "strain" means here (matches your app UX)
// - A day-level load score that increases with:
//   1) Exercise load (workouts): duration, calories, HR intensity (if available)
//   2) Elevated stress during the day (optional, from intra_day_metrics)
//   3) Sleep deficit penalty (10% weight, as per your copy)
//
// Output
// - 0..200 scale (to match schema check); typical days may sit 0..100.
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
// Notes
// - This is a robust first pass without needing the original app's exact equation.
// - You can later tune constants via app_config and keep the structure identical.

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

// Logistic-ish squashing to keep numbers in a friendly range
function squashTo100(x: number, k = 0.06): number {
  // x>=0. As x grows, approaches 100.
  // 0 -> 0
  // 500 -> ~26 (k=0.06)
  // 1500 -> ~60
  // 3000 -> ~83
  return 100 * (1 - Math.exp(-k * Math.max(0, x)));
}

function minutesBetween(a: string, b: string): number | null {
  const da = new Date(a);
  const db = new Date(b);
  const ta = da.getTime();
  const tb = db.getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return Math.max(0, Math.round((tb - ta) / 60000));
}

// Sleep deficit: expected sleep minutes can be derived from baseline (28d avg duration) if available.
// If not available, assume 8h (480m) baseline.
function sleepDeficitPenalty(todaySleepMin: number | null, baselineSleepMin: number | null): number {
  const expected = baselineSleepMin && baselineSleepMin > 0 ? baselineSleepMin : 480;
  if (!todaySleepMin || todaySleepMin <= 0) return 25; // strong penalty if missing/0
  const deficit = Math.max(0, expected - todaySleepMin);
  // Map deficit to 0..25 penalty, saturating after 3 hours deficit
  const capped = Math.min(deficit, 180);
  return (capped / 180) * 25;
}

type BaselineRow = { metric: string; avg: number | null; computed_on: string };

async function fetchBaseline(
  supabaseAdmin: any,
  userId: string,
  metric: string,
  date: string,
): Promise<BaselineRow | null> {
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

    // Ensure daily_metrics row exists and fetch today's sleep_score (for sleep deficit)
    const { data: dm, error: dmErr } = await supabaseAdmin
      .from("daily_metrics")
      .select("user_id,date,sleep_score")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    if (dmErr) throw dmErr;

    // Fetch sleep duration minutes from sleep_sessions (choose longest)
    const { data: sleeps, error: sErr } = await supabaseAdmin
      .from("sleep_sessions")
      .select("duration_min")
      .eq("user_id", userId)
      .eq("sleep_date", date);

    if (sErr) throw sErr;

    let todaySleepMin: number | null = null;
    if (Array.isArray(sleeps) && sleeps.length) {
      todaySleepMin = sleeps
        .map((x) => (typeof x.duration_min === "number" ? x.duration_min : null))
        .filter((x) => x !== null)
        .sort((a, b) => (b as number) - (a as number))[0] as number | null;
    }

    // Baseline sleep duration: if you store it in baselines_28d use metric "sleep_duration_min"
    // If not present, fall back to 480 min.
    const bSleepDur = await fetchBaseline(supabaseAdmin, userId, "sleep_duration_min", date).catch(() => null);
    const baselineSleepMin = bSleepDur?.avg ?? null;

    // Fetch workouts for the day (and optionally include intensity)
    const { data: workouts, error: wErr } = await supabaseAdmin
      .from("workouts")
      .select("id,start_time,end_time,duration_min,calories,avg_hr,max_hr,tlp_cardio,tlp_perceived,tlp_muscle")
      .eq("user_id", userId)
      .eq("workout_date", date);

    if (wErr) throw wErr;

    // Exercise load components
    let totalDurationMin = 0;
    let totalCalories = 0;
    let intensityPoints = 0;
    let tlpPoints = 0;

    for (const w of workouts ?? []) {
      const dur =
        typeof w.duration_min === "number"
          ? w.duration_min
          : (typeof w.start_time === "string" && typeof w.end_time === "string"
              ? minutesBetween(w.start_time, w.end_time)
              : null);

      if (dur && dur > 0) totalDurationMin += dur;
      if (typeof w.calories === "number" && w.calories > 0) totalCalories += w.calories;

      // Intensity proxy: avg_hr relative to max_hr if both exist
      if (typeof w.avg_hr === "number" && typeof w.max_hr === "number" && w.max_hr > 0) {
        const ratio = clamp(w.avg_hr / w.max_hr, 0, 1);
        intensityPoints += ratio * (dur ?? 0);
      }

      // If Polar training load provided, use it (scaled)
      const tlp =
        (typeof w.tlp_cardio === "number" ? w.tlp_cardio : 0) +
        (typeof w.tlp_perceived === "number" ? w.tlp_perceived : 0) +
        (typeof w.tlp_muscle === "number" ? w.tlp_muscle : 0);
      if (tlp > 0) tlpPoints += tlp;
    }

    // Stress contribution (optional): mean of intra_day_metrics metric "stress_level"
    const { data: stressPts, error: stressErr } = await supabaseAdmin
      .from("intra_day_metrics")
      .select("value")
      .eq("user_id", userId)
      .eq("date", date)
      .eq("metric", "stress_level");

    if (stressErr) throw stressErr;

    let stressAvg: number | null = null;
    if (Array.isArray(stressPts) && stressPts.length) {
      const vals = stressPts
        .map((p) => (typeof p.value === "number" ? p.value : null))
        .filter((v) => v !== null) as number[];
      if (vals.length) stressAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    // ------------------------------------------------------------
    // Build component scores
    // ------------------------------------------------------------

    // Exercise load raw: calories + duration*8 + intensityPoints*4 + tlpPoints*10
    // These constants are chosen to produce a natural 0..3000-ish load scale for most users.
    const exerciseLoadRaw =
      totalCalories +
      totalDurationMin * 8 +
      intensityPoints * 4 +
      tlpPoints * 10;

    const exerciseScore = squashTo100(exerciseLoadRaw, 0.0012); // tuned to typical day ranges

    // Stress score: map 0..100 to 0..100, but soften: only above 30 contributes strongly
    const stressScore =
      stressAvg === null
        ? 0
        : clamp((Math.max(0, stressAvg - 30) / 70) * 100, 0, 100);

    // Sleep deficit penalty in points (0..25)
    const sleepPenalty = sleepDeficitPenalty(todaySleepMin, baselineSleepMin);

    // ------------------------------------------------------------
    // Blend to final strain score
    // - Exercise: 70%
    // - Stress: 20%
    // - Sleep deficit: 10% (as per your copy, implemented as a penalty)
    // ------------------------------------------------------------
    const wExercise = 0.70;
    const wStress = 0.20;
    const wSleep = 0.10;

    // Base is weighted positive components (0..100)
    const baseStrain = exerciseScore * wExercise + stressScore * wStress;

    // Apply sleep penalty scaled by 0..25 -> 0..100 range by multiplying by 4
    const sleepPenaltyScaled = sleepPenalty * 4; // 0..100

    let final = baseStrain * (1 - wSleep) + clamp(sleepPenaltyScaled, 0, 100) * wSleep;

    // Convert 0..100-ish into 0..200 scale for a "bigger number" feel like many strain UIs
    // and to match your schema allowance.
    const strain_score = roundInt(clamp(final * 2.0, 0, 200));

    // Upsert into daily_metrics
    const { error: upErr } = await supabaseAdmin
      .from("daily_metrics")
      .upsert(
        {
          user_id: userId,
          date,
          strain_score,
          last_computed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,date" },
      );

    if (upErr) throw upErr;

    return jsonResponse({
      ok: true,
      userId,
      date,
      strainScore: strain_score,
      components: {
        exercise: {
          totalDurationMin,
          totalCalories,
          intensityPoints,
          tlpPoints,
          exerciseLoadRaw,
          exerciseScore,
        },
        stress: { stressAvg, stressScore },
        sleep: {
          todaySleepMin,
          baselineSleepMin,
          sleepPenalty, // 0..25
        },
      },
      note:
        "This is a tuned first-pass strain model. If you want exact parity, we can adjust constants after you see real distributions for 2–4 weeks of your data.",
    });
  } catch (e) {
    return jsonResponse(
      { ok: false, error: (e as Error)?.message ?? String(e) },
      500,
    );
  }
});