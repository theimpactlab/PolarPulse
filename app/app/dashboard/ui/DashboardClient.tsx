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

function recoveryZone(score: number | null) {
  const v = score ?? 0;
  if (v >= 67) return { label: "Green", cls: "text-emerald-400", ring: "#22c55e" };
  if (v >= 34) return { label: "Yellow", cls: "text-yellow-400", ring: "#eab308" };
  return { label: "Red", cls: "text-red-400", ring: "#ef4444" };
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

  const zone = recoveryZone(today?.recovery_score ?? null);
  const hrv = recharge?.hrv_avg ?? today?.hrv_ms ?? null;
  const rhr = recharge?.hr_min ?? today?.resting_hr ?? null;
  const rr = recharge?.breathing_rate_avg ?? today?.respiratory_rate ?? null;
  const hrvBase = baselineMap["hrv_ms"] ?? null;
  const rhrBase = baselineMap["resting_hr"] ?? null;
  const rrBase = baselineMap["respiratory_rate"] ?? null;
  const strain21 = today?.strain_21 ?? null;

  // Use the most recent non-null sleep score from rows if not passed
  const displaySleepScore = sleepScore ?? [...rows].reverse().find(r => r.sleep_score != null)?.sleep_score ?? null;

  return (
    <div>
      {/* Date Header */}
      <div className="mb-8">
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

      {/* Recovery Ring — Hero Section */}
      <div className="flex flex-col items-center mb-8">
        <RingProgress
          value={today?.recovery_score ?? null}
          max={100}
          size={200}
          stroke={12}
          label="Recovery"
          colorZone="recovery"
        />
        <div className={"mt-3 text-base font-semibold " + zone.cls}>
          {zone.label} Recovery
        </div>
        {recharge?.ans_charge_status && (
          <div className="mt-1 text-[11px] text-white/35">
            ANS: {recharge.ans_charge_status.replace(/_/g, " ").toLowerCase()}
          </div>
        )}
      </div>

      {/* Health Metrics Row — WHOOP style pills */}
      <div className="flex gap-2 mb-8">
        <Link href="/app/health" className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 hover:bg-white/[0.07] transition">
          <div className="text-[10px] text-white/40 uppercase tracking-wider">HRV</div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg font-bold tabular-nums">{hrv !== null ? Math.round(hrv) : "\u2013"}</span>
            <span className="text-[10px] text-white/30">ms</span>
            <span className={"text-xs ml-auto " + trendColor(hrv, hrvBase, true)}>{trend(hrv, hrvBase, true)}</span>
          </div>
        </Link>
        <Link href="/app/health" className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 hover:bg-white/[0.07] transition">
          <div className="text-[10px] text-white/40 uppercase tracking-wider">RHR</div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg font-bold tabular-nums">{rhr !== null ? Math.round(rhr) : "\u2013"}</span>
            <span className="text-[10px] text-white/30">bpm</span>
            <span className={"text-xs ml-auto " + trendColor(rhr, rhrBase, false)}>{trend(rhr, rhrBase, false)}</span>
          </div>
        </Link>
        <Link href="/app/health" className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 hover:bg-white/[0.07] transition">
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Resp</div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg font-bold tabular-nums">{rr !== null ? (Math.round(rr * 10) / 10).toFixed(1) : "\u2013"}</span>
            <span className="text-[10px] text-white/30">br/m</span>
            <span className={"text-xs ml-auto " + trendColor(rr, rrBase, false)}>{trend(rr, rrBase, false)}</span>
          </div>
        </Link>
      </div>

      {/* Strain + Sleep Rings Side by Side */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link href="/app/activity" className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 flex flex-col items-center hover:bg-white/[0.07] transition">
          <RingProgress
            value={strain21}
            max={21}
            size={110}
            stroke={9}
            label="Strain"
            colorZone="strain"
          />
          <div className="mt-2 text-xs text-white/50">
            {strain21 !== null ? strain21.toFixed(1) : "\u2013"} / 21
          </div>
        </Link>
        <Link href="/app/sleep" className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5 flex flex-col items-center hover:bg-white/[0.07] transition">
          <RingProgress
            value={displaySleepScore}
            max={100}
            size={110}
            stroke={9}
            label="Sleep"
            colorZone="sleep"
          />
          <div className="mt-2 text-xs text-white/50">
            {sleepGotMin
              ? Math.floor(sleepGotMin / 60) + "h " + (sleepGotMin % 60) + "m"
              : "\u2013"}
          </div>
        </Link>
      </div>

      {/* Strain Coach */}
      <div className="mb-5">
        <StrainCoach
          currentStrain={strain21}
          targetLow={today?.strain_target_low ?? null}
          targetHigh={today?.strain_target_high ?? null}
          recoveryScore={today?.recovery_score ?? null}
        />
      </div>

      {/* Sleep Coach */}
      <div className="mb-5">
        <SleepCoach
          sleepGotMin={sleepGotMin}
          sleepNeededMin={sleepNeededMin ?? today?.sleep_needed_min ?? null}
          sleepDebtMin={today?.sleep_debt_min ?? null}
          sleepPerformancePct={today?.sleep_performance_pct ?? null}
        />
      </div>
    </div>
  );
}
