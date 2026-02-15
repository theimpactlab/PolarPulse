"use client";

import React from "react";

function strainLevel(s: number | null): string {
  const v = s ?? 0;
  if (v >= 18) return "Overreaching";
  if (v >= 14) return "Strenuous";
  if (v >= 10) return "Moderate";
  if (v >= 6) return "Light";
  return "Minimal";
}

function strainLevelColor(s: number | null): string {
  const v = s ?? 0;
  if (v >= 18) return "text-red-400";
  if (v >= 14) return "text-orange-400";
  if (v >= 10) return "text-yellow-400";
  if (v >= 6) return "text-cyan-400";
  return "text-indigo-400";
}

function recoveryZoneLabel(r: number | null): string {
  if (r === null) return "unknown";
  if (r >= 67) return "green";
  if (r >= 34) return "yellow";
  return "red";
}

function recoveryZoneColor(r: number | null): string {
  if (r === null) return "text-white/50";
  if (r >= 67) return "text-green-400";
  if (r >= 34) return "text-yellow-400";
  return "text-red-400";
}

function recoveryBorderColor(r: number | null): string {
  if (r === null) return "border-white/10";
  if (r >= 67) return "border-emerald-500/20";
  if (r >= 34) return "border-yellow-500/20";
  return "border-red-500/20";
}

function getCoachMessage(strain: number | null, recovery: number | null): string {
  const s = strain ?? 0;
  const rZone = recovery === null ? "unknown" : recovery >= 67 ? "green" : recovery >= 34 ? "yellow" : "red";

  if (rZone === "green") {
    if (s >= 18) return "You've pushed hard today. Consider winding down to allow recovery.";
    if (s >= 14) return "Solid effort. You have room to push more or maintain this level.";
    if (s >= 10) return "Good progress. Your body can handle more strain today.";
    return "Your recovery supports higher strain. Great day for an intense workout.";
  }
  if (rZone === "yellow") {
    if (s >= 14) return "You've exceeded your typical target. Be mindful of recovery tomorrow.";
    if (s >= 10) return "You're in a good range for moderate recovery. Listen to your body.";
    return "Moderate recovery. A steady workout would be ideal today.";
  }
  // red
  if (s >= 14) return "High strain on low recovery. Prioritise rest and nutrition.";
  if (s >= 10) return "Your body needs recovery. Consider scaling back intensity.";
  return "Recovery is low. Light activity or rest recommended today.";
}
export function StrainCoach({
  currentStrain,
  targetLow,
  targetHigh,
  recoveryScore,
}: {
  currentStrain: number | null;
  targetLow: number | null;
  targetHigh: number | null;
  recoveryScore: number | null;
}) {
  const strain = currentStrain ?? 0;
  const low = targetLow ?? 8;
  const high = targetHigh ?? 14;
  const pct = Math.min((strain / 21) * 100, 100);
  const lowPct = (low / 21) * 100;
  const highPct = (high / 21) * 100;

  const level = strainLevel(currentStrain);
  const levelColor = strainLevelColor(currentStrain);
  const rZone = recoveryZoneLabel(recoveryScore);
  const rColor = recoveryZoneColor(recoveryScore);
  const borderColor = recoveryBorderColor(recoveryScore);
  const message = getCoachMessage(currentStrain, recoveryScore);

  return (
    <div className={`bg-white/[0.04] border ${borderColor} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-white/50 text-[10px] uppercase tracking-wider">
          Strain Coach
        </div>
        <div className={`text-[10px] font-semibold uppercase tracking-wider ${levelColor}`}>
          {level}
        </div>
      </div>

      {/* Progress bar with target zone */}
      <div className="relative h-2 rounded-full bg-white/10 mb-3">
        {/* Target zone highlight */}
        <div
          className="absolute top-0 h-full bg-white/10 rounded-full"
          style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
        />
        {/* Current strain */}
        <div
          className="absolute top-0 h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-orange-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px] text-white/30 mb-3 tabular-nums">
        <span>0</span>
        <span>{low.toFixed(0)}–{high.toFixed(0)} target</span>
        <span>21</span>
      </div>

      {/* Coach message */}
      <p className="text-xs text-white/70 leading-relaxed">
        Recovery is <span className={`font-semibold ${rColor}`}>{rZone}</span>.{" "}
        {message}
      </p>
    </div>
  );
}
