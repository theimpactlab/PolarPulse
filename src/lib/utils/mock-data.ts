import type { Workout, SleepSession, DailyMetrics, Baselines, Insight, HRZone, BodyBatteryReading, TrainingLoadHistory } from '@/lib/state/app-store';
import {
  calculateRecoveryScore,
  calculateSleepScore,
  calculateStrainScore,
  calculateSleepConsistency,
} from './scoring';

/**
 * Generate mock data for demonstration purposes
 * This creates realistic-looking fitness data for the past N days
 */

// Workout types with typical metrics
const WORKOUT_TYPES = [
  { type: 'Running', avgHR: 155, maxHR: 175, calories: 450, duration: 45 },
  { type: 'Cycling', avgHR: 145, maxHR: 165, calories: 380, duration: 60 },
  { type: 'Strength Training', avgHR: 125, maxHR: 150, calories: 280, duration: 50 },
  { type: 'HIIT', avgHR: 165, maxHR: 185, calories: 350, duration: 30 },
  { type: 'Swimming', avgHR: 140, maxHR: 160, calories: 400, duration: 45 },
  { type: 'Yoga', avgHR: 95, maxHR: 110, calories: 150, duration: 60 },
  { type: 'Walking', avgHR: 100, maxHR: 120, calories: 200, duration: 40 },
];

function randomVariation(base: number, variance: number): number {
  return Math.round(base + (Math.random() - 0.5) * 2 * variance);
}

function generateHRZones(durationMinutes: number, intensity: 'low' | 'moderate' | 'high'): HRZone[] {
  const zones: HRZone[] = [];
  let remaining = durationMinutes;

  // Distribution based on intensity
  const distributions = {
    low: [0.3, 0.4, 0.2, 0.08, 0.02],
    moderate: [0.1, 0.25, 0.35, 0.2, 0.1],
    high: [0.05, 0.1, 0.25, 0.35, 0.25],
  };

  const dist = distributions[intensity];
  for (let i = 0; i < 5; i++) {
    const minutes = Math.round(durationMinutes * dist[i] * (0.8 + Math.random() * 0.4));
    zones.push({ zone: i + 1, minutes: Math.min(minutes, remaining) });
    remaining -= zones[i].minutes;
  }

  return zones;
}

export function generateMockWorkouts(days: number = 30): Workout[] {
  const workouts: Workout[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];

    // 60% chance of workout on any given day
    if (Math.random() > 0.4) {
      const workoutType = WORKOUT_TYPES[Math.floor(Math.random() * WORKOUT_TYPES.length)];
      const duration = randomVariation(workoutType.duration, 15);
      const avgHR = randomVariation(workoutType.avgHR, 10);
      const maxHR = randomVariation(workoutType.maxHR, 8);
      const calories = randomVariation(workoutType.calories, 50);

      const intensity = avgHR > 150 ? 'high' : avgHR > 130 ? 'moderate' : 'low';
      const hrZones = generateHRZones(duration, intensity);
      const strainScore = calculateStrainScore(duration, avgHR, maxHR, hrZones);

      workouts.push({
        id: `workout-${dateStr}-${Math.random().toString(36).substr(2, 9)}`,
        date: dateStr,
        type: workoutType.type,
        durationMinutes: duration,
        calories,
        avgHR,
        maxHR,
        hrZones,
        strainScore,
        source: 'demo',
      });

      // 20% chance of second workout
      if (Math.random() > 0.8) {
        const workout2Type = WORKOUT_TYPES[Math.floor(Math.random() * WORKOUT_TYPES.length)];
        const duration2 = randomVariation(workout2Type.duration, 10);
        const avgHR2 = randomVariation(workout2Type.avgHR, 8);
        const maxHR2 = randomVariation(workout2Type.maxHR, 8);
        const hrZones2 = generateHRZones(duration2, avgHR2 > 150 ? 'high' : 'moderate');

        workouts.push({
          id: `workout-${dateStr}-2-${Math.random().toString(36).substr(2, 9)}`,
          date: dateStr,
          type: workout2Type.type,
          durationMinutes: duration2,
          calories: randomVariation(workout2Type.calories, 40),
          avgHR: avgHR2,
          maxHR: maxHR2,
          hrZones: hrZones2,
          strainScore: calculateStrainScore(duration2, avgHR2, maxHR2, hrZones2),
          source: 'demo',
        });
      }
    }
  }

  return workouts;
}

