// Supabase Edge Function: sync-polar
// Deploy with: supabase functions deploy sync-polar
//
// Deno runtime

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

// Scoring weights (unused currently, kept for future expansion)
const SCORING_WEIGHTS = {
  recovery: { hrv: 0.4, rhr: 0.2, sleep: 0.3, priorStrain: 0.1 },
  sleep: { durationVsNeed: 0.5, consistency: 0.3, disturbances: 0.2 },
};

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

async function readTextSafe(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function isJsonContentType(res: Response): boolean {
  const ct = res.headers.get("content-type") ?? "";
  return ct.toLowerCase().includes("application/json");
}

async function fetchJsonOrThrow<T extends JsonValue>(
  url: string,
  init: RequestInit,
  label: string
): Promise<T> {
  const res = await fetch(url, init);

  // Special-case: AccessLink returns 204 when no new data
  // (callers handle that separately, but we keep here for safety)
  if (res.status === 204) {
    // @ts-expect-error allow caller to interpret null for 204
    return null;
  }

  const bodyText = await readTextSafe(res);

  if (!res.ok) {
    // Try to include any JSON error details if present, otherwise raw text
    let detail = bodyText;
    if (isJsonContentType(res)) {
      try {
        const parsed = JSON.parse(bodyText);
        detail = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
      } catch {
        // keep as text
      }
    }

    throw new Error(`${label} failed: HTTP ${res.status}. Body: ${detail || "<empty>"}`);
  }

  // If it’s JSON, parse it. If it isn't, return as string to avoid JSON parse crash.
  if (!isJsonContentType(res)) {
    // @ts-expect-error allow returning string for non-json ok responses
    return bodyText as T;
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    throw new Error(`${label} failed: response said JSON but was not parseable. Body: ${bodyText}`);
  }
}

async function refreshTokenIfNeeded(supabase: any, userId: string, token: any): Promise<string> {
  // token.expires_at in DB is ISO string in this project
  if (new Date(token.expires_at) > new Date()) {
    return token.access_token;
  }

  const clientId = Deno.env.get("POLAR_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("POLAR_CLIENT_SECRET") ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("Polar OAuth not configured: missing POLAR_CLIENT_ID or POLAR_CLIENT_SECRET");
  }

  const authHeader = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;

  const res = await fetch("https://polarremote.com/v2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: authHeader,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    }),
  });

  const bodyText = await readTextSafe(res);

  if (!res.ok) {
    throw new Error(`Token refresh failed: HTTP ${res.status}. Body: ${bodyText || "<empty>"}`);
  }

  let newTokens: any;
  try {
    newTokens = JSON.parse(bodyText);
  } catch {
    throw new Error(`Token refresh failed: response not JSON. Body: ${bodyText}`);
  }

  await supabase
    .from("oauth_tokens")
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || token.refresh_token,
      expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "polar");

  return newTokens.access_token;
}

