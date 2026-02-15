// Healthspan metrics: Biological Age & Pace of Aging
// Approximation based on available Polar biometrics

export interface DailyMetricRow {
  date: string;
  hrv_ms: number | null;
  resting_hr: number | null;
  sleep_duration_min: number | null;
  sleep_score: number | null;
  steps: number | null;
  respiratory_rate: number | null;
}

export interface HealthspanResult {
  biologicalAge: number | null;
  healthScore: number;
  paceOfAging: number | null;
  paceLabel: string;
  paceColor: string;
  metricBreakdown: {
    label: string;
    score: number;
    value: string;
    color: string;
  }[];
}

// ── Metric scoring functions (0-100, higher = healthier) ──

function scoreHRV(hrv: number): number {
  // Population ref: avg ~40ms for 30-40yo, >60ms excellent, <20ms poor
  if (hrv >= 80) return 100;
  if (hrv >= 60) return 85 + (hrv - 60) * 0.75;
  if (hrv >= 40) return 60 + (hrv - 40) * 1.25;
  if (hrv >= 20) return 25 + (hrv - 20) * 1.75;
  return Math.max(0, hrv * 1.25);
}

function scoreRHR(rhr: number): number {
  // Lower is better. Elite: <50, Good: 50-60, Average: 60-70, High: >80
  if (rhr <= 45) return 100;
  if (rhr <= 55) return 85 + (55 - rhr) * 1.5;
  if (rhr <= 65) return 60 + (65 - rhr) * 2.5;
  if (rhr <= 75) return 30 + (75 - rhr) * 3;
  return Math.max(0, (90 - rhr) * 2);
}

function scoreSleepDuration(mins: number): number {
  // Ideal: 420-540 min (7-9 hours)
  const hours = mins / 60;
  if (hours >= 7 && hours <= 9) return 100;
  if (hours >= 6.5 && hours < 7) return 80;
  if (hours > 9 && hours <= 9.5) return 85;
  if (hours >= 6 && hours < 6.5) return 55;
  if (hours > 9.5 && hours <= 10) return 65;
  if (hours < 6) return Math.max(0, hours * 8);
  return Math.max(0, 100 - (hours - 10) * 20);
}

function scoreSleepConsistency(scores: number[]): number {
  // Low variance in sleep scores = consistent = healthy
  if (scores.length < 3) return 50; // not enough data
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  // StdDev < 5 = very consistent, > 20 = very inconsistent
  if (stdDev <= 5) return 100;
  if (stdDev <= 10) return 80;
  if (stdDev <= 15) return 55;
  return Math.max(0, 100 - stdDev * 3);
}

function scoreSteps(steps: number): number {
  // 10k target, diminishing returns above
  if (steps >= 12000) return 100;
  if (steps >= 10000) return 90;
  if (steps >= 7500) return 70 + (steps - 7500) * 0.008;
  if (steps >= 5000) return 45 + (steps - 5000) * 0.01;
  return Math.max(0, steps * 0.009);
}

function scoreRespiratoryRate(rr: number): number {
  // Ideal: 12-16 breaths/min at rest during sleep
  if (rr >= 12 && rr <= 16) return 100;
  if (rr >= 10 && rr < 12) return 80;
  if (rr > 16 && rr <= 18) return 80;
  if (rr > 18 && rr <= 20) return 55;
  if (rr < 10) return 40;
  return Math.max(0, 100 - (rr - 20) * 10);
}

function getScoreColor(score: number): string {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#eab308";
  return "#ef4444";
}

// ── Main computation ──

const WEIGHTS = {
  hrv: 0.25,
  rhr: 0.20,
  sleepDuration: 0.15,
  sleepConsistency: 0.15,
  steps: 0.12,
  respiratoryRate: 0.13,
};

