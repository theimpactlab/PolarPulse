/**
 * Scoring algorithms for Recovery, Strain, and Sleep
 * All scores are 0-100 unless otherwise noted
 */

// Configuration weights - can be adjusted via config
export const SCORING_WEIGHTS = {
  recovery: {
    hrv: 0.4,      // 40% weight
    rhr: 0.2,      // 20% weight
    sleep: 0.3,    // 30% weight
    priorStrain: 0.1, // 10% weight
  },
  sleep: {
    durationVsNeed: 0.5,   // 50% weight
    consistency: 0.3,      // 30% weight
    disturbances: 0.2,     // 20% weight
  },
  strain: {
    zoneMinutes: 0.5,      // 50% weight
    duration: 0.3,         // 30% weight
    intensity: 0.2,        // 20% weight
  },
};

/**
 * Calculate Recovery Score (0-100)
 *
 * Formula:
 * - HRV contribution: (current HRV / baseline HRV) * 100 * 0.4
 * - RHR contribution: (baseline RHR / current RHR) * 100 * 0.2 (inverted - lower is better)
 * - Sleep contribution: sleep score * 0.3
 * - Prior strain: (21 - prior strain) / 21 * 100 * 0.1 (high strain = lower recovery)
 *
 * @param hrv Current HRV in ms
 * @param hrvBaseline Baseline HRV (14-30 day rolling average)
 * @param rhr Current resting heart rate
 * @param rhrBaseline Baseline RHR
 * @param sleepScore Sleep performance score (0-100)
 * @param priorDayStrain Previous day's strain score (0-21)
 */
export function calculateRecoveryScore(
  hrv: number | undefined,
  hrvBaseline: number | undefined,
  rhr: number | undefined,
  rhrBaseline: number | undefined,
  sleepScore: number,
  priorDayStrain: number
): { score: number; hasUncertainty: boolean } {
  const weights = SCORING_WEIGHTS.recovery;
  let score = 0;
  let hasUncertainty = false;

  // HRV component (40%)
  if (hrv && hrvBaseline && hrvBaseline > 0) {
    const hrvRatio = Math.min(hrv / hrvBaseline, 1.5); // Cap at 150%
    score += hrvRatio * 100 * weights.hrv;
  } else {
    // Fallback: use neutral value if HRV missing
    score += 50 * weights.hrv;
    hasUncertainty = true;
  }

  // RHR component (20%) - inverted, lower is better
  if (rhr && rhrBaseline && rhr > 0) {
    const rhrRatio = Math.min(rhrBaseline / rhr, 1.3); // Cap improvement
    score += rhrRatio * 100 * weights.rhr;
  } else {
    score += 50 * weights.rhr;
    hasUncertainty = true;
  }

  // Sleep component (30%)
  score += sleepScore * weights.sleep;

  // Prior strain component (10%) - high strain reduces recovery
  const strainImpact = Math.max(0, (21 - priorDayStrain) / 21);
  score += strainImpact * 100 * weights.priorStrain;

  return {
    score: Math.round(Math.min(100, Math.max(0, score))),
    hasUncertainty,
  };
}

/**
 * Calculate Sleep Performance Score (0-100)
 *
 * Formula:
 * - Duration vs need: (actual / target) * 100 * 0.5 (capped at 100%)
 * - Consistency: based on bedtime/wake variance
 * - Disturbances: penalty for awake time
 */
export function calculateSleepScore(
  actualMinutes: number,
  targetMinutes: number,
  consistencyScore: number, // 0-100, pre-calculated
  awakeMinutes: number = 0
): number {
  const weights = SCORING_WEIGHTS.sleep;

  // Duration component (50%)
  const durationRatio = Math.min(actualMinutes / targetMinutes, 1);
  const durationScore = durationRatio * 100 * weights.durationVsNeed;

  // Consistency component (30%)
  const consistencyComponent = consistencyScore * weights.consistency;

  // Disturbances component (20%)
  // More than 30 min awake = 0 points, 0 min awake = full points
  const disturbanceRatio = Math.max(0, 1 - awakeMinutes / 30);
  const disturbanceScore = disturbanceRatio * 100 * weights.disturbances;

  const total = durationScore + consistencyComponent + disturbanceScore;
  return Math.round(Math.min(100, Math.max(0, total)));
}

/**
 * Calculate Sleep Consistency Score (0-100)
 * Based on variance in bedtime and wake time over past 7 days
 *
 * @param bedtimes Array of bedtime timestamps
 * @param waketimes Array of wake timestamps
 */
