// Supabase Edge Function: sync-polar
// Deploy: supabase functions deploy sync-polar
//
// Purpose
// - Pull latest workouts, sleep, nightly recharge, activity summary, and continuous HR from Polar (AccessLink) since last_synced_at
// - Upsert into: workouts, workout_hr_series, workout_hr_zones
//                sleep_sessions, sleep_stages, sleep_hr_series
//                nightly_recharge, continuous_hr, daily_metrics
// - Compute strain_21, sleep coach metrics, and strain targets
// - Return counts + list of dates touched
//
// Notes
// - This function is intentionally defensive and configurable because Polar endpoints/payloads differ
//   depending on what you've enabled in AccessLink.
// - You can run it in two modes:
//   1) User mode: called from the web app with a user JWT (syncs the caller)
//   2) Service mode: called with x-sync-secret header to sync a specified userId
//
// Required env vars (Supabase function secrets):
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - POLAR_CLIENT_ID
// - POLAR_CLIENT_SECRET
// - POLAR_OAUTH_TOKEN_URL          (example: https://polarremote.com/v2/oauth2/token)  <-- set your real token URL
// - POLAR_API_BASE_URL             (example: https://www.polar.com/accesslink/api)   <-- set your real base
// - SYNC_SECRET                    (random long secret for server-to-server calls)
//
// Optional:
// - POLAR_SYNC_LOOKBACK_DAYS        (default 30) initial sync window if last_synced_at is null
//
// Tables expected (from your SQL):
// - polar_connections, workouts, workout_hr_series, workout_hr_zones
// - sleep_sessions, sleep_stages, sleep_hr_series
// - nightly_recharge, continuous_hr, daily_metrics
//
// IMPORTANT
// - polar_connections has RLS enabled with no policies, so we MUST use service role client to read/write it.

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

function toIso(dt: Date) {
  return dt.toISOString();
}

function parseJsonSafe(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readTextSafe(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2,
): Promise<Response> {
  let lastErr: unknown = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500 && i < retries) {
        await new Promise((r) => setTimeout(r, 250 * (i + 1)));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw lastErr ?? new Error("fetchWithRetry failed");
}

// ------------------------------------------------------------
// Polar token refresh
// ------------------------------------------------------------
async function refreshPolarToken(opts: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const basic = btoa(`${opts.clientId}:${opts.clientSecret}`);
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", opts.refreshToken);

  const res = await fetchWithRetry(opts.tokenUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  }, 2);

  const text = await readTextSafe(res);
  const json = parseJsonSafe(text);

  if (!res.ok || !json?.access_token) {
    throw new Error(
      `Polar token refresh failed: ${res.status} ${text.slice(0, 300)}`,
    );
  }

  return json;
}

