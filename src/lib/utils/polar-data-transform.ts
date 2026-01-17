/**
 * Data transformation utilities
 * Converts Polar API responses to internal data structures
 */

import type { Workout, SleepSession, DailyMetrics } from '@/lib/state/app-store';

/**
 * Transform Polar exercise response to Workout
 */
export function transformExerciseToWorkout(exercise: any): Workout {
  const id = exercise.id || `exercise_${Date.now()}`;
  const date = exercise.start_time ? exercise.start_time.split('T')[0] : new Date().toISOString().split('T')[0];
  
  // Calculate duration in minutes
  const durationSeconds = exercise.duration || 0;
  const durationMinutes = Math.round(durationSeconds / 60);

  // Calculate strain score (0-21 scale based on training load)
  const sport = exercise.sport?.toLowerCase() || 'unknown';
  const avgHR = exercise.heart_rate?.average || 0;
  const maxHR = exercise.heart_rate?.maximum || 0;
  const calories = exercise.calories || 0;
  
  // Simple strain calculation:  intensity based on HR and duration
  let strainScore = 0;
  if (avgHR > 0) {
    const intensity = Math.min(100, (avgHR / 200) * 100); // Normalized to 200 bpm max
    strainScore = (intensity * durationMinutes) / 100; // Scale to approximate 0-21
  }

  // Parse HR zones if available
  const hrZones = exercise.heart_rate?. zone_distribution?. map((zone: any, idx: number) => ({
    zone: idx + 1,
    minutes: zone.duration ?  Math.round(zone.duration / 60) : 0,
  })) || [];

  return {
    id,
    polarId: exercise.id,
    date,
    type: formatSportType(sport),
    durationMinutes,
    calories,
    avgHR,
    maxHR,
    strainScore:  Math.round(strainScore * 10) / 10,
    hrZones,
    source: 'polar',
  };
}

/**
 * Transform Polar sleep response to SleepSession
 */
export function transformSleepToSession(sleep: any): SleepSession {
  const id = sleep.id || `sleep_${sleep.sleep_date || Date.now()}`;
  const date = sleep.sleep_date || new Date().toISOString().split('T')[0];

  // Parse sleep times
  const sleepStart = sleep.sleep_start_time || undefined;
  const sleepEnd = sleep.sleep_end_time || undefined;

  // Calculate durations
  const totalSleepMinutes = sleep.duration ?  Math.round(sleep.duration / 60) : 0;
  const timeInBedMinutes = totalSleepMinutes; // Approximation

  // Parse sleep stages (Polar returns in milliseconds or percentages)
  const stages = {
    awake: sleep.sleep_phase_data?. AWAKE ?  Math.round(sleep.sleep_phase_data.AWAKE / 60) : 0,
    light: sleep.sleep_phase_data?.LIGHT ? Math.round(sleep.sleep_phase_data. LIGHT / 60) : 0,
    deep: sleep. sleep_phase_data?.DEEP ? Math.round(sleep.sleep_phase_data.DEEP / 60) : 0,
    rem: sleep.sleep_phase_data?.REM ? Math.round(sleep.sleep_phase_data. REM / 60) : 0,
  };

  // Sleep score (0-100)
  const sleep_score = sleep.sleep_score || calculateSleepScore(totalSleepMinutes, stages);

  return {
    id,
    polarId: sleep.id,
    date,
    sleepStart,
    sleepEnd,
    totalSleepMinutes,
    timeInBedMinutes,
    stages,
    sleep_score,
    source: 'polar',
  };
}

/**
 * Calculate daily metrics from aggregated data
 */