export function calculateSleepConsistency(
  bedtimes: string[],
  waketimes: string[]
): number {
  if (bedtimes.length < 3 || waketimes.length < 3) {
    return 50; // Not enough data
  }

  // Convert to minutes from midnight for comparison
  const toMinutes = (timeStr: string): number => {
    const date = new Date(timeStr);
    let minutes = date.getHours() * 60 + date.getMinutes();
    // Handle times after midnight (adjust to be > 24 hours if late night)
    if (minutes < 360) minutes += 1440; // Before 6 AM = after midnight
    return minutes;
  };

  const bedtimeMinutes = bedtimes.map(toMinutes);
  const waketimeMinutes = waketimes.map(toMinutes);

  // Calculate standard deviation
  const stdDev = (arr: number[]): number => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  };

  const bedtimeStdDev = stdDev(bedtimeMinutes);
  const waketimeStdDev = stdDev(waketimeMinutes);

  // Score: 100 if stdDev < 15 min, 0 if stdDev > 90 min
  const bedtimeScore = Math.max(0, 100 - (bedtimeStdDev - 15) * (100 / 75));
  const waketimeScore = Math.max(0, 100 - (waketimeStdDev - 15) * (100 / 75));

  return Math.round((bedtimeScore + waketimeScore) / 2);
}

/**
 * Calculate Strain Score (0-21 scale, like Whoop)
 * Based on cardiovascular load from training
 *
 * Formula uses TRIMP (Training Impulse):
 * TRIMP = duration * avg HR * intensity factor
 *
 * Zone multipliers:
 * Zone 1 (50-60% max): 1x
 * Zone 2 (60-70% max): 2x
 * Zone 3 (70-80% max): 3x
 * Zone 4 (80-90% max): 4x
 * Zone 5 (90-100% max): 5x
 */
export function calculateStrainScore(
  durationMinutes: number,
  avgHR: number,
  maxHR: number,
  hrZones?: { zone: number; minutes: number }[]
): number {
  // Calculate intensity as percentage of max HR
  const intensity = avgHR / maxHR;

  let trimp = 0;

  if (hrZones && hrZones.length > 0) {
    // Use zone-weighted calculation
    hrZones.forEach(({ zone, minutes }) => {
      const zoneMultiplier = zone; // 1-5
      trimp += minutes * zoneMultiplier;
    });
  } else {
    // Fallback: estimate from average HR
    const estimatedZone = Math.min(5, Math.max(1, Math.floor(intensity * 6)));
    trimp = durationMinutes * estimatedZone;
  }

  // Convert TRIMP to 0-21 scale
  // Roughly: 0 TRIMP = 0 strain, 500+ TRIMP = 21 strain
  const strain = Math.min(21, (trimp / 500) * 21);

  return Math.round(strain * 10) / 10; // One decimal place
}

/**
 * Calculate daily accumulated strain from multiple workouts
 */
export function calculateDailyStrain(workoutStrains: number[]): number {
  if (workoutStrains.length === 0) return 0;

  // Strain accumulates but with diminishing returns
  // First workout = full strain, subsequent = 70% contribution
  const sorted = [...workoutStrains].sort((a, b) => b - a);
  let totalStrain = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    totalStrain += sorted[i] * 0.7;
  }

  return Math.min(21, totalStrain);
}

/**
 * Get recovery status band
 */
export function getRecoveryStatus(score: number): string {
  if (score >= 67) return 'High';
  if (score >= 34) return 'Moderate';
  return 'Low';
}

/**
 * Get recovery color based on score
 */
export function getRecoveryColor(score: number): string {
  if (score >= 67) return '#00D1A7'; // Green
  if (score >= 34) return '#F5A623'; // Amber
  return '#FF4757'; // Red
}

/**
 * Get sleep status
 */
export function getSleepStatus(score: number): string {
  if (score >= 85) return 'Optimal';
  if (score >= 70) return 'Adequate';
  if (score >= 50) return 'Fair';
  return 'Poor';
}

/**
 * Get sleep color
 */
export function getSleepColor(score: number): string {
  if (score >= 85) return '#00D1A7';
  if (score >= 70) return '#3B82F6';
  if (score >= 50) return '#F5A623';
  return '#FF4757';
}

/**
 * Get strain status (0-21 scale)
 */
export function getStrainStatus(strain: number): string {
  if (strain >= 18) return 'Overreaching';
  if (strain >= 14) return 'High';
  if (strain >= 10) return 'Moderate';
  if (strain >= 4) return 'Light';
  return 'Minimal';
}

/**
 * Get strain color
 */