export function generateMockSleepSessions(days: number = 30): SleepSession[] {
  const sessions: SleepSession[] = [];
  const now = new Date();

  // Base sleep patterns (will vary)
  let baseBedtime = 23 * 60; // 11 PM in minutes
  let baseWaketime = 7 * 60; // 7 AM in minutes

  for (let i = 0; i < days; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];

    // Vary bedtime and wake time
    const bedtimeMinutes = baseBedtime + randomVariation(0, 45);
    const waketimeMinutes = baseWaketime + randomVariation(0, 30);

    // Calculate sleep duration
    let sleepDuration = waketimeMinutes - bedtimeMinutes;
    if (sleepDuration < 0) sleepDuration += 24 * 60;

    const timeInBed = sleepDuration + randomVariation(20, 10);
    const actualSleep = Math.max(sleepDuration - randomVariation(30, 15), sleepDuration * 0.85);

    // Create timestamps
    const sleepStart = new Date(date);
    sleepStart.setHours(Math.floor(bedtimeMinutes / 60), bedtimeMinutes % 60);

    const sleepEnd = new Date(date);
    sleepEnd.setHours(Math.floor(waketimeMinutes / 60), waketimeMinutes % 60);
    if (waketimeMinutes < bedtimeMinutes) {
      sleepEnd.setDate(sleepEnd.getDate() + 1);
    }

    sessions.push({
      id: `sleep-${dateStr}`,
      date: dateStr,
      sleepStart: sleepStart.toISOString(),
      sleepEnd: sleepEnd.toISOString(),
      totalSleepMinutes: Math.round(actualSleep),
      timeInBedMinutes: Math.round(timeInBed),
      // Polar API doesn't always provide stages, so only include sometimes
      stages: Math.random() > 0.5 ? {
        awake: randomVariation(15, 10),
        light: randomVariation(Math.round(actualSleep * 0.5), 20),
        deep: randomVariation(Math.round(actualSleep * 0.2), 15),
        rem: randomVariation(Math.round(actualSleep * 0.25), 15),
      } : undefined,
      source: 'demo',
    });
  }

  return sessions;
}

export function generateMockDailyMetrics(
  workouts: Workout[],
  sleepSessions: SleepSession[],
  days: number = 30
): { metrics: DailyMetrics[]; baselines: Baselines } {
  const metrics: DailyMetrics[] = [];
  const now = new Date();

  // Generate baseline values
  const baseHRV = randomVariation(55, 15); // ms
  const baseRHR = randomVariation(58, 8); // bpm

  // Collect all bedtimes and waketimes for consistency calculation
  const bedtimes = sleepSessions.slice(0, 7).map(s => s.sleepStart).filter((s): s is string => !!s);
  const waketimes = sleepSessions.slice(0, 7).map(s => s.sleepEnd).filter((s): s is string => !!s);
  const baseConsistency = calculateSleepConsistency(bedtimes, waketimes);

  for (let i = 0; i < days; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];

    // Get day's data
    const dayWorkouts = workouts.filter(w => w.date === dateStr);
    const daySleep = sleepSessions.find(s => s.date === dateStr);
    const prevDayWorkouts = workouts.filter(w => {
      const prevDate = new Date(date.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return w.date === prevDate;
    });

    // Calculate daily strain
    const dailyStrain = dayWorkouts.length > 0
      ? dayWorkouts.reduce((sum, w) => sum + (w.strainScore || 0), 0)
      : randomVariation(3, 2);

    const prevDayStrain = prevDayWorkouts.length > 0
      ? prevDayWorkouts.reduce((sum, w) => sum + (w.strainScore || 0), 0)
      : randomVariation(5, 3);

    // Daily HRV and RHR with variation
    const hrv = Math.round(baseHRV + randomVariation(0, 12));
    const rhr = Math.round(baseRHR + randomVariation(0, 5));

    // Sleep score
    const sleepGoal = 8 * 60; // 8 hours
    const actualSleep = daySleep?.totalSleepMinutes || randomVariation(7 * 60, 45);
    const sleepConsistency = baseConsistency + randomVariation(0, 10);
    const awakeMinutes = daySleep?.stages?.awake || randomVariation(15, 10);
    const sleepScore = calculateSleepScore(actualSleep, sleepGoal, sleepConsistency, awakeMinutes);

    // Recovery score
    const { score: recoveryScore } = calculateRecoveryScore(
      hrv,
      baseHRV,
      rhr,
      baseRHR,
      sleepScore,
      prevDayStrain
    );

    metrics.push({
      date: dateStr,
      recoveryScore,
      strainScore: Math.min(21, dailyStrain),
      sleepScore,
      sleepConsistency: Math.round(sleepConsistency),
      hrv,
      rhr,
    });
  }

  const baselines: Baselines = {
    hrvBaseline: baseHRV,
    rhrBaseline: baseRHR,
    sleepDurationBaseline: 7.5 * 60,
    strainBaseline: 8,
  };

  return { metrics, baselines };
}

