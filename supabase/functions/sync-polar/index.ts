// Supabase Edge Function: sync-polar
// Deploy with: supabase functions deploy sync-polar
//
// This file is for reference - deploy to Supabase Edge Functions
// It uses Deno runtime which is not compatible with local TS checks


import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Scoring weights
const SCORING_WEIGHTS = {
  recovery: { hrv: 0.4, rhr: 0.2, sleep: 0.3, priorStrain: 0.1 },
  sleep: { durationVsNeed: 0.5, consistency: 0.3, disturbances: 0.2 },
};

async function refreshTokenIfNeeded(supabase: any, userId: string, token: any) {
  if (new Date(token.expires_at) > new Date()) {
    return token.access_token;
  }

  const response = await fetch("https://polarremote.com/v2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${Deno.env.get("POLAR_CLIENT_ID")}:${Deno.env.get("POLAR_CLIENT_SECRET")}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    }),
  });

  if (!response.ok) throw new Error("Token refresh failed");

  const newTokens = await response.json();

  await supabase.from("oauth_tokens").update({
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token || token.refresh_token,
    expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
  }).eq("user_id", userId).eq("provider", "polar");

  return newTokens.access_token;
}

async function syncExercises(supabase: any, userId: string, accessToken: string) {
  // Create transaction
  const txResponse = await fetch(
    "https://www.polaraccesslink.com/v3/users/this/exercise-transactions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (txResponse.status === 204) return 0; // No new data

  const tx = await txResponse.json();

  // List exercises
  const listResponse = await fetch(tx["resource-uri"], {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const exercises = await listResponse.json();
  let synced = 0;

  for (const exerciseUrl of exercises.exercises || []) {
    const exerciseResponse = await fetch(exerciseUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const exercise = await exerciseResponse.json();

    // Get HR zones
    let zones = { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 };
    try {
      const zonesResponse = await fetch(`${exerciseUrl}/zones`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (zonesResponse.ok) {
        const zonesData = await zonesResponse.json();
        zonesData["heart-rate"]?.forEach((z: any) => {
          const idx = z.index;
          const mins = Math.round((z["in-zone"]?.seconds || 0) / 60);
          if (idx >= 1 && idx <= 5) zones[`zone${idx}`] = mins;
        });
      }
    } catch {}

    // Calculate strain (TRIMP)
    const strain = (
      zones.zone1 * 1 + zones.zone2 * 2 + zones.zone3 * 3 +
      zones.zone4 * 4 + zones.zone5 * 5
    ) / 60;

    await supabase.from("workouts").upsert({
      user_id: userId,
      polar_exercise_id: exercise.id,
      workout_date: exercise["start-time"].split("T")[0],
      workout_type: exercise.sport || "workout",
      duration_minutes: Math.round((exercise.duration?.seconds || 0) / 60),
      calories: exercise.calories,
      avg_hr: exercise["heart-rate"]?.average,
      max_hr: exercise["heart-rate"]?.maximum,
      strain_score: Math.min(strain, 21),
      zone1_minutes: zones.zone1,
      zone2_minutes: zones.zone2,
      zone3_minutes: zones.zone3,
      zone4_minutes: zones.zone4,
      zone5_minutes: zones.zone5,
      raw_data: exercise,
    }, { onConflict: "user_id,polar_exercise_id" });

    synced++;
  }

  // Commit transaction
  await fetch(tx["resource-uri"], {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return synced;
}

async function syncSleep(supabase: any, userId: string, accessToken: string) {
  const txResponse = await fetch(
    "https://www.polaraccesslink.com/v3/users/this/sleep-transactions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (txResponse.status === 204) return 0;

  const tx = await txResponse.json();

  const listResponse = await fetch(tx["resource-uri"], {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const sleepData = await listResponse.json();
  let synced = 0;

  for (const sleepUrl of sleepData.sleeps || []) {
    const sleepResponse = await fetch(sleepUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const sleep = await sleepResponse.json();

    const durationMins = Math.round((sleep.duration?.seconds || 0) / 60);
    const sleepScore = Math.min(100, (durationMins / 480) * 100);

    await supabase.from("sleep_sessions").upsert({
      user_id: userId,
      polar_sleep_id: sleep.id,
      sleep_date: sleep.date,
      bedtime: sleep["sleep-start-time"],
      wake_time: sleep["sleep-end-time"],
      duration_minutes: durationMins,
      deep_minutes: sleep.hypnogram?.deep,
      light_minutes: sleep.hypnogram?.light,
      rem_minutes: sleep.hypnogram?.rem,
      awake_minutes: sleep.hypnogram?.awake,
      sleep_score: sleepScore,
      raw_data: sleep,
    }, { onConflict: "user_id,polar_sleep_id" });

    synced++;
  }

  await fetch(tx["resource-uri"], {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return synced;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    let users: any[] = [];

    // Check for user_id in request body first (for local/anonymous users)
    let bodyUserId: string | null = null;
    try {
      const body = await req.json();
      bodyUserId = body?.user_id;
    } catch {
      // No body or invalid JSON, that's ok
    }

    if (bodyUserId) {
      // User ID provided in body - use it directly
      users = [{ id: bodyUserId }];
    } else {
      // Try to get user from auth header
      const authHeader = req.headers.get("Authorization");
      if (authHeader && !authHeader.includes("anon")) {
        try {
          const { data: { user } } = await supabase.auth.getUser(
            authHeader.replace("Bearer ", "")
          );
          if (user) users = [{ id: user.id }];
        } catch {
          // Invalid JWT, continue to check for other options
        }
      }

      if (users.length === 0) {
        // Cron job - sync all connected users
        const { data } = await supabase
          .from("oauth_tokens")
          .select("user_id")
          .eq("provider", "polar");
        users = (data || []).map(t => ({ id: t.user_id }));
      }
    }

    if (users.length === 0) {
      return new Response(JSON.stringify({ error: "No user found to sync" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

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
        await supabase.from("sync_log").insert({
          user_id: user.id,
          sync_type: "polar",
          status: "error",
          error_message: error.message,
          completed_at: new Date().toISOString(),
        });

        results.push({ user_id: user.id, success: false, error: error.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


export {};
