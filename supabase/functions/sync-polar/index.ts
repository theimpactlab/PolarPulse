// Supabase Edge Function: sync-polar
// Deploy with: supabase functions deploy sync-polar
//
// Deno runtime

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

async function readTextSafe(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isJsonContentType(res: Response): boolean {
  const ct = res.headers.get("content-type") ?? "";
  return ct.toLowerCase().includes("application/json");
}

async function fetchJsonOrThrow<T>(
  url: string,
  init: RequestInit,
  label: string,
): Promise<T> {
  const res = await fetch(url, init);

  if (res.status === 204) {
    // @ts-expect-error allow null
    return null;
  }

  const bodyText = await readTextSafe(res);

  if (!res.ok) {
    throw new Error(
      `${label} failed: HTTP ${res.status}. Body: ${bodyText || "<empty>"}`,
    );
  }

  if (!isJsonContentType(res)) {
    // @ts-expect-error allow string
    return bodyText as unknown as T;
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    throw new Error(
      `${label} failed: response said JSON but was not parseable. Body: ${bodyText}`,
    );
  }
}

async function refreshTokenIfNeeded(
  supabase: any,
  userId: string,
  token: any,
): Promise<string> {
  if (token.expires_at && new Date(token.expires_at) > new Date()) {
    return token.access_token;
  }

  const clientId = Deno.env.get("POLAR_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("POLAR_CLIENT_SECRET") ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("Missing POLAR_CLIENT_ID or POLAR_CLIENT_SECRET");
  }

  const res = await fetch("https://polarremote.com/v2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    }),
  });

  const text = await readTextSafe(res);
  if (!res.ok) {
    throw new Error(
      `Token refresh failed: HTTP ${res.status}. Body: ${text || "<empty>"}`,
    );
  }

  let newTokens: any;
  try {
    newTokens = JSON.parse(text);
  } catch {
    throw new Error(`Token refresh failed: response not JSON. Body: ${text}`);
  }

  await supabase
    .from("oauth_tokens")
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || token.refresh_token,
      expires_at: new Date(Date.now() + newTokens.expires_in * 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return newTokens.access_token;
}

/**
 * NEW: Fetch sleep score for a given date from your own DB.
 * This mirrors the "fetchSleepScore" idea in the suggested changes,
 * but uses the sleep_sessions table you already populate in syncSleep.
 */
async function fetchSleepScore(
  supabase: any,
  userId: string,
  date: string,
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from("sleep_sessions")
      .select("sleep_score")
      .eq("user_id", userId)
      .eq("sleep_date", date)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`[fetchSleepScore] DB error for ${date}: ${JSON.stringify(error)}`);
      return null;
    }

    const score = data?.sleep_score;
    if (score === undefined || score === null) return null;

    const num = Number(score);
    return Number.isFinite(num) ? num : null;
  } catch (e) {
    console.error(`[fetchSleepScore] Exception for ${date}:`, e);
    return null;
  }
}

/**
 * NEW: Recovery score calculation, taking sleepScore as an input.
 * Keeps your existing weights: HRV 0.4, RHR 0.2, Sleep 0.3, Strain 0.1.
 */
function calculateRecoveryScore(params: {
  hrv: number | null;
  rhr: number | null;
  sleepScore: number | null;
}): number | null {
  const { hrv, rhr, sleepScore } = params;

  if (!hrv || !rhr || hrv <= 0 || rhr <= 0) return null;

  const hrvRatio = Math.min(hrv / 30, 1.5);
  const hrvComponent = hrvRatio * 100 * 0.4;

  const rhrRatio = Math.min(60 / rhr, 1.3);
  const rhrComponent = rhrRatio * 100 * 0.2;

  // Sleep score expected 0-100 in Polar; if missing, treat as 0 contribution.
  const safeSleep = sleepScore && sleepScore > 0 ? Math.min(sleepScore, 100) : 0;
  const sleepComponent = safeSleep * 0.3;

  // Placeholder strain component (unchanged from your prior logic)
  const strainComponent = ((21 - 5) / 21) * 100 * 0.1;

  const score = hrvComponent + rhrComponent + sleepComponent + strainComponent;
  return Math.round(Math.min(100, Math.max(0, score)));
}

