"use client";

import React, { useMemo } from "react";
import { RingProgress } from "@/src/components/RingProgress";
import { StrainCoach } from "@/src/components/StrainCoach";
import { SleepCoach } from "@/src/components/SleepCoach";
import Link from "next/link";

type Row = {
  date: string;
  sleep_score: number | null;
  recovery_score: number | null;
  strain_score: number | null;
  strain_21: number | null;
  health_indicator: number | null;
  steps: number | null;
  active_calories: number | null;
  hrv_ms: number | null;
  resting_hr: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  stress_avg: number | null;
  strain_target_low: number | null;
  strain_target_high: number | null;
  sleep_needed_min: number | null;
  sleep_debt_min: number | null;
  sleep_performance_pct: number | null;
};

type Recharge = {
  hrv_avg: number | null;
  hr_avg: number | null;
  hr_min: number | null;
  breathing_rate_avg: number | null;
  ans_charge: number | null;
  ans_charge_status: string | null;
} | null;

type Baseline = { metric: string; avg: number | null };

/* ── helpers ── */

function recoveryColor(score: number | null): string {
  const v = score ?? 0;
  if (v >= 67) return "#22c55e";
  if (v >= 34) return "#eab308";
  return "#ef4444";
}
function recoveryLabel(score: number | null): string {
  const v = score ?? 0;
  if (v >= 67) return "Green";
  if (v >= 34) return "Yellow";
  return "Red";
}

function strainColor(strain: number | null): string {
  const s = strain ?? 0;
  if (s >= 18) return "#ef4444";
  if (s >= 14) return "#f97316";
  if (s >= 10) return "#eab308";
  if (s >= 6) return "#22d3ee";
  return "#6366f1";
}

function sleepColor(score: number | null): string {
  const v = score ?? 0;
  if (v >= 85) return "#22c55e";
  if (v >= 70) return "#3b82f6";
  if (v >= 50) return "#eab308";
  return "#ef4444";
}

function trend(current: number | null, baseline: number | null, higherIsBetter: boolean): string {
  if (current === null || baseline === null || baseline === 0) return "";
  const diff = current - baseline;
  if (Math.abs(diff) < baseline * 0.02) return "\u2192";
  const up = diff > 0;
  const good = higherIsBetter ? up : !up;
  return good ? "\u2191" : "\u2193";
}

function trendColor(current: number | null, baseline: number | null, higherIsBetter: boolean): string {
  if (current === null || baseline === null) return "text-white/30";
  const diff = current - baseline;
  if (Math.abs(diff) < baseline * 0.02) return "text-white/40";
  const up = diff > 0;
  const good = higherIsBetter ? up : !up;
  return good ? "text-green-400" : "text-red-400";
}

function fmtMins(m: number | null): string {
  if (m === null) return "\u2013";
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h > 0 ? h + "h " + r + "m" : r + "m";
}

