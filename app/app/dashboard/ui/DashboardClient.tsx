"use client";

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { RingProgress } from "@/src/components/RingProgress";
import { MetricCard } from "@/src/components/MetricCard";
import { StrainCoach } from "@/src/components/StrainCoach";
import { SleepCoach } from "@/src/components/SleepCoach";

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

type Baseline = {
  metric: string;
  avg: number | null;
};

function formatShortDate(iso: string) {
  const m = iso.slice(5, 7);
  const d = iso.slice(8, 10);
  return `${m}/${d}`;
}

function recoveryZone(score: number | null) {
  const v = score ?? 0;
  if (v >= 67) return { label: "Green Recovery", cls: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
  if (v >= 34) return { label: "Yellow Recovery", cls: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" };
  return { label: "Red Recovery", cls: "text-red-400", bg: "bg-red-500/10 border-red-500/20" };
}

function trend(current: number | null, baseline: number | null, higherIsBetter: boolean): "up" | "down" | "flat" | null {
  if (current === null || baseline === null || baseline === 0) return null;
  const diff = current - baseline;
  if (Math.abs(diff) < baseline * 0.02) return "flat";
  if (higherIsBetter) return diff > 0 ? "up" : "down";
  return diff < 0 ? "up" : "down";
}

function trendIsGood(current: number | null, baseline: number | null, higherIsBetter: boolean): boolean | undefined {
  const t = trend(current, baseline, higherIsBetter);
  if (t === null || t === "flat") return undefined;
  return t === "up";
}

export default function DashboardClient({
  rows,
  recharge,
  baselines,
}: {
  rows: Row[];
  recharge: Recharge;
  baselines: Baseline[];
}) {
  const today = rows.length ? rows[rows.length - 1] : null;

  const baselineMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    baselines.forEach((b) => { map[b.metric] = b.avg; });
    return map;
  }, [baselines]);

  const zone = recoveryZone(today?.recovery_score ?? null);

  // Prefer nightly recharge data, fallback to daily_metrics
  const hrv = recharge?.hrv_avg ?? today?.hrv_ms ?? null;
  const rhr = recharge?.hr_min ?? today?.resting_hr ?? null;
  const rr = recharge?.breathing_rate_avg ?? today?.respiratory_rate ?? null;

  const hrvBase = baselineMap["hrv_ms"] ?? null;
  const rhrBase = baselineMap["resting_hr"] ?? null;
  const rrBase = baselineMap["respiratory_rate"] ?? null;

  // Strain on 0-21 scale
  const strain21 = today?.strain_21 ?? null;

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        date: formatShortDate(r.date),
        recovery: r.recovery_score ?? undefined,
        strain: r.strain_21 ?? undefined,
        sleep: r.sleep_score ?? undefined,
      })),
    [rows],
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="text-sm text-white/60">Dashboard</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Today</h1>
        <p className="mt-2 text-white/60">
          {today
            ? new Date(today.date + "T00:00:00Z").toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : "No data yet"}
        </p>
      </div>

      {/* Recovery Ring + Zone */}
      <div className={`rounded-3xl border ${zone.bg} p-6 shadow-xl backdrop-blur mb-5`}>
        <div className="flex flex-col items-center">
          <RingProgress
            value={today?.recovery_score ?? null}
            max={100}
            size={160}
            stroke={14}
            label="Recovery"
            colorZone="recovery"
          />
          <div className={`mt-3 text-lg font-semibold ${zone.cls}`}>{zone.label}</div>
          {recharge?.ans_charge_status && (
            <div className="mt-1 text-xs text-white/45">
              ANS Charge: {recharge.ans_charge_status.replace(/_/g, " ").toLowerCase()}
            </div>
          )}
        </div>
      </div>

      {/* Health Metrics Row */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <MetricCard
          label="HRV"
          value={hrv}
          unit="ms"
          trend={trend(hrv, hrvBase, true)}
          trendIsGood={trendIsGood(hrv, hrvBase, true)}
          baseline={hrvBase}
          colorZone={hrv !== null && hrvBase !== null ? (hrv >= hrvBase ? "green" : hrv >= hrvBase * 0.85 ? "yellow" : "red") : null}
        />
        <MetricCard
          label="RHR"
          value={rhr}
          unit="bpm"
          trend={trend(rhr, rhrBase, false)}
          trendIsGood={trendIsGood(rhr, rhrBase, false)}
          baseline={rhrBase}
          colorZone={rhr !== null && rhrBase !== null ? (rhr <= rhrBase ? "green" : rhr <= rhrBase * 1.1 ? "yellow" : "red") : null}
        />
        <MetricCard
          label="Resp"
          value={rr !== null ? Math.round(rr * 10) / 10 : null}
          unit="br/m"
          trend={trend(rr, rrBase, false)}
          trendIsGood={trendIsGood(rr, rrBase, false)}
          baseline={rrBase !== null ? Math.round(rrBase * 10) / 10 : null}
        />
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
          sleepGotMin={null}
          sleepNeededMin={today?.sleep_needed_min ?? null}
          sleepDebtMin={today?.sleep_debt_min ?? null}
          sleepPerformancePct={today?.sleep_performance_pct ?? null}
        />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/50">Steps</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{today?.steps ?? "–"}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/50">Active Calories</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{today?.active_calories ?? "–"}</div>
        </div>
      </div>

      {/* 14-day Trend Chart */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
        <div className="mb-2 flex items-baseline justify-between">
          <div className="text-sm font-medium text-white/80">Recovery · Strain · Sleep</div>
          <div className="text-xs text-white/45">14 days</div>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} width={28} />
              <Tooltip
                contentStyle={{
                  background: "rgba(0,0,0,0.85)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  fontSize: 12,
                }}
                labelStyle={{ color: "rgba(255,255,255,0.75)" }}
              />
              <Line type="monotone" dataKey="recovery" stroke="#22c55e" strokeWidth={2} dot={false} name="Recovery" />
              <Line type="monotone" dataKey="strain" stroke="#3b82f6" strokeWidth={2} dot={false} name="Strain" />
              <Line type="monotone" dataKey="sleep" stroke="#a855f7" strokeWidth={2} dot={false} name="Sleep" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