async function syncSleep(
  supabase: any,
  userId: string,
  polarUserId: number,
  accessToken: string,
): Promise<number> {
  try {
    console.log(`[syncSleep] Starting sleep sync for user ${userId}`);

    const sleepUrl = "https://www.polaraccesslink.com/v3/users/sleep";
    console.log(`[syncSleep] Fetching from ${sleepUrl}`);

    const sleepResponse = await fetchJsonOrThrow<any>(
      sleepUrl,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
      "Polar sleep fetch",
    );

    console.log(`[syncSleep] Sleep response keys: ${Object.keys(sleepResponse ?? {})}`);

    if (!sleepResponse) {
      console.log(`[syncSleep] Empty response`);
      return 0;
    }

    const nightsList: any[] = sleepResponse?.nights ?? [];
    console.log(`[syncSleep] Found ${nightsList.length} nights`);

    let synced = 0;

    for (const night of nightsList) {
      try {
        console.log(`[syncSleep] Processing night for date: ${night?.date}`);

        if (!night?.date) {
          console.log(`[syncSleep] No date in night data`);
          continue;
        }

        let durationSeconds = 0;

        if (night?.duration) {
          durationSeconds = night.duration;
        } else if (night?.sleep_start_time && night?.sleep_end_time) {
          const startTime = new Date(night.sleep_start_time).getTime();
          const endTime = new Date(night.sleep_end_time).getTime();
          durationSeconds = (endTime - startTime) / 1000;
        } else {
          console.log(`[syncSleep] No duration data for ${night?.date}`);
          durationSeconds = 0;
        }

        const sleepRecord = {
          user_id: userId,
          polar_sleep_id: `${night?.date}_${night?.device_id || "unknown"}`,
          sleep_date: night?.date || null,
          bedtime: night?.sleep_start_time || null,
          wake_time: night?.sleep_end_time || null,
          duration_minutes: Math.round(durationSeconds / 60),
          deep_minutes: Math.round((night?.deep_sleep ?? 0) / 60),
          light_minutes: Math.round((night?.light_sleep ?? 0) / 60),
          rem_minutes: Math.round((night?.rem_sleep ?? 0) / 60),
          awake_minutes: Math.round((night?.total_interruption_duration ?? 0) / 60),
          sleep_score: night?.sleep_score ?? null,
          raw_data: night,
          updated_at: new Date().toISOString(),
        };

        console.log(
          `[syncSleep] Calculated duration: ${sleepRecord.duration_minutes} minutes from ${durationSeconds} seconds`,
        );
        console.log(`[syncSleep] Upserting sleep record for ${night?.date}`);

        await supabase
          .from("sleep_sessions")
          .upsert(sleepRecord, { onConflict: "user_id,polar_sleep_id" });

        synced++;
        console.log(`[syncSleep] Successfully upserted night ${synced}`);
      } catch (nightError) {
        console.error(`[syncSleep] Error processing night:`, nightError);
        continue;
      }
    }

    console.log(`[syncSleep] Sleep sync complete, ${synced} nights synced`);
    return synced;
  } catch (e) {
    console.error("[syncSleep] Fatal error:", e);
    return 0;
  }
}