export function generateMockInsights(metrics: DailyMetrics[]): Insight[] {
  const insights: Insight[] = [];
  const today = new Date().toISOString().split('T')[0];
  const todayMetrics = metrics.find(m => m.date === today);

  if (!todayMetrics) return insights;

  // Recovery-based insights
  if (todayMetrics.recoveryScore >= 80) {
    insights.push({
      id: `insight-${today}-1`,
      date: today,
      type: 'recovery',
      title: 'Peak Recovery',
      description: 'Your body is well-recovered. Great day for high-intensity training.',
      priority: 'high',
    });
  } else if (todayMetrics.recoveryScore < 50) {
    insights.push({
      id: `insight-${today}-2`,
      date: today,
      type: 'recovery',
      title: 'Recovery Deficit',
      description: 'Consider lighter activity today. Focus on rest and nutrition.',
      priority: 'high',
    });
  }

  // Sleep insights
  if (todayMetrics.sleepScore < 60) {
    insights.push({
      id: `insight-${today}-3`,
      date: today,
      type: 'sleep',
      title: 'Sleep Quality Below Target',
      description: 'Try going to bed 30 minutes earlier tonight.',
      priority: 'medium',
    });
  }

  // HRV insights
  const hrvTrend = metrics.slice(0, 7).reduce((sum, m) => sum + (m.hrv || 0), 0) / 7;
  if (todayMetrics.hrv && todayMetrics.hrv < hrvTrend * 0.85) {
    insights.push({
      id: `insight-${today}-4`,
      date: today,
      type: 'recovery',
      title: 'HRV Below Average',
      description: 'Your nervous system may need more recovery time.',
      priority: 'medium',
    });
  }

  // Strain insight
  if (todayMetrics.strainScore > 15) {
    insights.push({
      id: `insight-${today}-5`,
      date: today,
      type: 'strain',
      title: 'High Training Load',
      description: 'You pushed hard today. Prioritize recovery tomorrow.',
      priority: 'low',
    });
  }

  return insights.slice(0, 3); // Max 3 insights
}

/**
 * Generate Body Battery history for a day (readings throughout the day)
 */
export function generateBodyBatteryHistory(days: number = 7): BodyBatteryReading[] {
  const readings: BodyBatteryReading[] = [];
  const now = new Date();

  for (let d = 0; d < days; d++) {
    const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

    // Generate readings every 15 minutes
    let currentBattery = 85 + randomVariation(0, 15); // Start high (after sleep)

    for (let h = 6; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const timestamp = new Date(date);
        timestamp.setHours(h, m, 0, 0);

        // Battery drains during day, recharges during rest
        if (h >= 6 && h < 9) {
          // Morning - slight drain
          currentBattery -= randomVariation(1, 0.5);
        } else if (h >= 9 && h < 12) {
          // Mid-morning - moderate drain
          currentBattery -= randomVariation(2, 1);
        } else if (h >= 12 && h < 14) {
          // Lunch - slight recovery
          currentBattery += randomVariation(1, 1);
        } else if (h >= 14 && h < 18) {
          // Afternoon - drain
          currentBattery -= randomVariation(2, 1);
        } else if (h >= 18 && h < 21) {
          // Evening - slow drain
          currentBattery -= randomVariation(1, 0.5);
        } else {
          // Night - recovery
          currentBattery += randomVariation(2, 1);
        }

        currentBattery = Math.max(5, Math.min(100, currentBattery));

        readings.push({
          timestamp: timestamp.toISOString(),
          value: Math.round(currentBattery),
        });
      }
    }
  }

  return readings.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Generate Training Load History
 */
