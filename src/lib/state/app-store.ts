syncData: async () => {
  const result = await polarOAuthService.syncPolarData();
  if (!result.success) return result;

  // Pull latest data into Zustand so the UI updates
  const pulled = await polarOAuthService.pullLatestFromSupabase();
  if (!pulled.success) {
    // Sync happened, but fetching failed (likely RLS)
    return { success: false, error: pulled.error || "Synced but could not load data into app." };
  }

  // Map DB rows to your app types
  const mappedWorkouts: Workout[] = (pulled.workouts || []).map((w: any) => ({
    id: `polar_${w.polar_exercise_id}`,
    polarId: w.polar_exercise_id,
    date: w.workout_date,
    type: w.workout_type || "workout",
    durationMinutes: w.duration_minutes || 0,
    calories: w.calories || 0,
    avgHR: w.avg_hr || 0,
    maxHR: w.max_hr || 0,
    strainScore: w.strain_score ?? undefined,
    source: "polar",
  }));

  const mappedSleeps: SleepSession[] = (pulled.sleeps || []).map((s: any) => ({
    id: `polar_sleep_${s.polar_sleep_id}`,
    polarId: s.polar_sleep_id,
    date: s.sleep_date,
    sleepStart: s.bedtime ?? undefined,
    sleepEnd: s.wake_time ?? undefined,
    totalSleepMinutes: s.duration_minutes || 0,
    timeInBedMinutes: s.duration_minutes || 0,
    stages: {
      awake: s.awake_minutes || 0,
      light: s.light_minutes || 0,
      deep: s.deep_minutes || 0,
      rem: s.rem_minutes || 0,
    },
    source: "polar",
  }));

  set({
    workouts: mappedWorkouts,
    sleepSessions: mappedSleeps,
    lastSyncDate: new Date().toISOString(),
    isDemoMode: false,
  });

  return { success: true, synced: result.synced ?? 0 };
},