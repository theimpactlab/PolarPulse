// Supabase Edge Function:  sync-polar
// Deploy with: supabase functions deploy sync-polar
//
// Deno runtime

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": 
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":  "POST,OPTIONS",
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
  label: string
): Promise<T> {
  const res = await fetch(url, init);

  if (res.status === 204) {
    // @ts-expect-error allow null
    return null;
  }

  const bodyText = await readTextSafe(res);

  if (!res.ok) {
    throw new Error(`${label} failed:  HTTP ${res.status}.  Body: ${bodyText || "<empty>"}`);
  }

  if (!isJsonContentType(res)) {
    // @ts-expect-error allow string
    return bodyText as unknown as T;
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    throw new Error(`${label} failed: response said JSON but was not parseable.  Body: ${bodyText}`);
  }
}

async function refreshTokenIfNeeded(
  supabase: any,
  userId: string,
  token: any
): Promise<string> {
  if (token.expires_at && new Date(token.expires_at) > new Date()) return token.access_token;

  const clientId = Deno.env.get("POLAR_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("POLAR_CLIENT_SECRET") ?? "";
  if (!clientId || !clientSecret) throw new Error("Missing POLAR_CLIENT_ID or POLAR_CLIENT_SECRET");

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
  if (! res.ok) throw new Error(`Token refresh failed: HTTP ${res.status}. Body: ${text || "<empty>"}`);

  let newTokens:  any;
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
      expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "polar");

  return newTokens.access_token;
}

async function syncExercises(
  supabase: any,
  userId: string,
  polarUserId: number,
  accessToken: string
): Promise<number> {
  const tx = await fetchJsonOrThrow<any>(
    `https://www.polaraccesslink.com/v3/users/${polarUserId}/exercise-transactions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    },
    "Polar exercise transaction create"
  );

  if (! tx) return 0;

  const resourceUri = tx?. ["resource-uri"];
  if (!resourceUri || typeof resourceUri !== "string") {
    throw new Error("Polar exercise transaction create:  missing resource-uri");
  }

  const exercises = await fetchJsonOrThrow<any>(
    resourceUri,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
    "Polar exercise transaction list"
  );

  const list:  string[] = exercises?.exercises ??  [];
  let synced = 0;

  for (const exerciseUrl of list) {
    const exercise = await fetchJsonOrThrow<any>(
      exerciseUrl,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
      "Polar exercise fetch"
    );

    await supabase. from("workouts").upsert(
      {
        user_id: userId,
        polar_exercise_id: exercise?. id,
        workout_date: String(exercise?.["start-time"] ?? "").split("T")[0] || null,
        workout_type: exercise?.sport || "workout",
        duration_minutes: Math.round(((exercise?.duration?. seconds ?? 0) as number) / 60),
        calories:  exercise?.calories ?? null,
        avg_hr: exercise?.["heart-rate"]?.average ?? null,
        max_hr: exercise?.["heart-rate"]?.maximum ?? null,
        raw_data: exercise,
      },
      { onConflict: "user_id,polar_exercise_id" }
    );

    synced++;
  }

  await fetchJsonOrThrow<any>(
    resourceUri,
    { method: "PUT", headers: { Authorization: `Bearer ${accessToken}` } },
    "Polar exercise transaction commit"
  );

  return synced;
}

// ✅ CORRECTED: Sleep sync with proper duration calculation
async function syncSleep(
  supabase: any,
  userId: string,
  polarUserId: number,
  accessToken: string
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
      "Polar sleep fetch"
    );

    console.log(`[syncSleep] Sleep response keys: ${Object.keys(sleepResponse ??   {})}`);

    if (!sleepResponse) {
      console.log(`[syncSleep] Empty response`);
      return 0;
    }

    const nightsList:   any[] = sleepResponse?. nights ??  [];
    console.log(`[syncSleep] Found ${nightsList.length} nights`);

    let synced = 0;

    for (const night of nightsList) {
      try {
        console.log(`[syncSleep] Processing night for date:   ${night?. date}`);

        if (! night?.date) {
          console.log(`[syncSleep] No date in night data`);
          continue;
        }

        // ✅ FIXED:  Correctly calculate duration from Polar data
        // Polar returns sleep duration in seconds in the 'duration' field
        // But we also need to calculate it from sleep_end_time - sleep_start_time
        let durationSeconds = 0;
        
        if (night?.duration) {
          // Use duration if available (in seconds from Polar)
          durationSeconds = night. duration;
        } else if (night?.sleep_start_time && night?.sleep_end_time) {
          // Fallback:  calculate from start/end times
          const startTime = new Date(night.sleep_start_time).getTime();
          const endTime = new Date(night.sleep_end_time).getTime();
          durationSeconds = (endTime - startTime) / 1000;
        } else {
          console.log(`[syncSleep] No duration data for ${night?. date}`);
          durationSeconds = 0;
        }

        const sleepRecord = {
          user_id: userId,
          polar_sleep_id: `${night?.date}_${night?.device_id || "unknown"}`,
          sleep_date: night?. date || null,
          bedtime: night?.sleep_start_time || null,
          wake_time: night?.sleep_end_time || null,
          // ✅ FIXED: Convert seconds to minutes
          duration_minutes: Math.round(durationSeconds / 60),
          // ✅ Sleep stages are already in seconds from Polar, convert to minutes
          deep_minutes: Math.round(((night?.deep_sleep ??  0) / 60)),
          light_minutes: Math. round(((night?.light_sleep ?? 0) / 60)),
          rem_minutes: Math.round(((night?.rem_sleep ?? 0) / 60)),
          // ✅ Total interruption as awake time
          awake_minutes: Math.round(((night?.total_interruption_duration ?? 0) / 60)),
          // ✅ Sleep score (0-100)
          sleep_score: night?.sleep_score ??  null,
          raw_data: night,
        };

        console.log(`[syncSleep] Calculated duration: ${sleepRecord.duration_minutes} minutes from ${durationSeconds} seconds`);
        console.log(`[syncSleep] Upserting sleep record for ${night?.date}`);

        await supabase. from("sleep_sessions").upsert(
          sleepRecord,
          { onConflict: "user_id,polar_sleep_id" }
        );

        synced++;
        console.log(`[syncSleep] Successfully upserted night ${synced}`);
      } catch (nightError) {
        console.error(`[syncSleep] Error processing night:   `, nightError);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env. get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Supabase not configured" }, 500);

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
      return jsonResponse({ error:  "No user found to sync (missing user_id in body)" }, 400);
    }

    const results:  Array<{ user_id: string; success: boolean; synced?:  number; error?: string }> = [];

    const { data: token } = await supabase
      . from("oauth_tokens")
      .select("*")
      .eq("user_id", bodyUserId)
      .eq("provider", "polar")
      .single();

    if (!token) {
      return jsonResponse({
        results:  [{ user_id: bodyUserId, success: false, error: "No Polar token found" }],
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
            error: 
              "Missing polar_user_id on oauth_tokens.  Reconnect Polar so we can register with AccessLink.",
          },
        ],
      });
    }

    try {
      const accessToken = await refreshTokenIfNeeded(supabase, bodyUserId, token);

      // ✅ Sync both exercises and sleep
      const exercisesSynced = await syncExercises(supabase, bodyUserId, polarUserId, accessToken);
      const sleepSynced = await syncSleep(supabase, bodyUserId, polarUserId, accessToken);

      results.push({ user_id: bodyUserId, success: true, synced: exercisesSynced + sleepSynced });
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