export function getStrainColor(strain: number): string {
  if (strain >= 18) return '#FF4757';
  if (strain >= 14) return '#FF6B35';
  if (strain >= 10) return '#8B5CF6';
  if (strain >= 4) return '#3B82F6';
  return '#00D1A7';
}

/**
 * Get Body Battery status
 */
export function getBodyBatteryStatus(value: number): string {
  if (value >= 76) return 'High';
  if (value >= 51) return 'Medium';
  if (value >= 26) return 'Low';
  return 'Very Low';
}

/**
 * Get Body Battery color
 */
export function getBodyBatteryColor(value: number): string {
  if (value >= 76) return '#00D1A7';
  if (value >= 51) return '#3B82F6';
  if (value >= 26) return '#F5A623';
  return '#FF4757';
}

/**
 * Get VO2 Max fitness level (based on age, assuming adult)
 */
export function getVO2MaxStatus(vo2Max: number, gender: 'male' | 'female' = 'male'): string {
  // Simplified classification for adults
  if (gender === 'male') {
    if (vo2Max >= 55) return 'Excellent';
    if (vo2Max >= 46) return 'Good';
    if (vo2Max >= 38) return 'Fair';
    if (vo2Max >= 30) return 'Poor';
    return 'Very Poor';
  } else {
    if (vo2Max >= 48) return 'Excellent';
    if (vo2Max >= 39) return 'Good';
    if (vo2Max >= 31) return 'Fair';
    if (vo2Max >= 24) return 'Poor';
    return 'Very Poor';
  }
}

/**
 * Get VO2 Max color
 */
export function getVO2MaxColor(vo2Max: number, gender: 'male' | 'female' = 'male'): string {
  const status = getVO2MaxStatus(vo2Max, gender);
  switch (status) {
    case 'Excellent': return '#00D1A7';
    case 'Good': return '#3B82F6';
    case 'Fair': return '#F5A623';
    case 'Poor': return '#FF6B35';
    default: return '#FF4757';
  }
}

/**
 * Get Training Load Status display name and color
 */
export function getTrainingLoadStatusInfo(status: string): { label: string; color: string; description: string } {
  switch (status) {
    case 'detraining':
      return { label: 'Detraining', color: '#6B7280', description: 'Training load is too low' };
    case 'recovery':
      return { label: 'Recovery', color: '#3B82F6', description: 'Light load, good for recovery' };
    case 'maintaining':
      return { label: 'Maintaining', color: '#00D1A7', description: 'Keeping current fitness' };
    case 'productive':
      return { label: 'Productive', color: '#8B5CF6', description: 'Building fitness effectively' };
    case 'peaking':
      return { label: 'Peaking', color: '#F5A623', description: 'High load, watch recovery' };
    case 'overreaching':
      return { label: 'Overreaching', color: '#FF4757', description: 'Risk of overtraining' };
    default:
      return { label: 'Unknown', color: '#6B7280', description: '' };
  }
}

/**
 * Get Training Readiness status
 */
export function getTrainingReadinessStatus(score: number): string {
  if (score >= 80) return 'Ready';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Limited';
  return 'Poor';
}

/**
 * Get Training Readiness color
 */
export function getTrainingReadinessColor(score: number): string {
  if (score >= 80) return '#00D1A7';
  if (score >= 60) return '#3B82F6';
  if (score >= 40) return '#F5A623';
  return '#FF4757';
}

/**
 * Get Sleep Debt status
 */
export function getSleepDebtStatus(debtMinutes: number): string {
  if (debtMinutes <= 30) return 'Minimal';
  if (debtMinutes <= 60) return 'Slight';
  if (debtMinutes <= 120) return 'Moderate';
  return 'Significant';
}

/**
 * Get Sleep Debt color
 */
export function getSleepDebtColor(debtMinutes: number): string {
  if (debtMinutes <= 30) return '#00D1A7';
  if (debtMinutes <= 60) return '#3B82F6';
  if (debtMinutes <= 120) return '#F5A623';
  return '#FF4757';
}

/**
 * Get Body Temperature status based on deviation
 */
export function getBodyTempStatus(deviation: number): string {
  const absDeviation = Math.abs(deviation);
  if (absDeviation <= 0.2) return 'Normal';
  if (absDeviation <= 0.5) return 'Slightly Elevated';
  if (absDeviation <= 1.0) return 'Elevated';
  return 'High';
}

/**
 * Get Body Temperature color based on deviation
 */
export function getBodyTempColor(deviation: number): string {
  const absDeviation = Math.abs(deviation);
  if (absDeviation <= 0.2) return '#00D1A7';
  if (absDeviation <= 0.5) return '#3B82F6';
  if (absDeviation <= 1.0) return '#F5A623';
  return '#FF4757';
}