export function generateTrainingLoadHistory(workouts: Workout[], days: number = 30): TrainingLoadHistory[] {
  const history: TrainingLoadHistory[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];

    // Calculate 7-day (acute) load
    const acuteStart = new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
    const acuteWorkouts = workouts.filter(w => {
      const wDate = new Date(w.date);
      return wDate >= acuteStart && wDate <= date;
    });
    const acuteLoad = acuteWorkouts.reduce((sum, w) => sum + (w.strainScore || 0) * 10, 0);

    // Calculate 28-day (chronic) load
    const chronicStart = new Date(date.getTime() - 28 * 24 * 60 * 60 * 1000);
    const chronicWorkouts = workouts.filter(w => {
      const wDate = new Date(w.date);
      return wDate >= chronicStart && wDate <= date;
    });
    const chronicLoad = chronicWorkouts.length > 0
      ? chronicWorkouts.reduce((sum, w) => sum + (w.strainScore || 0) * 10, 0) / 4
      : acuteLoad;

    const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : 1;

    history.push({
      date: dateStr,
      acuteLoad: Math.round(acuteLoad),
      chronicLoad: Math.round(chronicLoad),
      ratio: Math.round(ratio * 100) / 100,
    });
  }

  return history;
}

/**
 * Get Training Load Status from ratio
 */
function getTrainingLoadStatus(ratio: number): DailyMetrics['trainingLoadStatus'] {
  if (ratio < 0.8) return 'detraining';
  if (ratio < 0.9) return 'recovery';
  if (ratio < 1.1) return 'maintaining';
  if (ratio < 1.3) return 'productive';
  if (ratio < 1.5) return 'peaking';
  return 'overreaching';
}

/**
 * Generate complete mock dataset
 */
export function generateAllMockData(days: number = 30) {
  const workouts = generateMockWorkouts(days);
  const sleepSessions = generateMockSleepSessions(days);
  const { metrics, baselines } = generateMockDailyMetrics(workouts, sleepSessions, days);
  const insights = generateMockInsights(metrics);
  const bodyBatteryHistory = generateBodyBatteryHistory(7);
  const trainingLoadHistory = generateTrainingLoadHistory(workouts, days);

  // Enhance metrics with new fields
  const enhancedMetrics = metrics.map((m, idx) => {
    const loadHistory = trainingLoadHistory.find(t => t.date === m.date);
    const sleepSession = sleepSessions.find(s => s.date === m.date);

    // Calculate sleep debt (cumulative over 7 days)
    const sleepGoal = 8 * 60; // 8 hours
    const recentSleep = sleepSessions
      .filter(s => {
        const sDate = new Date(s.date);
        const mDate = new Date(m.date);
        return sDate <= mDate && sDate >= new Date(mDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      })
      .reduce((debt, s) => debt + Math.max(0, sleepGoal - s.totalSleepMinutes), 0);

    return {
      ...m,
      bodyBattery: Math.round(40 + m.recoveryScore * 0.5 + randomVariation(0, 10)),
      vo2Max: baselines.vo2MaxBaseline ? baselines.vo2MaxBaseline + randomVariation(0, 2) : 42 + randomVariation(0, 5),
      trainingLoad: loadHistory?.acuteLoad || 0,
      trainingLoadStatus: loadHistory ? getTrainingLoadStatus(loadHistory.ratio) : 'maintaining',
      trainingReadiness: Math.round(m.recoveryScore * 0.7 + (m.sleepScore || 70) * 0.3),
      sleepDebt: Math.round(recentSleep / 7), // Average daily debt
      bodyTempDeviation: randomVariation(0, 0.3),
    };
  });

  // Update baselines with new fields
  const enhancedBaselines: Baselines = {
    ...baselines,
    vo2MaxBaseline: 42 + randomVariation(0, 8),
    bodyTempBaseline: 36.6,
    chronicTrainingLoad: trainingLoadHistory[0]?.chronicLoad || 100,
  };

  return {
    workouts,
    sleepSessions,
    dailyMetrics: enhancedMetrics,
    baselines: enhancedBaselines,
    insights,
    bodyBatteryHistory,
    trainingLoadHistory,
  };
}