export function calculateDailyMetrics(
  date: string,
  workouts: Workout[],
  sleepData?:  SleepSession,
  cardioLoad?: any,
  hrData?: any
): DailyMetrics {
  // Aggregate strain from workouts
  const dayWorkouts = workouts.filter(w => w.date === date);
  const totalStrain = dayWorkouts.reduce((sum, w) => sum + (w.strainScore || 0), 0);
  const strainScore = dayWorkouts.length > 0 ? totalStrain :  0;

  // Sleep metrics
  const sleepScore = sleepData?. sleep_score || 0;

  // HRV and RHR from heart rate data
  const hrv = hrData?.hrv || 0;
  const rhr = hrData?.resting_hr || 0;

  // Calculate recovery score (simplified)
  const recoveryScore = calculateRecoveryScore(hrv, rhr, sleepScore);

  // Training load status
  const trainingLoad = cardioLoad?.acute_load || 0;
  const chronicLoad = cardioLoad?.chronic_load || 0;
  const trainingLoadStatus = getLoadStatus(trainingLoad, chronicLoad);

  return {
    date,
    recoveryScore,
    strainScore,
    sleepScore:  Math.round(sleepScore),
    bodyBattery: calculateBodyBattery(recoveryScore, trainingLoad),
    trainingLoad,
    trainingLoadStatus,
    hrv,
    rhr,
  };
}

/**
 * Format sport type to readable string
 */
function formatSportType(sport: string): string {
  const sportMap:  Record<string, string> = {
    running: 'Running',
    cycling: 'Cycling',
    swimming: 'Swimming',
    walking: 'Walking',
    strength_training: 'Strength Training',
    gym: 'Gym',
    hiit: 'HIIT',
    basketball: 'Basketball',
    soccer: 'Soccer',
    tennis: 'Tennis',
    yoga: 'Yoga',
  };
  return sportMap[sport] || sport. charAt(0).toUpperCase() + sport.slice(1);
}

/**
 * Calculate sleep score (0-100)
 */
function calculateSleepScore(totalMinutes: number, stages: any): number {
  const goalMinutes = 480; // 8 hours
  let score = 100;

  // Duration score (40%)
  if (totalMinutes < goalMinutes) {
    score -= (40 * (goalMinutes - totalMinutes)) / goalMinutes;
  }

  // Deep sleep bonus (30%)
  const deepSleepPercent = (stages.deep / totalMinutes) * 100;
  if (deepSleepPercent >= 15) {
    // Good deep sleep
  } else if (deepSleepPercent < 10) {
    score -= 20;
  }

  // REM sleep bonus (20%)
  const remPercent = (stages.rem / totalMinutes) * 100;
  if (remPercent < 20) {
    score -= 15;
  }

  // Awake time penalty (10%)
  const awakePercent = (stages.awake / totalMinutes) * 100;
  if (awakePercent > 10) {
    score -= Math.min(10, awakePercent - 10);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate recovery score (0-100)
 */
function calculateRecoveryScore(hrv: number, rhr: number, sleepScore: number): number {
  let score = 50; // Base score

  // HRV component (40%)
  // Higher HRV = better recovery (normalize to 0-100)
  if (hrv > 0) {
    const hrvScore = Math.min(100, (hrv / 100) * 100); // Normalize assuming ~100ms is excellent
    score += (hrvScore * 40) / 100;
  }

  // RHR component (30%)
  // Lower RHR = better recovery (assume 60 bpm is good baseline)
  if (rhr > 0) {
    const rhrScore = Math.max(0, 100 - ((rhr - 40) * 100) / 60); // Scale 40-100 bpm
    score += (rhrScore * 30) / 100;
  }

  // Sleep component (30%)
  score += (sleepScore * 30) / 100;

  return Math.max(0, Math. min(100, Math.round(score)));
}

/**
 * Calculate body battery (0-100)
 */
function calculateBodyBattery(recoveryScore: number, trainingLoad: number): number {
  // Body battery decreases with high training load, increases with recovery
  let battery = recoveryScore;
  
  // Reduce battery based on training load
  const loadPenalty = Math.min(50, trainingLoad * 5); // Max 50% reduction
  battery -= loadPenalty;

  return Math.max(0, Math. min(100, Math.round(battery)));
}

/**
 * Get training load status
 */
function getLoadStatus(acuteLoad: number, chronicLoad: number): string {
  const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;

  if (ratio > 1.3) return 'overreaching';
  if (ratio > 1.1) return 'high';
  if (ratio > 0.8) return 'maintaining';
  if (ratio > 0.5) return 'low';
  return 'unbalanced';
}