async function syncExercises(supabase: any, userId: string, accessToken: string): Promise<number> {
  const txRes = await fetch(
    "https://www.polaraccesslink.com/v3/users/this/exercise-transactions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (txRes.status === 204) return 0; // No new data

  // IMPORTANT: handle non-JSON bodies and non-OK responses
  const txText = await readTextSafe(txRes);
  if (!txRes.ok) {
    throw new Error(
      `Polar exercise transaction create failed: HTTP ${txRes.status}. Body: ${txText || "<empty>"}`
    );
  }

  let tx: any;
  try {
    tx = JSON.parse(txText);
  } catch {
    throw new Error(`Polar exercise transaction create returned non-JSON. Body: ${txText}`);
  }

  const resourceUri = tx?.["resource-uri"];
  if (!resourceUri || typeof resourceUri !== "string") {
    throw new Error(`Polar exercise transaction create missing resource-uri. Body: ${txText}`);
  }

  const exercises = await fetchJsonOrThrow<any>(
    resourceUri,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    "Polar exercise transaction list"
  );

  const list = exercises?.exercises ?? [];
  let synced = 0;

  for (const exerciseUrl of list) {
    if (typeof exerciseUrl !== "string") continue;

    const exercise = await fetchJsonOrThrow<any>(
      exerciseUrl,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      "Polar exercise fetch"
    );

    // Get HR zones (best-effort)
    let zones: Record<string, number> = { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 };
    try {
      const zonesRes = await fetch(`${exerciseUrl}/zones`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (zonesRes.ok) {
        const zonesText = await readTextSafe(zonesRes);
        if (zonesText) {
          let zonesData: any;
          try {
            zonesData = JSON.parse(zonesText);
          } catch {
            zonesData = null;
          }

          zonesData?.["heart-rate"]?.forEach((z: any) => {
            const idx = z?.index;
            const mins = Math.round(((z?.["in-zone"]?.seconds ?? 0) as number) / 60);
            if (idx >= 1 && idx <= 5) zones[`zone${idx}`] = mins;
          });
        }
      }
    } catch {
      // ignore zones issues
    }

    // Calculate strain (simple weighted zone minutes)
    const strain =
      (zones.zone1 * 1 +
        zones.zone2 * 2 +
        zones.zone3 * 3 +
        zones.zone4 * 4 +
        zones.zone5 * 5) /
      60;

    await supabase.from("workouts").upsert(
      {
        user_id: userId,
        polar_exercise_id: exercise?.id,
        workout_date: String(exercise?.["start-time"] ?? "").split("T")[0] || null,
        workout_type: exercise?.sport || "workout",
        duration_minutes: Math.round(((exercise?.duration?.seconds ?? 0) as number) / 60),
        calories: exercise?.calories ?? null,
        avg_hr: exercise?.["heart-rate"]?.average ?? null,
        max_hr: exercise?.["heart-rate"]?.maximum ?? null,
        strain_score: Math.min(strain, 21),
        zone1_minutes: zones.zone1,
        zone2_minutes: zones.zone2,
        zone3_minutes: zones.zone3,
        zone4_minutes: zones.zone4,
        zone5_minutes: zones.zone5,
        raw_data: exercise,
      },
      { onConflict: "user_id,polar_exercise_id" }
    );

    synced++;
  }

  // Commit transaction
  await fetchJsonOrThrow<any>(
    resourceUri,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    "Polar exercise transaction commit"
  );

  return synced;
}

async function syncSleep(supabase: any, userId: string, accessToken: string): Promise<number> {
  const txRes = await fetch("https://www.polaraccesslink.com/v3/users/this/sleep-transactions", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (txRes.status === 204) return 0;

  const txText = await readTextSafe(txRes);
  if (!txRes.ok) {
    throw new Error(`Polar sleep transaction create failed: HTTP ${txRes.status}. Body: ${txText || "<empty>"}`);
  }

  let tx: any;
  try {
    tx = JSON.parse(txText);
  } catch {
    throw new Error(`Polar sleep transaction create returned non-JSON. Body: ${txText}`);
  }

  const resourceUri = tx?.["resource-uri"];
  if (!resourceUri || typeof resourceUri !== "string") {
    throw new Error(`Polar sleep transaction create missing resource-uri. Body: ${txText}`);
  }

  const sleepData = await fetchJsonOrThrow<any>(
    resourceUri,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    "Polar sleep transaction list"
  );

  const list = sleepData?.sleeps ?? [];
  let synced = 0;

  for (const sleepUrl of list) {
    if (typeof sleepUrl !== "string") continue;

    const sleep = await fetchJsonOrThrow<any>(
      sleepUrl,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      "Polar sleep fetch"
    );

    const durationMins = Math.round(((sleep?.duration?.seconds ?? 0) as number) / 60);
    const sleepScore = Math.min(100, (durationMins / 480) * 100);

    await supabase.from("sleep_sessions").upsert(
      {
        user_id: userId,
        polar_sleep_id: sleep?.id,
        sleep_date: sleep?.date ?? null,
        bedtime: sleep?.["sleep-start-time"] ?? null,
        wake_time: sleep?.["sleep-end-time"] ?? null,
        duration_minutes: durationMins,
        deep_minutes: sleep?.hypnogram?.deep ?? null,
        light_minutes: sleep?.hypnogram?.light ?? null,
        rem_minutes: sleep?.hypnogram?.rem ?? null,
        awake_minutes: sleep?.hypnogram?.awake ?? null,
        sleep_score: sleepScore,
        raw_data: sleep,
      },
      { onConflict: "user_id,polar_sleep_id" }
    );

    synced++;
  }

  await fetchJsonOrThrow<any>(
    resourceUri,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    "Polar sleep transaction commit"
  );

  return synced;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Supabase not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    let users: Array<{ id: string }> = [];

    // 1) user_id in JSON body (your web flow uses this)
    let bodyUserId: string | null = null;
    try {
      const body = await req.json();
      bodyUserId = body?.user_id ?? null;
    } catch {
      // ok
    }

    if (bodyUserId) {
      users = [{ id: bodyUserId }];
    } else {
      // 2) auth header (optional)
      const authHeader = req.headers.get("Authorization");
      if (authHeader && !authHeader.includes("anon")) {
        try {
          const jwt = authHeader.replace("Bearer ", "");
          const { data: { user } } = await supabase.auth.getUser(jwt);
          if (user?.id) users = [{ id: user.id }];
        } catch {
          // ignore
        }
      }

      // 3) cron job fallback (sync all connected users)
      if (users.length === 0) {
        const { data } = await supabase
          .from("oauth_tokens")
          .select("user_id")
          .eq("provider", "polar");
        users = (data || []).map((t: any) => ({ id: t.user_id }));
      }
    }

    if (users.length === 0) {
      return new Response(JSON.stringify({ error: "No user found to sync" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ user_id: string; success: boolean; synced?: number; error?: string }> = [];

    for (const user of users) {
      const { data: token } = await supabase
        .from("oauth_tokens")
        .select("*")
        .eq("user_id", user.id)
        .eq("provider", "polar")
        .single();

      if (!token) {
        results.push({ user_id: user.id, success: false, error: "No Polar token found" });
        continue;
      }

      try {
        const accessToken = await refreshTokenIfNeeded(supabase, user.id, token);

        const exercisesSynced = await syncExercises(supabase, user.id, accessToken);
        const sleepSynced = await syncSleep(supabase, user.id, accessToken);

        await supabase.from("sync_log").insert({
          user_id: user.id,
          sync_type: "polar",
          status: "success",
          records_synced: exercisesSynced + sleepSynced,
          completed_at: new Date().toISOString(),
        });

        results.push({ user_id: user.id, success: true, synced: exercisesSynced + sleepSynced });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);

        await supabase.from("sync_log").insert({
          user_id: user.id,
          sync_type: "polar",
          status: "error",
          error_message: msg,
          completed_at: new Date().toISOString(),
        });

        results.push({ user_id: user.id, success: false, error: msg });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export {};