async function syncNightlyRecharge(
  supabase: any,
  userId: string,
  accessToken: string,
): Promise<number> {
  try {
    console.log(`[syncNightlyRecharge] Starting for user ${userId}`);

    const rechargeUrl = "https://www.polaraccesslink.com/v3/users/nightly-recharge";

    const rechargeResponse = await fetchJsonOrThrow<any>(
      rechargeUrl,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
      "Polar nightly recharge fetch",
    );

    const rechargeList: any[] = rechargeResponse?.recharges || [];
    console.log(`[syncNightlyRecharge] Found ${rechargeList.length} recharge records`);

    if (rechargeList.length === 0) return 0;

    let synced = 0;

    for (const recharge of rechargeList) {
      try {
        const date = recharge?.date;
        if (!date) continue;

        const hrv = recharge?.heart_rate_variability_avg ?? null;
        const rhr = recharge?.heart_rate_avg
          ? Math.round(recharge.heart_rate_avg)
          : null;

        // NEW: fetch sleep score for same date
        const sleepScore = await fetchSleepScore(supabase, userId, date);

        const recoveryScore = calculateRecoveryScore({
          hrv,
          rhr,
          sleepScore,
        });

        console.log(
          `[syncNightlyRecharge] ${date} inputs: HRV=${hrv}, RHR=${rhr}, sleepScore=${sleepScore}; recovery_score=${recoveryScore}`,
        );

        const { error } = await supabase
          .from("daily_metrics")
          .update({
            recovery_score: recoveryScore,
            hrv: hrv,
            resting_hr: rhr,
            nightly_recharge_status: recharge?.nightly_recharge_status ?? null,
            ans_charge: recharge?.ans_charge ?? null,
            breathing_rate_avg: recharge?.breathing_rate_avg ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("metric_date", date);

        if (error) {
          console.error(`[syncNightlyRecharge] Update error: ${JSON.stringify(error)}`);
        } else {
          synced++;
          console.log(`[syncNightlyRecharge] Updated ${date}, synced count=${synced}`);
        }
      } catch (e) {
        console.error(`[syncNightlyRecharge] Exception:`, e);
      }
    }

    console.log(`[syncNightlyRecharge] Completed: synced ${synced} records`);
    return synced;
  } catch (e) {
    console.error("[syncNightlyRecharge] Fatal error:", e);
    return 0;
  }
}

async function syncExercises(
  supabase: any,
  userId: string,
  accessToken: string,
): Promise<number> {
  try {
    console.log(`[syncExercises] Starting for user ${userId}`);

    const exercisesUrl = "https://www.polaraccesslink.com/v3/exercises";

    const clientId = Deno.env.get("POLAR_CLIENT_ID") ?? "";
    const clientSecret = Deno.env.get("POLAR_CLIENT_SECRET") ?? "";
    if (!clientId || !clientSecret) {
      throw new Error("Missing POLAR_CLIENT_ID or POLAR_CLIENT_SECRET");
    }

    const exercisesResponse = await fetchJsonOrThrow<any>(
      exercisesUrl,
      {
        headers: {
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          Accept: "application/json",
        },
      },
      "Polar exercises fetch",
    );

    const exercisesList: any[] = exercisesResponse?.exercises || [];
    console.log(`[syncExercises] Found ${exercisesList.length} exercises`);

    if (exercisesList.length === 0) return 0;

    let synced = 0;

    for (const exercise of exercisesList) {
      try {
        const exerciseId = exercise?.id;
        if (!exerciseId) continue;

        const { data: existing } = await supabase
          .from("workouts")
          .select("id")
          .eq("polar_exercise_id", exerciseId)
          .maybeSingle();

        if (existing) {
          console.log(`[syncExercises] Exercise ${exerciseId} already synced`);
          continue;
        }

        const startTime = new Date(exercise?.start_time);
        const endTime = new Date(exercise?.end_time);
        const durationMinutes = Math.round(
          (endTime.getTime() - startTime.getTime()) / 60000,
        );

        const { error } = await supabase.from("workouts").insert({
          user_id: userId,
          polar_exercise_id: exerciseId,
          type: exercise?.sport || "Exercise",
          date: exercise?.start_time?.split("T")[0],
          start_time: exercise?.start_time || null,
          end_time: exercise?.end_time || null,
          duration_minutes: durationMinutes,
          avg_hr: exercise?.heart_rate?.average || null,
          max_hr: exercise?.heart_rate?.maximum || null,
          calories: exercise?.calories || null,
          distance: exercise?.distance || null,
          created_at: new Date().toISOString(),
        });

        if (error) {
          console.error(`[syncExercises] Insert error: ${JSON.stringify(error)}`);
        } else {
          synced++;
          console.log(`[syncExercises] Inserted exercise ${exerciseId}`);
        }
      } catch (e) {
        console.error(`[syncExercises] Exception:`, e);
      }
    }

    console.log(`[syncExercises] Completed: synced ${synced} exercises`);
    return synced;
  } catch (e) {
    console.error("[syncExercises] Fatal error:", e);
    return 0;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, refreshToken } = await req.json();

    if (!userId || !refreshToken) {
      return jsonResponse({ error: "Missing userId or refreshToken" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: "Missing Supabase env vars" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: token } = await supabase
      .from("oauth_tokens")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!token) {
      return jsonResponse({ error: "No token found for user" }, 400);
    }

    const accessToken = await refreshTokenIfNeeded(supabase, userId, token);

    const sleepSynced = await syncSleep(
      supabase,
      userId,
      token.polar_user_id,
      accessToken,
    );

    const rechargeSynced = await syncNightlyRecharge(
      supabase,
      userId,
      accessToken,
    );

    const exercisesSynced = await syncExercises(
      supabase,
      userId,
      accessToken,
    );

    return jsonResponse({
      success: true,
      sleepSynced,
      rechargeSynced,
      exercisesSynced,
    });
  } catch (error) {
    console.error("Serve error:", error);
    return jsonResponse({ error: error?.message || "Unknown error" }, 500);
  }
});