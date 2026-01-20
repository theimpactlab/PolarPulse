// Supabase Edge Function: sync-polar
// Deploy: supabase functions deploy sync-polar
//
// Purpose
// - Pull latest workouts + sleep from Polar (AccessLink) since last_synced_at
// - Upsert into: workouts, workout_hr_series, workout_hr_zones
//                sleep_sessions, sleep_stages, sleep_hr_series
// - Return counts + list of dates touched
//
// Notes
// - This function is intentionally defensive and configurable because Polar endpoints/payloads differ
//   depending on what you’ve enabled in AccessLink.
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