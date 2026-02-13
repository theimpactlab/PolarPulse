"use client";

import React from "react";

function fmtMin(m: number | null) {
  if (m === null || !Number.isFinite(m)) return "–";
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function perfColor(pct: number | null): string {
  if (pct === null) return "text-white/40";
  if (pct >= 85) return "text-emerald-400";
  if (pct >= 70) return "text-yellow-400";
  return "text-red-400";
}

function perfBar(pct: number | null): string {
  if (pct === null) return "bg-white/20";
  if (pct >= 85) return "bg-emerald-500";
  if (pct >= 70) return "bg-yellow-500";
  return "bg-red-500";
}

export function SleepCoach({
  sleepGotMin,
  sleepNeededMin,
  sleepDebtMin,
  sleepPerformancePct,
  recommendedBedtime,
}: {
  sleepGotMin: number | null;
  sleepNeededMin: number | null;
  sleepDebtMin: number | null;
  sleepPerformancePct: number | null;
  recommendedBedtime?: string | null;
}) {
  const barPct =
    sleepGotMin && sleepNeededMin && sleepNeededMin > 0
      ? Math.min((sleepGotMin / sleepNeededMin) * 100, 100)
      : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-center gap-2 mb-5">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
        <span className="text-sm font-semibold text-white">Sleep Coach</span>
      </div>

      <div className="mb-5">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs text-white/50">Sleep Performance</span>
          <span className={`text-xl font-bold tabular-nums ${perfColor(sleepPerformancePct)}`}>
            {sleepPerformancePct !== null ? `${Math.round(sleepPerformancePct)}%` : "–"}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/8 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${perfBar(sleepPerformancePct)}`}
            style={{ width: `${sleepPerformancePct !== null ? Math.min(sleepPerformancePct, 100) : 0}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl border border-white/8 bg-white/5 p-3">
          <div className="text-[11px] text-white/45 mb-1">Sleep Got</div>
          <div className="text-lg font-semibold tabular-nums text-white">{fmtMin(sleepGotMin)}</div>
          <div className="mt-2 h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${barPct}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/5 p-3">
          <div className="text-[11px] text-white/45 mb-1">Sleep Needed</div>
          <div className="text-lg font-semibold tabular-nums text-white">{fmtMin(sleepNeededMin)}</div>
          <div className="mt-2 h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div className="h-full rounded-full bg-white/20" style={{ width: "100%" }} />
          </div>
        </div>
      </div>

      {sleepDebtMin !== null && sleepDebtMin > 0 && (
        <div className="mb-4 rounded-xl border border-red-500/15 bg-red-500/8 p-3">
          <div className="text-[11px] text-white/45 mb-0.5">Sleep Debt</div>
          <div className="text-base font-semibold text-red-400 tabular-nums">{fmtMin(sleepDebtMin)}</div>
        </div>
      )}

      {recommendedBedtime && (
        <div className="rounded-xl border border-blue-500/15 bg-blue-500/8 p-3">
          <div className="text-[11px] text-white/45 mb-0.5">Recommended Bedtime</div>
          <div className="text-base font-semibold text-blue-400">{recommendedBedtime}</div>
        </div>
      )}
    </div>
  );
}
