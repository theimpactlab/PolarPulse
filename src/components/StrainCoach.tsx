"use client";

import React from "react";

function recoveryLabel(r: number | null): string {
  if (r === null) return "moderate";
  if (r >= 67) return "high";
  if (r >= 34) return "moderate";
  return "light";
}

function recoveryBorderColor(r: number | null): string {
  if (r === null) return "border-white/10";
  if (r >= 67) return "border-emerald-500/20";
  if (r >= 34) return "border-yellow-500/20";
  return "border-red-500/20";
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
  const maxStrain = 21;
  const currentPct = currentStrain !== null ? Math.min((currentStrain / maxStrain) * 100, 100) : 0;
  const lowPct = targetLow !== null ? (targetLow / maxStrain) * 100 : 0;
  const highPct = targetHigh !== null ? (targetHigh / maxStrain) * 100 : 0;
  const recommended = recoveryLabel(recoveryScore);

  return (
    <div className={`rounded-2xl border ${recoveryBorderColor(recoveryScore)} bg-black/20 p-5`}>
      <div className="flex items-center gap-2 mb-5">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <span className="text-sm font-semibold text-white">Strain Coach</span>
      </div>

      {/* Current strain */}
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-xs text-white/50 mb-0.5">Current Strain</div>
          <div className="text-2xl font-bold tabular-nums text-white">
            {currentStrain !== null ? currentStrain.toFixed(1) : "–"}
            <span className="text-xs text-white/40 ml-1">/ 21</span>
          </div>
        </div>
        {targetLow !== null && targetHigh !== null && (
          <div className="text-right">
            <div className="text-xs text-white/50 mb-0.5">Target Range</div>
            <div className="text-base font-semibold tabular-nums text-white">
              {targetLow.toFixed(0)}–{targetHigh.toFixed(0)}
            </div>
          </div>
        )}
      </div>

      {/* Strain bar */}
      <div className="relative h-3 rounded-full bg-white/8 overflow-hidden mb-2">
        {/* Target zone */}
        {targetLow !== null && targetHigh !== null && (
          <div
            className="absolute top-0 h-full bg-white/10 rounded-full"
            style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
          />
        )}
        {/* Current fill */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
          style={{
            width: `${currentPct}%`,
            background: "linear-gradient(90deg, #38bdf8, #3b82f6, #a855f7, #ec4899)",
          }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-[10px] text-white/30 mb-4">
        <span>0</span>
        <span>7</span>
        <span>14</span>
        <span>21</span>
      </div>

      {/* Recommendation */}
      <div className="rounded-xl border border-white/8 bg-white/5 p-3">
        <div className="text-xs text-white/60">
          Your recovery suggests{" "}
          <span className={
            recommended === "high" ? "text-emerald-400 font-semibold" :
            recommended === "moderate" ? "text-yellow-400 font-semibold" :
            "text-red-400 font-semibold"
          }>
            {recommended} strain
          </span>{" "}
          today.
          {recommended === "high" && " Push yourself – your body is primed to perform."}
          {recommended === "moderate" && " A moderate effort will help maintain fitness."}
          {recommended === "light" && " Focus on active recovery and rest."}
        </div>
      </div>
    </div>
  );
}