export function computeHealthspan(
  metrics: DailyMetricRow[],
  userAge: number = 30
): HealthspanResult {
  if (!metrics || metrics.length < 3) {
    return {
      biologicalAge: null,
      healthScore: 0,
      paceOfAging: null,
      paceLabel: "Not enough data",
      paceColor: "#ffffff50",
      metricBreakdown: [],
    };
  }

  // Use last 7 days for current snapshot
  const recent = metrics.slice(0, 7);
  const all30 = metrics;

  // Compute averages for recent window
  const avg = (arr: (number | null)[]): number | null => {
    const valid = arr.filter((v): v is number => v !== null && Number.isFinite(v));
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  };

  const recentHRV = avg(recent.map(m => m.hrv_ms));
  const recentRHR = avg(recent.map(m => m.resting_hr));
  const recentSleep = avg(recent.map(m => m.sleep_duration_min));
  const recentSteps = avg(recent.map(m => m.steps));
  const recentRR = avg(recent.map(m => m.respiratory_rate));
  const sleepScores = recent.map(m => m.sleep_score).filter((v): v is number => v !== null);

  const breakdown: HealthspanResult["metricBreakdown"] = [];
  let totalScore = 0;
  let totalWeight = 0;

  if (recentHRV !== null) {
    const s = scoreHRV(recentHRV);
    totalScore += s * WEIGHTS.hrv;
    totalWeight += WEIGHTS.hrv;
    breakdown.push({ label: "HRV", score: s, value: Math.round(recentHRV) + " ms", color: getScoreColor(s) });
  }
  if (recentRHR !== null) {
    const s = scoreRHR(recentRHR);
    totalScore += s * WEIGHTS.rhr;
    totalWeight += WEIGHTS.rhr;
    breakdown.push({ label: "Resting HR", score: s, value: Math.round(recentRHR) + " bpm", color: getScoreColor(s) });
  }
  if (recentSleep !== null) {
    const s = scoreSleepDuration(recentSleep);
    totalScore += s * WEIGHTS.sleepDuration;
    totalWeight += WEIGHTS.sleepDuration;
    const hrs = (recentSleep / 60).toFixed(1);
    breakdown.push({ label: "Sleep", score: s, value: hrs + " hrs", color: getScoreColor(s) });
  }
  if (sleepScores.length >= 3) {
    const s = scoreSleepConsistency(sleepScores);
    totalScore += s * WEIGHTS.sleepConsistency;
    totalWeight += WEIGHTS.sleepConsistency;
    breakdown.push({ label: "Consistency", score: s, value: s >= 75 ? "Stable" : s >= 50 ? "Moderate" : "Variable", color: getScoreColor(s) });
  }
  if (recentSteps !== null) {
    const s = scoreSteps(recentSteps);
    totalScore += s * WEIGHTS.steps;
    totalWeight += WEIGHTS.steps;
    breakdown.push({ label: "Activity", score: s, value: (recentSteps / 1000).toFixed(1) + "k steps", color: getScoreColor(s) });
  }
  if (recentRR !== null) {
    const s = scoreRespiratoryRate(recentRR);
    totalScore += s * WEIGHTS.respiratoryRate;
    totalWeight += WEIGHTS.respiratoryRate;
    breakdown.push({ label: "Resp Rate", score: s, value: recentRR.toFixed(1) + " br/m", color: getScoreColor(s) });
  }

  // Normalise to 0-100
  const healthScore = totalWeight > 0 ? totalScore / totalWeight : 0;

  // Map to biological age: score=100 means -5 years, score=0 means +15 years
  const ageOffset = ((100 - healthScore) / 100) * 20 - 5;
  const biologicalAge = Math.round(userAge + ageOffset);

  // Pace of aging: compare recent 7d vs full 30d
  let paceOfAging: number | null = null;
  let paceLabel = "Calculating...";
  let paceColor = "#ffffff50";

  if (all30.length >= 14) {
    const older = all30.slice(7);
    const olderHRV = avg(older.map(m => m.hrv_ms));
    const olderRHR = avg(older.map(m => m.resting_hr));
    const olderSleep = avg(older.map(m => m.sleep_duration_min));

    let olderScore = 0;
    let olderWeight = 0;
    if (olderHRV !== null) { olderScore += scoreHRV(olderHRV) * WEIGHTS.hrv; olderWeight += WEIGHTS.hrv; }
    if (olderRHR !== null) { olderScore += scoreRHR(olderRHR) * WEIGHTS.rhr; olderWeight += WEIGHTS.rhr; }
    if (olderSleep !== null) { olderScore += scoreSleepDuration(olderSleep) * WEIGHTS.sleepDuration; olderWeight += WEIGHTS.sleepDuration; }

    const olderNorm = olderWeight > 0 ? olderScore / olderWeight : healthScore;
    const delta = healthScore - olderNorm;

    // Convert to pace multiplier: positive delta = improving = pace < 1x
    paceOfAging = Math.round((1 - delta / 50) * 10) / 10;
    paceOfAging = Math.max(-0.5, Math.min(3, paceOfAging));

    if (paceOfAging <= 0.7) { paceLabel = "Reversing"; paceColor = "#22c55e"; }
    else if (paceOfAging <= 0.95) { paceLabel = "Slowing"; paceColor = "#22c55e"; }
    else if (paceOfAging <= 1.05) { paceLabel = "Steady"; paceColor = "#eab308"; }
    else if (paceOfAging <= 1.5) { paceLabel = "Elevated"; paceColor = "#f97316"; }
    else { paceLabel = "Accelerated"; paceColor = "#ef4444"; }
  }

  return {
    biologicalAge,
    healthScore: Math.round(healthScore),
    paceOfAging,
    paceLabel,
    paceColor,
    metricBreakdown: breakdown,
  };
}
