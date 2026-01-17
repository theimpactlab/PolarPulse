// Supabase Edge Function:  sync-polar
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
    headers: { ... corsHeaders, "Content-Type":  "application/json" },
  });
}

function isJsonContentType(res: Response): boolean {
  const ct = res.headers.get("content-type") ??  "";
  return ct.toLowerCase().includes("application/json");
}

async function fetchJsonOrThrow<T>(
  url: string,
  init:  RequestInit,
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
      `${label} failed:  HTTP ${res.status}.  Body: ${bodyText || "<empty>"}`,
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
      `${label} failed: response said JSON but was not parseable.  Body: ${bodyText}`,
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
    method:  "POST",
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
  if (! res.ok) {
    throw new Error(
      `Token refresh failed: HTTP ${res.status}. Body: ${text || "<empty>"}`,
    );
  }

  let newTokens:  any;
  try {
    newTokens = JSON.parse(text);
  } catch {
    throw new Error(`Token refresh failed: response not JSON.  Body: ${text}`);
  }

  await supabase
    .from("oauth_tokens")
    .update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || token.refresh_token,
      expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "polar");

  return newTokens.access_token;
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

    console.log(`[syncSleep] Sleep response keys: ${Object.keys(sleepResponse ??  {})}`);

    if (!sleepResponse) {
      console.log(`[syncSleep] Empty response`);
      return 0;
    }

    const nightsList:  any[] = sleepResponse?. nights ??  [];
    console.log(`[syncSleep] Found ${nightsList.length} nights`);

    let synced = 0;

    for (const night of nightsList) {
      try {
        console.log(`[syncSleep] Processing night for date: ${night?. date}`);

        if (! night?.date) {
          console.log(`[syncSleep] No date in night data`);
          continue;
        }

        let durationSeconds = 0;

        if (night?. duration) {
          durationSeconds = night.duration;
        } else if (night?.sleep_start_time && night?.sleep_end_time) {
          const startTime = new Date(night.sleep_start_time).getTime();
          const endTime = new Date(night. sleep_end_time).getTime();
          durationSeconds = (endTime - startTime) / 1000;
        } else {
          console.log(`[syncSleep] No duration data for ${night?. date}`);
          durationSeconds = 0;
        }

        const sleepRecord = {
          user_id:  userId,
          polar_sleep_id: `${night?. date}_${night?.device_id || "unknown"}`,
          sleep_date: night?. date || null,
          bedtime: night?.sleep_start_time || null,
          wake_time: night?.sleep_end_time || null,
          duration_minutes: Math.round(durationSeconds / 60),
          deep_minutes: Math.round((night?.deep_sleep ??  0) / 60),
          light_minutes: Math.round((night?.light_sleep ?? 0) / 60),
          rem_minutes: Math.round((night?.rem_sleep ?? 0) / 60),
          awake_minutes: Math.round((night?.total_interruption_duration ?? 0) / 60),
          sleep_score: night?.sleep_score ??  null,
          raw_data: night,
        };

        console.log(
          `[syncSleep] Calculated duration: ${sleepRecord.duration_minutes} minutes from ${durationSeconds} seconds`,
        );
        console.log(`[syncSleep] Upserting sleep record for ${night?.date}`);

        await supabase. from("sleep_sessions").upsert(
          sleepRecord,
          { onConflict: "user_id,polar_sleep_id" },
        );

        synced++;
        console.log(`[syncSleep] Successfully upserted night ${synced}`);
      } catch (nightError) {
        console.error(`[syncSleep] Error processing night:  `, nightError);
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
  supabase:  any,
  userId: string,
  accessToken: string
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
      "Polar nightly recharge fetch"
    );

    const rechargeList: any[] = rechargeResponse?.recharges || [];
    console.log(`[syncNightlyRecharge] Found ${rechargeList.length} recharge records`);

    if (rechargeList.length === 0) return 0;

    let synced = 0;

    for (const recharge of rechargeList) {
      try {
        const date = recharge?.date;
        if (!date) continue;

        const hrv = recharge. heart_rate_variability_avg ??  null;
        const rhr = recharge.heart_rate_avg ?  Math.round(recharge.heart_rate_avg) : null;

        let recoveryScore = null;
        if (hrv && rhr && hrv > 0 && rhr > 0) {
          const hrvRatio = Math.min(hrv / 30, 1.5);
          const hrvComponent = hrvRatio * 100 * 0.4;

          const rhrRatio = Math.min(60 / rhr, 1.3);
          const rhrComponent = rhrRatio * 100 * 0.2;

          const sleepComponent = 70 * 0.3;

          const strainComponent = ((21 - 5) / 21) * 100 * 0.1;

          recoveryScore = Math.round(
            Math.min(100, Math.max(0, hrvComponent + rhrComponent + sleepComponent + strainComponent))
          );

          console.log(
            `[syncNightlyRecharge] Calculated recovery score for ${date}: ${recoveryScore} (HRV=${hrv}, RHR=${rhr})`
          );
        }

        console.log(`[syncNightlyRecharge] Updating metric for ${date}:  recovery_score=${recoveryScore}, HRV=${hrv}, RHR=${rhr}`);

        const { error } = await supabase
          .from("daily_metrics")
          .update({
            recovery_score: recoveryScore,
            hrv: hrv,
            resting_hr: rhr,
            nightly_recharge_status: recharge.nightly_recharge_status ??  null,
            ans_charge:  recharge.ans_charge ?? null,
            breathing_rate_avg: recharge.breathing_rate_avg ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("metric_date", date);

        if (error) {
          console.error(`[syncNightlyRecharge] Update error:  ${JSON.stringify(error)}`);
        } else {
          synced++;
          console.log(`[syncNightlyRecharge] Updated ${date}, synced count=${synced}`);
        }
      } catch (e) {
        console.error(`[syncNightlyRecharge] Exception:  ${e}`);
      }
    }

    console.log(`[syncNightlyRecharge] Completed:  synced ${synced} records`);
    return synced;
  } catch (e) {
    console.error(`[syncNightlyRecharge] Fatal:  ${e}`);
    return 0;
  }
}

async function syncActivities(
  supabase: any,
  userId: string,
  accessToken:  string
): Promise<number> {
  try {
    console. log(`[syncActivities] Starting for user ${userId}`);

    const activitiesUrl = "https://www.polaraccesslink.com/v3/users/activities";
    console.log(`[syncActivities] Fetching from ${activitiesUrl}`);

    const activitiesResponse = await fetchJsonOrThrow<any>(
      activitiesUrl,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
      "Polar activities fetch"
    );

    console.log(`[syncActivities] Response:  `, JSON.stringify(activitiesResponse).substring(0, 200));

    const activitiesList: any[] = activitiesResponse?.activities || [];
    console.log(`[syncActivities] Found ${activitiesList.length} activities`);

    if (activitiesList. length === 0) return 0;

    let synced = 0;

    for (const activity of activitiesList) {
      try {
        const date = activity?.date;
        if (! date) continue;

        console.log(`[syncActivities] Processing ${date}`);

        const { error } = await supabase
          .from("daily_metrics")
          .update({
            body_battery: activity.body_battery ??  null,
            total_workout_minutes: Math.round((activity.active_time ??  0) / 1000 / 60),
            total_calories:  activity.total_energy_expenditure ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("metric_date", date);

        if (error) {
          console.error(`[syncActivities] Update error:  ${JSON.stringify(error)}`);
        } else {
          synced++;
          console.log(`[syncActivities] Updated ${date}`);
        }
      } catch (e) {
        console.error(`[syncActivities] Exception: ${e}`);
      }
    }

    console.log(`[syncActivities] Completed: synced ${synced} records`);
    return synced;
  } catch (e) {
    console.error(`[syncActivities] Fatal: ${e}`);
    return 0;
  }
}

async function syncSkinTemperature(
  supabase: any,
  userId: string,
  accessToken: string
): Promise<number> {
  try {
    console.log(`[syncSkinTemperature] Starting for user ${userId}`);

    const skinTempUrl = "https://www.polaraccesslink.com/v3/users/biosensing/skintemperature";

    const skinTempResponse = await fetchJsonOrThrow<any>(
      skinTempUrl,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
      "Polar skin temperature fetch"
    );

    const skinTempList: any[] = skinTempResponse || [];
    console.log(`[syncSkinTemperature] Found ${skinTempList.length} skin temperature records`);

    if (skinTempList.length === 0) return 0;

    let synced = 0;

    for (const tempData of skinTempList) {
      try {
        const date = tempData?.sleep_date;
        if (!date) continue;

        console.log(`[syncSkinTemperature] Processing ${date}`);

        const { error } = await supabase
          .from("daily_metrics")
          .update({
            body_temperature_celsius: tempData.sleep_time_skin_temperature_celsius ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("metric_date", date);

        if (error) {
          console.error(`[syncSkinTemperature] Update error: ${JSON.stringify(error)}`);
        } else {
          synced++;
          console.log(`[syncSkinTemperature] Updated ${date}`);
        }
      } catch (e) {
        console.error(`[syncSkinTemperature] Exception: ${e}`);
      }
    }

    console.log(`[syncSkinTemperature] Completed: synced ${synced} records`);
    return synced;
  } catch (e) {
    console.error(`[syncSkinTemperature] Fatal: ${e}`);
    return 0;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env. get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error:  "Supabase not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    let bodyUserId: string | null = null;

    try {
      const body = await req.json();
      bodyUserId = body?. user_id ??  null;
    } catch {
      // ok
    }

    if (!bodyUserId) {
      return jsonResponse(
        { error: "No user found to sync (missing user_id in body)" },
        400,
      );
    }

    const results:  Array<{
      user_id:  string;
      success: boolean;
      synced?:  number;
      error?: string;
    }> = [];

    const { data:  token } = await supabase
      . from("oauth_tokens")
      .select("*")
      .eq("user_id", bodyUserId)
      .eq("provider", "polar")
      .single();

    if (!token) {
      return jsonResponse({
        results: [{ user_id: bodyUserId, success: false, error: "No Polar token found" }],
      });
    }

    let polarUserId: number | null = token.polar_user_id ?  Number(token.polar_user_id) : null;

    if (!polarUserId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("polar_user_id")
        .eq("id", bodyUserId)
        .single();

      if (profile?.polar_user_id) polarUserId = Number(profile.polar_user_id);
    }

    if (!polarUserId) {
      return jsonResponse({
        results: [
          {
            user_id: bodyUserId,
            success: false,
            error: "Missing polar_user_id on oauth_tokens.  Reconnect Polar so we can register with AccessLink.",
          },
        ],
      });
    }

    try {
      const accessToken = await refreshTokenIfNeeded(supabase, bodyUserId, token);

      console.log(`[sync-polar] Skipping syncExercises`);
      const exercisesSynced = 0;

      console.log(`[sync-polar] Calling syncSleep`);
      const sleepSynced = await syncSleep(supabase, bodyUserId, polarUserId, accessToken);
      console.log(`[sync-polar] Sleep synced: ${sleepSynced}`);

      console.log(`[sync-polar] Calling syncNightlyRecharge`);
      const rechargeSynced = await syncNightlyRecharge(supabase, bodyUserId, accessToken);
      console.log(`[sync-polar] Nightly recharge synced: ${rechargeSynced}`);

      console.log(`[sync-polar] Calling syncActivities`);
      const activitiesSynced = await syncActivities(supabase, bodyUserId, accessToken);
      console.log(`[sync-polar] Activities synced: ${activitiesSynced}`);

      console.log(`[sync-polar] Calling syncSkinTemperature`);
      const tempSynced = await syncSkinTemperature(supabase, bodyUserId, accessToken);
      console.log(`[sync-polar] Skin temperature synced:  ${tempSynced}`);

      results.push({ 
        user_id: bodyUserId, 
        success: true, 
        synced: exercisesSynced + sleepSynced + rechargeSynced + activitiesSynced + tempSynced 
      });

    } catch (e) {
      results.push({
        user_id: bodyUserId,
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    return jsonResponse({ results });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

export {};