// ------------------------------------------------------------
// Polar API helpers
// ------------------------------------------------------------
async function polarGetJson(
  baseUrl: string,
  path: string,
  accessToken: string,
): Promise<any> {
  const url = `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  const res = await fetchWithRetry(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
    },
  }, 2);

  const text = await readTextSafe(res);
  const json = parseJsonSafe(text);

  if (!res.ok) {
    throw new Error(`Polar GET failed ${res.status} ${url}: ${text.slice(0, 300)}`);
  }
  return json ?? text;
}

// ------------------------------------------------------------
// Payload mappers (defensive: tolerate missing fields)
// You will refine these once you confirm the exact Polar payloads you receive.
// ------------------------------------------------------------
function asInt(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function asFloat(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asBool(v: any): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

function dateOnlyFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function computeWorkoutDate(startTimeIso: string | null): string | null {
  return dateOnlyFromIso(startTimeIso);
}

function computeSleepDate(sleepEndIso: string | null): string | null {
  // App groups the sleep by the morning date.
  return dateOnlyFromIso(sleepEndIso);
}

type WorkoutUpsert = {
  user_id: string;
  polar_id: string;
  start_time: string;
  end_time?: string | null;
  workout_date: string;
  sport?: string | null;
  duration_min?: number | null;
  calories?: number | null;
  distance_m?: number | null;
  avg_hr?: number | null;
  max_hr?: number | null;
  tlp_cardio?: number | null;
  tlp_muscle?: number | null;
  tlp_perceived?: number | null;
  route_available?: boolean;
  raw?: any;
};

function mapPolarExerciseToWorkout(userId: string, ex: any): WorkoutUpsert | null {
  const polarId = String(ex?.id ?? ex?.polar_id ?? ex?.exercise_id ?? "");
  const start = ex?.start_time ?? ex?.startTime ?? ex?.start ?? null;
  const end = ex?.end_time ?? ex?.endTime ?? ex?.end ?? null;

  const workoutDate = computeWorkoutDate(start);
  if (!polarId || !start || !workoutDate) return null;

  return {
    user_id: userId,
    polar_id: polarId,
    start_time: new Date(start).toISOString(),
    end_time: end ? new Date(end).toISOString() : null,
    workout_date: workoutDate,
    sport: ex?.sport ?? ex?.type ?? ex?.activity ?? null,
    duration_min: asInt(ex?.duration_min ?? ex?.durationMinutes ?? ex?.duration ?? null),
    calories: asInt(ex?.calories ?? null),
    distance_m: asInt(ex?.distance_m ?? ex?.distanceMeters ?? ex?.distance ?? null),
    avg_hr: asInt(ex?.avg_hr ?? ex?.average_hr ?? ex?.avgHr ?? null),
    max_hr: asInt(ex?.max_hr ?? ex?.maximum_hr ?? ex?.maxHr ?? null),
    tlp_cardio: asFloat(ex?.tlp_cardio ?? ex?.training_load_cardio ?? ex?.cardio_load ?? null),
    tlp_muscle: asFloat(ex?.tlp_muscle ?? ex?.training_load_muscle ?? ex?.muscle_load ?? null),
    tlp_perceived: asFloat(ex?.tlp_perceived ?? ex?.training_load_perceived ?? ex?.perceived_load ?? null),
    route_available: asBool(ex?.route_available ?? ex?.has_route ?? false),
    raw: ex,
  };
}

type SleepUpsert = {
  user_id: string;
  polar_id: string;
  sleep_start: string;
  sleep_end: string;
  sleep_date: string;
  duration_min?: number | null;
  time_in_bed_min?: number | null;
  efficiency_pct?: number | null;
  sleep_score?: number | null;
  avg_hr?: number | null;
  min_hr?: number | null;
  max_hr?: number | null;
  avg_resp_rate?: number | null;
  raw?: any;
};

function mapPolarSleepToSleepSession(userId: string, s: any): SleepUpsert | null {
  const polarId = String(s?.id ?? s?.polar_id ?? s?.sleep_id ?? "");
  const start = s?.sleep_start ?? s?.start_time ?? s?.start ?? null;
  const end = s?.sleep_end ?? s?.end_time ?? s?.end ?? null;
  const sleepDate = computeSleepDate(end);
  if (!polarId || !start || !end || !sleepDate) return null;

  return {
    user_id: userId,
    polar_id: polarId,
    sleep_start: new Date(start).toISOString(),
    sleep_end: new Date(end).toISOString(),
    sleep_date: sleepDate,
    duration_min: asInt(s?.duration_min ?? s?.durationMinutes ?? s?.duration ?? null),
    time_in_bed_min: asInt(s?.time_in_bed_min ?? s?.timeInBedMinutes ?? null),
    efficiency_pct: asInt(s?.efficiency_pct ?? s?.efficiency ?? null),
    sleep_score: asInt(s?.sleep_score ?? s?.score ?? null),
    avg_hr: asInt(s?.avg_hr ?? s?.average_hr ?? null),
    min_hr: asInt(s?.min_hr ?? null),
    max_hr: asInt(s?.max_hr ?? null),
    avg_resp_rate: asFloat(s?.avg_resp_rate ?? s?.respiratory_rate_avg ?? null),
    raw: s,
  };
}

type NightlyRechargeUpsert = {
  user_id: string;
  polar_id: string;
  date: string;
  ans_charge?: number | null;
  ans_charge_status?: string | null;
  hrv_avg?: number | null;
  hrv_max?: number | null;
  hr_avg?: number | null;
  hr_min?: number | null;
  breathing_rate_avg?: number | null;
  beat_to_beat_avg?: number | null;
  raw?: any;
};

function mapPolarNightlyRechargeToUpsert(userId: string, data: any): NightlyRechargeUpsert | null {
  const polarId = String(data?.id ?? data?.polar_id ?? data?.nightly_recharge_id ?? "");
  const dateStr = data?.date ?? data?.created ?? null;
  const date = dateOnlyFromIso(dateStr);

  if (!polarId || !date) return null;

  return {
    user_id: userId,
    polar_id: polarId,
    date,
    ans_charge: asInt(data?.ans_charge ?? data?.ansCharge ?? null),
    ans_charge_status: data?.ans_charge_status ?? data?.ansChargeStatus ?? null,
    hrv_avg: asFloat(data?.hrv_avg ?? data?.hrvAverage ?? data?.hrv_average ?? null),
    hrv_max: asFloat(data?.hrv_max ?? data?.hrvMax ?? null),
    hr_avg: asFloat(data?.hr_avg ?? data?.hrAverage ?? data?.hr_average ?? null),
    hr_min: asFloat(data?.hr_min ?? data?.hrMin ?? null),
    breathing_rate_avg: asFloat(data?.breathing_rate_avg ?? data?.breathingRateAverage ?? null),
    beat_to_beat_avg: asFloat(data?.beat_to_beat_avg ?? data?.beatToBeatAverage ?? null),
    raw: data,
  };
}

type ActivitySummaryUpsert = {
  user_id: string;
  polar_id: string;
  date: string;
  steps?: number | null;
  active_calories?: number | null;
  total_calories?: number | null;
  distance_m?: number | null;
  raw?: any;
};

function mapPolarActivitySummaryToUpsert(userId: string, data: any): ActivitySummaryUpsert | null {
  const polarId = String(data?.id ?? data?.polar_id ?? data?.activity_id ?? "");
  const dateStr = data?.date ?? data?.created ?? null;
  const date = dateOnlyFromIso(dateStr);

  if (!polarId || !date) return null;

  return {
    user_id: userId,
    polar_id: polarId,
    date,
    steps: asInt(data?.steps ?? null),
    active_calories: asInt(data?.active_calories ?? data?.activeCalories ?? null),
    total_calories: asInt(data?.total_calories ?? data?.totalCalories ?? null),
    distance_m: asInt(data?.distance_m ?? data?.distanceMeters ?? null),
    raw: data,
  };
}

type ContinuousHrUpsert = {
  user_id: string;
  polar_id: string;
  date: string;
  samples?: Array<{ t_offset_sec: number; hr: number }> | null;
  raw?: any;
};

function mapPolarContinuousHrToUpsert(userId: string, date: string, data: any): ContinuousHrUpsert | null {
  const polarId = String(data?.id ?? data?.polar_id ?? `${userId}_${date}`);

  if (!polarId || !date) return null;

  const samples = normalizeHrSeries(data?.samples ?? data?.data ?? null);

  return {
    user_id: userId,
    polar_id: polarId,
    date,
    samples: samples.length > 0 ? samples : null,
    raw: data,
  };
}

// HR series expected shapes:
// - workout: [{t_offset_sec, hr}] or [{time, value}] etc
// - sleep: same
function normalizeHrSeries(series: any): Array<{ t_offset_sec: number; hr: number }> {
  if (!Array.isArray(series)) return [];
  const out: Array<{ t_offset_sec: number; hr: number }> = [];
  for (const p of series) {
    const t = asInt(p?.t_offset_sec ?? p?.t ?? p?.offset ?? p?.seconds ?? null);
    const hr = asInt(p?.hr ?? p?.value ?? p?.bpm ?? null);
    if (t === null || hr === null) continue;
    out.push({ t_offset_sec: t, hr });
  }
  out.sort((a, b) => a.t_offset_sec - b.t_offset_sec);
  return out;
}

function normalizeHrZones(zones: any): Array<{ zone: number; seconds: number; min_bpm?: number | null; max_bpm?: number | null }> {
  if (!Array.isArray(zones)) return [];
  const out: Array<{ zone: number; seconds: number; min_bpm?: number | null; max_bpm?: number | null }> = [];
  for (const z of zones) {
    const zone = asInt(z?.zone ?? z?.id ?? null);
    const seconds = asInt(z?.seconds ?? z?.duration_sec ?? z?.durationSeconds ?? null);
    if (zone === null || seconds === null) continue;
    out.push({
      zone,
      seconds,
      min_bpm: asInt(z?.min_bpm ?? z?.min ?? null),
      max_bpm: asInt(z?.max_bpm ?? z?.max ?? null),
    });
  }
  out.sort((a, b) => a.zone - b.zone);
  return out;
}

function normalizeSleepStages(stages: any): Array<{ stage: "awake" | "light" | "deep" | "rem"; minutes: number }> {
  // Accept either object {awake: 27, light: 300...} or array of items.
  const out: Array<{ stage: "awake" | "light" | "deep" | "rem"; minutes: number }> = [];
  const valid = new Set(["awake", "light", "deep", "rem"]);
  if (stages && typeof stages === "object" && !Array.isArray(stages)) {
    for (const k of Object.keys(stages)) {
      if (!valid.has(k)) continue;
      const m = asInt(stages[k]);
      if (m === null) continue;
      out.push({ stage: k as any, minutes: m });
    }
    return out;
  }
  if (Array.isArray(stages)) {
    for (const s of stages) {
      const stage = String(s?.stage ?? s?.name ?? "").toLowerCase();
      if (!valid.has(stage)) continue;
      const minutes = asInt(s?.minutes ?? s?.min ?? null);
      if (minutes === null) continue;
      out.push({ stage: stage as any, minutes });
    }
  }
  return out;
}

// Strain calculation: convert 0-200 internal strain to 0-21 Whoop-style scale
function computeStrain21(strainScore: number | null): number | null {
  if (strainScore === null || strainScore < 0) return null;
  // Formula: strain_21 = 21 * (1 - exp(-strain_score * 0.015))
  const clamped = Math.max(0, Math.min(200, strainScore));
  const strain21 = 21 * (1 - Math.exp(-clamped * 0.015));
  return Math.round(strain21 * 100) / 100;
}

// Sleep coach metrics computation
function computeSleepCoachMetrics(opts: {
  sleepGotMin: number | null;
  sleepNeededMin: number | null;
  baselineSleepMin: number | null;
  strainScore: number | null;
  recoveryScore: number | null;
  sleepDebtMin: number | null;
}): {
  sleepNeededMin: number | null;
  sleepDebtMin: number | null;
  sleepPerformancePct: number | null;
  strainTargetLow: number | null;
  strainTargetHigh: number | null;
} {
  const { sleepGotMin, sleepNeededMin, baselineSleepMin, strainScore, recoveryScore, sleepDebtMin } = opts;

  // Compute sleep needed based on baseline + strain + debt
  let computedSleepNeeded = baselineSleepMin ?? 480; // Default 8 hours
  if (strainScore !== null && strainScore > 0) {
    // Add extra sleep need based on strain (rough estimate: 1 min per 2 strain)
    computedSleepNeeded += Math.ceil(strainScore / 2);
  }
  if (sleepDebtMin !== null && sleepDebtMin > 0) {
    // Add sleep debt repayment (rough estimate: 50% of debt)
    computedSleepNeeded += Math.ceil(sleepDebtMin * 0.5);
  }

  // Use provided sleepNeededMin if available, otherwise use computed
  const finalSleepNeeded = sleepNeededMin ?? computedSleepNeeded;

  // Compute sleep performance
  let sleepPerformancePct = null;
  if (sleepGotMin !== null && finalSleepNeeded > 0) {
    sleepPerformancePct = Math.round((sleepGotMin / finalSleepNeeded) * 100 * 100) / 100;
    sleepPerformancePct = Math.max(0, Math.min(200, sleepPerformancePct)); // Clamp 0-200%
  }

  // Compute strain target based on recovery score
  let strainTargetLow = null;
  let strainTargetHigh = null;
  if (recoveryScore !== null) {
    if (recoveryScore >= 67) {
      strainTargetLow = 14;
      strainTargetHigh = 18;
    } else if (recoveryScore >= 34) {
      strainTargetLow = 8;
      strainTargetHigh = 14;
    } else {
      strainTargetLow = 0;
      strainTargetHigh = 8;
    }
  }

  return {
    sleepNeededMin: finalSleepNeeded,
    sleepDebtMin: sleepDebtMin ?? null,
    sleepPerformancePct,
    strainTargetLow,
    strainTargetHigh,
  };
}

// ------------------------------------------------------------
// Main handler
// ------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = getEnv("SUPABASE_URL");
    const SERVICE_ROLE = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const POLAR_CLIENT_ID = getEnv("POLAR_CLIENT_ID");
    const POLAR_CLIENT_SECRET = getEnv("POLAR_CLIENT_SECRET");
    const POLAR_OAUTH_TOKEN_URL = getEnv("POLAR_OAUTH_TOKEN_URL");
    const POLAR_API_BASE_URL = getEnv("POLAR_API_BASE_URL");
    const SYNC_SECRET = getEnv("SYNC_SECRET");
    const LOOKBACK_DAYS = Number(Deno.env.get("POLAR_SYNC_LOOKBACK_DAYS") ?? "30");

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Determine who we're syncing
    const syncSecretHeader = req.headers.get("x-sync-secret");
    const isServiceMode = syncSecretHeader && syncSecretHeader === SYNC_SECRET;

    let userId: string | null = null;
    let sinceIso: string | null = null;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (isServiceMode) {
      userId = typeof body?.userId === "string" ? body.userId : null;
      sinceIso = typeof body?.since === "string" ? body.since : null;
      if (!userId) return jsonResponse({ ok: false, error: "Missing userId (service mode)" }, 400);
    } else {
      // User mode: verify JWT from Authorization header
      const authHeader = req.headers.get("authorization") ?? "";
      const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!jwt) return jsonResponse({ ok: false, error: "Missing Authorization bearer token" }, 401);

      const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false },
      });

      const { data: u, error: uErr } = await supabaseUser.auth.getUser();
      if (uErr || !u?.user?.id) {
        return jsonResponse({ ok: false, error: "Invalid user token" }, 401);
      }
      userId = u.user.id;

      sinceIso = typeof body?.since === "string" ? body.since : null;
    }

    // Load Polar connection for user
    const { data: conn, error: connErr } = await supabaseAdmin
      .from("polar_connections")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (connErr) throw connErr;
    if (!conn?.access_token || !conn?.refresh_token) {
      return jsonResponse({ ok: false, error: "Polar not connected for this user" }, 400);
    }

    // Determine 'since'
    let sinceDate: Date;
    if (sinceIso) {
      const d = new Date(sinceIso);
      sinceDate = Number.isNaN(d.getTime()) ? new Date(Date.now() - LOOKBACK_DAYS * 86400_000) : d;
    } else if (conn.last_synced_at) {
      const d = new Date(conn.last_synced_at);
      sinceDate = Number.isNaN(d.getTime()) ? new Date(Date.now() - LOOKBACK_DAYS * 86400_000) : d;
    } else {
      sinceDate = new Date(Date.now() - LOOKBACK_DAYS * 86400_000);
    }

    // Ensure valid access token (refresh if expired or near expiry)
    let accessToken: string = conn.access_token;
    const expiresAt = conn.expires_at ? new Date(conn.expires_at) : null;
    const needsRefresh = !expiresAt || (expiresAt.getTime() - Date.now() < 60_000);

    if (needsRefresh) {
      const refreshed = await refreshPolarToken({
        tokenUrl: POLAR_OAUTH_TOKEN_URL,
        clientId: POLAR_CLIENT_ID,
        clientSecret: POLAR_CLIENT_SECRET,
        refreshToken: conn.refresh_token,
      });

      accessToken = refreshed.access_token;

      const newExpiresAt = refreshed.expires_in
        ? new Date(Date.now() + refreshed.expires_in * 1000)
        : null;

      const updatePayload: Record<string, any> = {
        access_token: accessToken,
        updated_at: new Date().toISOString(),
      };
      if (refreshed.refresh_token) updatePayload.refresh_token = refreshed.refresh_token;
      if (newExpiresAt) updatePayload.expires_at = newExpiresAt.toISOString();

      const { error: updErr } = await supabaseAdmin
        .from("polar_connections")
        .update(updatePayload)
        .eq("user_id", userId);

      if (updErr) throw updErr;
    }

    // ------------------------------------------------------------
    // Fetch data from Polar
    //
    // IMPORTANT: These paths are placeholders and MUST be aligned with your Polar AccessLink config.
    // The design is:
    // - list workouts since date
    // - for each workout, fetch detail/series/zones (if separate endpoints)
    // - list sleep since date
    // - for each sleep, fetch detail/series/stages (if separate endpoints)
    // - list nightly recharge since date
    // - list activity summary since date
    // - list continuous HR for each touched date
    //
    // Once you confirm your actual endpoints, you only edit the `paths` object below.
    // ------------------------------------------------------------
    const sinceParam = encodeURIComponent(toIso(sinceDate));

    const paths = {
      // Expected to return list: [{id, start_time, ...}, ...]
      workoutsList: `workouts?since=${sinceParam}`,
      // Expected to return detail for one workout with series/zones
      workoutDetail: (id: string) => `workouts/${encodeURIComponent(id)}`,
      // Expected to return list: [{id, sleep_start, sleep_end, ...}, ...]
      sleepList: `sleep?since=${sinceParam}`,
      // Expected to return detail for one sleep with stages/hr series
      sleepDetail: (id: string) => `sleep/${encodeURIComponent(id)}`,
      // NEW: Expected to return list: [{id, date, hrv_avg, ...}, ...]
      nightlyRechargeList: `nightly-recharge?since=${sinceParam}`,
      // NEW: Expected to return list: [{id, date, steps, ...}, ...]
      activitySummaryList: `activity-summary?since=${sinceParam}`,
      // NEW: Expected to return samples for a specific date
      continuousHr: (date: string) => `continuous-heart-rate/${encodeURIComponent(date)}`,
    };

    // 1) Workouts
    const workoutsList = await polarGetJson(POLAR_API_BASE_URL, paths.workoutsList, accessToken);
    const workoutsArr: any[] = Array.isArray(workoutsList) ? workoutsList : (workoutsList?.items ?? workoutsList?.workouts ?? []);
    let workoutsUpserted = 0;

    // Track touched dates so caller can recompute metrics for those dates
    const datesTouched = new Set<string>();

    for (const ex of workoutsArr) {
      const mapped = mapPolarExerciseToWorkout(userId, ex);
      if (!mapped) continue;

      // Fetch details if list payload is lightweight
      let detail = ex;
      const id = mapped.polar_id;
      try {
        detail = await polarGetJson(POLAR_API_BASE_URL, paths.workoutDetail(id), accessToken);
      } catch {
        // If detail endpoint doesn't exist, stick with list payload
        detail = ex;
      }

      const fullMapped = mapPolarExerciseToWorkout(userId, detail) ?? mapped;
      if (!fullMapped.workout_date) continue;

      datesTouched.add(fullMapped.workout_date);

      // Upsert workout by polar_id
      const { data: upW, error: upWErr } = await supabaseAdmin
        .from("workouts")
        .upsert(fullMapped, { onConflict: "polar_id" })
        .select("id, polar_id")
        .eq("polar_id", fullMapped.polar_id)
        .maybeSingle();

      if (upWErr) throw upWErr;
      const workoutId = upW?.id;
      if (!workoutId) continue;

      workoutsUpserted++;

      // Replace HR series if present
      const hrSeries = normalizeHrSeries(detail?.hr_series ?? detail?.heart_rate_series ?? detail?.heartRateSeries);
      if (hrSeries.length) {
        await supabaseAdmin.from("workout_hr_series").delete().eq("workout_id", workoutId);
        const rows = hrSeries.map((p) => ({
          user_id: userId,
          workout_id: workoutId,
          t_offset_sec: p.t_offset_sec,
          hr: p.hr,
        }));
        const { error: insErr } = await supabaseAdmin.from("workout_hr_series").insert(rows);
        if (insErr) throw insErr;
      }

      // Replace HR zones if present
      const zones = normalizeHrZones(detail?.hr_zones ?? detail?.heart_rate_zones ?? detail?.heartRateZones);
      if (zones.length) {
        await supabaseAdmin.from("workout_hr_zones").delete().eq("workout_id", workoutId);
        const rows = zones.map((z) => ({
          user_id: userId,
          workout_id: workoutId,
          zone: z.zone,
          seconds: z.seconds,
          min_bpm: z.min_bpm ?? null,
          max_bpm: z.max_bpm ?? null,
        }));
        const { error: insErr } = await supabaseAdmin.from("workout_hr_zones").insert(rows);
        if (insErr) throw insErr;
      }
    }

    // 2) Sleep
    const sleepList = await polarGetJson(POLAR_API_BASE_URL, paths.sleepList, accessToken);
    const sleepArr: any[] = Array.isArray(sleepList) ? sleepList : (sleepList?.items ?? sleepList?.sleep ?? []);
    let sleepUpserted = 0;

    for (const s of sleepArr) {
      const mapped = mapPolarSleepToSleepSession(userId, s);
      if (!mapped) continue;

      let detail = s;
      const id = mapped.polar_id;
      try {
        detail = await polarGetJson(POLAR_API_BASE_URL, paths.sleepDetail(id), accessToken);
      } catch {
        detail = s;
      }

      const fullMapped = mapPolarSleepToSleepSession(userId, detail) ?? mapped;
      if (!fullMapped.sleep_date) continue;

      datesTouched.add(fullMapped.sleep_date);

      const { data: upS, error: upSErr } = await supabaseAdmin
        .from("sleep_sessions")
        .upsert(fullMapped, { onConflict: "polar_id" })
        .select("id, polar_id")
        .eq("polar_id", fullMapped.polar_id)
        .maybeSingle();

      if (upSErr) throw upSErr;
      const sleepId = upS?.id;
      if (!sleepId) continue;

      sleepUpserted++;

      // Replace stages if present
      const stages = normalizeSleepStages(detail?.stages ?? detail?.sleep_stages ?? detail?.sleepStages);
      if (stages.length) {
        await supabaseAdmin.from("sleep_stages").delete().eq("sleep_id", sleepId);
        const rows = stages.map((st) => ({
          user_id: userId,
          sleep_id: sleepId,
          stage: st.stage,
          minutes: st.minutes,
        }));
        const { error: insErr } = await supabaseAdmin.from("sleep_stages").insert(rows);
        if (insErr) throw insErr;
      }

      // Replace sleep HR series if present
      const hrSeries = normalizeHrSeries(detail?.hr_series ?? detail?.heart_rate_series ?? detail?.heartRateSeries);
      if (hrSeries.length) {
        await supabaseAdmin.from("sleep_hr_series").delete().eq("sleep_id", sleepId);
        const rows = hrSeries.map((p) => ({
          user_id: userId,
          sleep_id: sleepId,
          t_offset_sec: p.t_offset_sec,
          hr: p.hr,
        }));
        const { error: insErr } = await supabaseAdmin.from("sleep_hr_series").insert(rows);
        if (insErr) throw insErr;
      }
    }

    // 3) Nightly Recharge
    let nightlyRechargeUpserted = 0;
    try {
      const nightlyRechargeList = await polarGetJson(POLAR_API_BASE_URL, paths.nightlyRechargeList, accessToken);
      const nightlyRechargeArr: any[] = Array.isArray(nightlyRechargeList)
        ? nightlyRechargeList
        : (nightlyRechargeList?.items ?? nightlyRechargeList?.data ?? []);

      for (const nr of nightlyRechargeArr) {
        const mapped = mapPolarNightlyRechargeToUpsert(userId, nr);
        if (!mapped) continue;

        datesTouched.add(mapped.date);

        const { error: upErr } = await supabaseAdmin
          .from("nightly_recharge")
          .upsert(mapped, { onConflict: "polar_id" });

        if (upErr) throw upErr;
        nightlyRechargeUpserted++;
      }
    } catch (e) {
      // Gracefully fail if endpoint not available
      console.log(`Nightly Recharge sync skipped: ${(e as Error).message}`);
    }

    // 4) Activity Summary
    let activitySummaryUpserted = 0;
    try {
      const activitySummaryList = await polarGetJson(POLAR_API_BASE_URL, paths.activitySummaryList, accessToken);
      const activitySummaryArr: any[] = Array.isArray(activitySummaryList)
        ? activitySummaryList
        : (activitySummaryList?.items ?? activitySummaryList?.data ?? []);

      for (const as of activitySummaryArr) {
        const mapped = mapPolarActivitySummaryToUpsert(userId, as);
        if (!mapped) continue;

        datesTouched.add(mapped.date);

        const { error: upErr } = await supabaseAdmin
          .from("activity_summary")
          .upsert(mapped, { onConflict: "polar_id" });

        if (upErr) throw upErr;
        activitySummaryUpserted++;
      }
    } catch (e) {
      // Gracefully fail if endpoint not available
      console.log(`Activity Summary sync skipped: ${(e as Error).message}`);
    }

    // 5) Continuous Heart Rate
    let continuousHrUpserted = 0;
    try {
      for (const dateStr of datesTouched) {
        try {
          const hrData = await polarGetJson(POLAR_API_BASE_URL, paths.continuousHr(dateStr), accessToken);
          const mapped = mapPolarContinuousHrToUpsert(userId, dateStr, hrData);
          if (!mapped) continue;

          const { error: upErr } = await supabaseAdmin
            .from("continuous_hr")
            .upsert(mapped, { onConflict: "polar_id" });

          if (upErr) throw upErr;
          continuousHrUpserted++;
        } catch {
          // Gracefully fail for individual dates
          continue;
        }
      }
    } catch (e) {
      // Gracefully fail if endpoint not available
      console.log(`Continuous HR sync skipped: ${(e as Error).message}`);
    }

    // 6) Post-sync computation: Update daily_metrics with strain_21, sleep coach metrics, and strain targets
    try {
      for (const dateStr of datesTouched) {
        // Fetch current data for this date
        const { data: existingMetrics } = await supabaseAdmin
          .from("daily_metrics")
          .select("*")
          .eq("user_id", userId)
          .eq("date", dateStr)
          .maybeSingle();

        // Build update payload
        const updatePayload: Record<string, any> = {};

        // Compute strain_21 from workouts (if available)
        const { data: workouts } = await supabaseAdmin
          .from("workouts")
          .select("tlp_perceived")
          .eq("user_id", userId)
          .eq("workout_date", dateStr);

        if (workouts && workouts.length > 0) {
          const totalStrain = workouts.reduce((sum, w) => {
            const strain = asFloat(w.tlp_perceived);
            return sum + (strain ?? 0);
          }, 0);
          const strain21 = computeStrain21(totalStrain);
          if (strain21 !== null) updatePayload.strain_21 = strain21;
        }

        // Update with nightly recharge data (hrv_ms, resting_hr)
        const { data: nightlyRecharge } = await supabaseAdmin
          .from("nightly_recharge")
          .select("hrv_avg, hr_min")
          .eq("user_id", userId)
          .eq("date", dateStr)
          .maybeSingle();

        if (nightlyRecharge) {
          if (nightlyRecharge.hrv_avg !== null) updatePayload.hrv_ms = nightlyRecharge.hrv_avg;
          if (nightlyRecharge.hr_min !== null) updatePayload.resting_hr = nightlyRecharge.hr_min;
        }

        // Update with activity summary data
        const { data: activitySummary } = await supabaseAdmin
          .from("activity_summary")
          .select("steps, active_calories, total_calories, distance_m")
          .eq("user_id", userId)
          .eq("date", dateStr)
          .maybeSingle();

        if (activitySummary) {
          if (activitySummary.steps !== null) updatePayload.steps = activitySummary.steps;
          if (activitySummary.active_calories !== null) updatePayload.active_calories = activitySummary.active_calories;
          if (activitySummary.total_calories !== null) updatePayload.total_calories = activitySummary.total_calories;
          if (activitySummary.distance_m !== null) updatePayload.distance_m = activitySummary.distance_m;
        }

        // Fetch sleep data for this date
        const { data: sleepData } = await supabaseAdmin
          .from("sleep_sessions")
          .select("duration_min")
          .eq("user_id", userId)
          .eq("sleep_date", dateStr);

        let sleepGotMin = null;
        if (sleepData && sleepData.length > 0) {
          sleepGotMin = sleepData.reduce((sum, s) => sum + (s.duration_min ?? 0), 0);
        }

        // Fetch baseline sleep and compute sleep coach metrics
        const { data: historicalMetrics } = await supabaseAdmin
          .from("daily_metrics")
          .select("sleep_duration_min, recovery_score, strain_score, sleep_debt_min")
          .eq("user_id", userId)
          .lt("date", dateStr)
          .order("date", { ascending: false })
          .limit(28);

        let baselineSleepMin = 480; // Default 8 hours
        if (historicalMetrics && historicalMetrics.length > 0) {
          const validSleep = historicalMetrics
            .map((m) => m.sleep_duration_min)
            .filter((s) => s !== null && s > 0);
          if (validSleep.length > 0) {
            baselineSleepMin = Math.round(
              validSleep.reduce((a, b) => a + b, 0) / validSleep.length
            );
          }
        }

        const sleepCoachMetrics = computeSleepCoachMetrics({
          sleepGotMin,
          sleepNeededMin: existingMetrics?.sleep_needed_min ?? null,
          baselineSleepMin,
          strainScore: existingMetrics?.strain_score ?? null,
          recoveryScore: existingMetrics?.recovery_score ?? null,
          sleepDebtMin: existingMetrics?.sleep_debt_min ?? null,
        });

        if (sleepCoachMetrics.sleepNeededMin !== null) updatePayload.sleep_needed_min = sleepCoachMetrics.sleepNeededMin;
        if (sleepCoachMetrics.sleepDebtMin !== null) updatePayload.sleep_debt_min = sleepCoachMetrics.sleepDebtMin;
        if (sleepCoachMetrics.sleepPerformancePct !== null) updatePayload.sleep_performance_pct = sleepCoachMetrics.sleepPerformancePct;
        if (sleepCoachMetrics.strainTargetLow !== null) updatePayload.strain_target_low = sleepCoachMetrics.strainTargetLow;
        if (sleepCoachMetrics.strainTargetHigh !== null) updatePayload.strain_target_high = sleepCoachMetrics.strainTargetHigh;

        // Update daily_metrics
        if (Object.keys(updatePayload).length > 0) {
          updatePayload.updated_at = new Date().toISOString();

          // Try to update existing record, or create if not exists
          const { error: updateErr } = await supabaseAdmin
            .from("daily_metrics")
            .upsert(
              {
                user_id: userId,
                date: dateStr,
                ...updatePayload,
              },
              { onConflict: "user_id,date" }
            );

          if (updateErr) throw updateErr;
        }
      }
    } catch (e) {
      // Log but don't fail the entire sync
      console.log(`Daily metrics computation error: ${(e as Error).message}`);
    }

    // Update last_synced_at
    const nowIso = new Date().toISOString();
    const { error: lastErr } = await supabaseAdmin
      .from("polar_connections")
      .update({ last_synced_at: nowIso })
      .eq("user_id", userId);

    if (lastErr) throw lastErr;

    return jsonResponse({
      ok: true,
      workoutsUpserted,
      sleepUpserted,
      nightlyRechargeUpserted,
      activitySummaryUpserted,
      continuousHrUpserted,
      datesTouched: Array.from(datesTouched).sort(),
      since: sinceDate.toISOString(),
      syncedAt: nowIso,
      note:
        "If Polar endpoints differ, update the `paths` object and mapping functions. Everything else should remain stable.",
    });
  } catch (e) {
    return jsonResponse(
      { ok: false, error: (e as Error)?.message ?? String(e) },
      500,
    );
  }
});