export default function DashboardClient({
  rows,
  recharge,
  baselines,
  sleepGotMin,
  sleepNeededMin,
  sleepScore,
}: {
  rows: Row[];
  recharge: Recharge;
  baselines: Baseline[];
  sleepGotMin: number | null;
  sleepNeededMin: number | null;
  sleepScore: number | null;
}) {
  const today = rows.length ? rows[rows.length - 1] : null;

  const baselineMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    baselines.forEach((b) => { map[b.metric] = b.avg; });
    return map;
  }, [baselines]);

  const recovery = today?.recovery_score ?? null;
  const strain21 = today?.strain_21 ?? null;
  const displaySleepScore = sleepScore ?? [...rows].reverse().find(r => r.sleep_score != null)?.sleep_score ?? null;

  const hrv = recharge?.hrv_avg ?? today?.hrv_ms ?? null;
  const rhr = recharge?.hr_min ?? today?.resting_hr ?? null;
  const rr = recharge?.breathing_rate_avg ?? today?.respiratory_rate ?? null;
  const hrvBase = baselineMap["hrv_ms"] ?? null;
  const rhrBase = baselineMap["resting_hr"] ?? null;
  const rrBase = baselineMap["respiratory_rate"] ?? null;

  // 7-day data for mini sparkline
  const last7 = rows.slice(-7);

  return (
    <div className="pb-28">
      {/* Date Header */}
      <div className="px-4 pt-2 pb-4">
        <p className="text-white/40 text-xs uppercase tracking-widest">
          {today
            ? new Date(today.date + "T00:00:00Z").toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : "No data yet"}
        </p>
      </div>

      {/* ── Three Dials ── WHOOP-style top row */}
      <div className="grid grid-cols-3 gap-2 px-4 mb-6">
        {/* Recovery Dial */}
        <Link href="/app/health" className="flex flex-col items-center bg-white/[0.04] border border-white/[0.06] rounded-2xl py-4 px-2 hover:bg-white/[0.07] transition">
          <RingProgress
            value={recovery}
            max={100}
            size={90}
            stroke={8}
            label={recovery !== null ? Math.round(recovery) + "%" : "\u2013"}
            colorZone="recovery"
          />
          <div className="mt-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: recoveryColor(recovery) }}>
            Recovery
          </div>
          <div className="text-[10px] text-white/30 mt-0.5">{recoveryLabel(recovery)}</div>
        </Link>

        {/* Strain Dial */}
        <Link href="/app/activity" className="flex flex-col items-center bg-white/[0.04] border border-white/[0.06] rounded-2xl py-4 px-2 hover:bg-white/[0.07] transition">
          <RingProgress
            value={strain21}
            max={21}
            size={90}
            stroke={8}
            label={strain21 !== null ? strain21.toFixed(1) : "\u2013"}
            colorZone="strain"
          />
          <div className="mt-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: strainColor(strain21) }}>
            Strain
          </div>
          <div className="text-[10px] text-white/30 mt-0.5">{strain21 !== null ? strain21.toFixed(1) + " / 21" : "\u2013"}</div>
        </Link>

        {/* Sleep Dial */}
        <Link href="/app/sleep" className="flex flex-col items-center bg-white/[0.04] border border-white/[0.06] rounded-2xl py-4 px-2 hover:bg-white/[0.07] transition">
          <RingProgress
            value={displaySleepScore}
            max={100}
            size={90}
            stroke={8}
            label={displaySleepScore !== null ? Math.round(displaySleepScore) + "%" : "\u2013"}
            colorZone="sleep"
          />
          <div className="mt-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: sleepColor(displaySleepScore) }}>
            Sleep
          </div>
          <div className="text-[10px] text-white/30 mt-0.5">{fmtMins(sleepGotMin)}</div>
        </Link>
      </div>

      {/* ── Health Vitals Row ── */}
      <div className="px-4 mb-6">
        <div className="text-white/50 text-[10px] uppercase tracking-wider mb-2">Health Monitor</div>
        <div className="grid grid-cols-3 gap-2">
          <Link href="/app/health" className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 hover:bg-white/[0.07] transition">
            <div className="text-[10px] text-white/40 uppercase tracking-wider">HRV</div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold tabular-nums">{hrv !== null ? Math.round(hrv) : "\u2013"}</span>
              <span className="text-[10px] text-white/30">ms</span>
              <span className={"text-xs ml-auto " + trendColor(hrv, hrvBase, true)}>{trend(hrv, hrvBase, true)}</span>
            </div>
          </Link>
          <Link href="/app/health" className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 hover:bg-white/[0.07] transition">
            <div className="text-[10px] text-white/40 uppercase tracking-wider">RHR</div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold tabular-nums">{rhr !== null ? Math.round(rhr) : "\u2013"}</span>
              <span className="text-[10px] text-white/30">bpm</span>
              <span className={"text-xs ml-auto " + trendColor(rhr, rhrBase, false)}>{trend(rhr, rhrBase, false)}</span>
            </div>
          </Link>
          <Link href="/app/health" className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 hover:bg-white/[0.07] transition">
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Resp</div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold tabular-nums">{rr !== null ? (Math.round(rr * 10) / 10).toFixed(1) : "\u2013"}</span>
              <span className="text-[10px] text-white/30">br/m</span>
              <span className={"text-xs ml-auto " + trendColor(rr, rrBase, false)}>{trend(rr, rrBase, false)}</span>
            </div>
          </Link>
        </div>
      </div>

      {/* ── 7-Day Recovery Trend ── */}
      {last7.length > 1 && (
        <div className="px-4 mb-6">
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
            <div className="text-white/50 text-[10px] uppercase tracking-wider mb-3">Recovery Trend (7 Days)</div>
            <div className="flex items-end justify-between gap-1 h-16">
              {last7.map((d, i) => {
                const v = d.recovery_score ?? 0;
                const pct = Math.max((v / 100) * 100, 4);
                const c = recoveryColor(d.recovery_score);
                const dt = new Date(d.date + "T00:00:00Z");
                const day = dt.toLocaleDateString("en-US", { weekday: "narrow" });
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <div className="text-[9px] text-white/40 tabular-nums">{d.recovery_score ?? ""}</div>
                    <div
                      className="w-full rounded-sm transition-all"
                      style={{ height: pct + "%", backgroundColor: c }}
                    />
                    <div className="text-white/40 text-[9px]">{day}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Strain Coach ── */}
      <div className="px-4 mb-5">
        <StrainCoach
          currentStrain={strain21}
          targetLow={today?.strain_target_low ?? null}
          targetHigh={today?.strain_target_high ?? null}
          recoveryScore={recovery}
        />
      </div>

      {/* ── Sleep Coach ── */}
      <div className="px-4 mb-5">
        <SleepCoach
          sleepGotMin={sleepGotMin}
          sleepNeededMin={sleepNeededMin ?? today?.sleep_needed_min ?? null}
          sleepDebtMin={today?.sleep_debt_min ?? null}
          sleepPerformancePct={today?.sleep_performance_pct ?? null}
        />
      </div>

      {/* ── Activity Summary ── */}
      <div className="px-4 mb-6">
        <div className="text-white/50 text-[10px] uppercase tracking-wider mb-2">Today&apos;s Activity</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
            <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Steps</div>
            <div className="text-lg font-semibold tabular-nums">
              {today?.steps != null ? today.steps.toLocaleString() : "\u2013"}
            </div>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
            <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Calories</div>
            <div className="text-lg font-semibold tabular-nums">
              {today?.active_calories != null ? today.active_calories.toLocaleString() : "\u2013"}
            </div>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
            <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Sleep Debt</div>
            <div className="text-lg font-semibold tabular-nums">
              {today?.sleep_debt_min != null ? fmtMins(today.sleep_debt_min) : "\u2013"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
