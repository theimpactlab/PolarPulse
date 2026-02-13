"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type DailyMetric = {
  date: string;
  sleep_score: number | null;
  recovery_score: number | null;
  strain_score: number | null;
  strain_21: number | null;
  active_calories: number | null;
  hrv_ms: number | null;
  resting_hr: number | null;
  steps: number | null;
};

type Assessment = {
  week_start: string;
  training_state: string;
} | null;

function recoveryColor(v: number | null): string {
  if (v === null) return "#6b7280";
  if (v >= 67) return "#10b981";
  if (v >= 34) return "#f59e0b";
  return "#ef4444";
}

function avg(values: Array<number | null>): number {
  const valid = values.filter((v): v is number => v !== null);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

function sum(values: Array<number | null>): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

function computeTrainingState(metrics: DailyMetric[]): string {
  if (!metrics.length) return "Maintaining";
  const avgStrain = avg(metrics.map((m) => m.strain_21));
  const avgRecovery = avg(metrics.map((m) => m.recovery_score));
  if (avgStrain > 14 && avgRecovery < 40) return "Overreaching";
  if (avgStrain < 5) return "Detraining";
  if (avgRecovery > 60 && avgStrain >= 8) return "Peaking";
  return "Maintaining";
}

function stateColor(s: string): string {
  if (s === "Overreaching") return "text-red-400 bg-red-500/10 border-red-500/20";
  if (s === "Peaking") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (s === "Detraining") return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
}

function dayLabel(d: string): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short" });
}

function delta(curr: number, prev: number): { pct: number; dir: "up" | "down" | "flat" } {
  if (prev === 0) return { pct: 0, dir: "flat" };
  const p = ((curr - prev) / prev) * 100;
  return { pct: Math.abs(p), dir: p > 1 ? "up" : p < -1 ? "down" : "flat" };
}

export default function WeeklyClient({
  weekStart,
  weekEnd,
  thisWeekMetrics,
  prevWeekMetrics,
  existingAssessment,
}: {
  weekStart: string;
  weekEnd: string;
  thisWeekMetrics: DailyMetric[];
  prevWeekMetrics: DailyMetric[];
  existingAssessment: Assessment;
}) {
  const thisAvg = useMemo(() => ({
    recovery: avg(thisWeekMetrics.map((m) => m.recovery_score)),
    strain: avg(thisWeekMetrics.map((m) => m.strain_21)),
    sleep: avg(thisWeekMetrics.map((m) => m.sleep_score)),
    hrv: avg(thisWeekMetrics.map((m) => m.hrv_ms)),
  }), [thisWeekMetrics]);

  const prevAvg = useMemo(() => ({
    recovery: avg(prevWeekMetrics.map((m) => m.recovery_score)),
    strain: avg(prevWeekMetrics.map((m) => m.strain_21)),
    sleep: avg(prevWeekMetrics.map((m) => m.sleep_score)),
    hrv: avg(prevWeekMetrics.map((m) => m.hrv_ms)),
  }), [prevWeekMetrics]);

  const deltas = useMemo(() => ({
    recovery: delta(thisAvg.recovery, prevAvg.recovery),
    strain: delta(thisAvg.strain, prevAvg.strain),
    sleep: delta(thisAvg.sleep, prevAvg.sleep),
    hrv: delta(thisAvg.hrv, prevAvg.hrv),
  }), [thisAvg, prevAvg]);

  const training = existingAssessment?.training_state ?? computeTrainingState(thisWeekMetrics);

  const chartData = useMemo(
    () => thisWeekMetrics.map((m) => ({ day: dayLabel(m.date), recovery: m.recovery_score ?? 0 })),
    [thisWeekMetrics],
  );

  const totalCals = sum(thisWeekMetrics.map((m) => m.active_calories));
  const totalSteps = sum(thisWeekMetrics.map((m) => m.steps));

  const wkStart = new Date(weekStart + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const wkEnd = new Date(weekEnd + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-white/60">Weekly Assessment</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{wkStart} – {wkEnd}</h1>
      </div>

      {/* Training State */}
      <div className={`rounded-3xl border p-5 mb-5 ${stateColor(training)}`}>
        <div className="text-xs text-white/50 mb-1">Training State</div>
        <div className="text-xl font-bold">{training}</div>
        <div className="mt-1 text-xs text-white/45">
          {training === "Overreaching" && "High strain with low recovery – consider backing off."}
          {training === "Peaking" && "Great balance of strain and recovery – you're in peak form."}
          {training === "Detraining" && "Low activity this week – try to increase strain."}
          {training === "Maintaining" && "Consistent effort – keep it up."}
        </div>
      </div>

      {/* Key Metrics vs Last Week */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {([
          { label: "Avg Recovery", val: thisAvg.recovery, d: deltas.recovery, good: "up" },
          { label: "Avg Strain", val: thisAvg.strain, d: deltas.strain, good: "up" },
          { label: "Avg Sleep", val: thisAvg.sleep, d: deltas.sleep, good: "up" },
          { label: "Avg HRV", val: thisAvg.hrv, d: deltas.hrv, good: "up" },
        ] as const).map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">{item.label}</div>
            <div className="mt-1 text-xl font-bold tabular-nums">{Math.round(item.val)}</div>
            <div className={`mt-1 text-xs font-medium ${item.d.dir === item.good ? "text-emerald-400" : item.d.dir === "flat" ? "text-white/40" : "text-red-400"}`}>
              {item.d.dir === "up" ? "↑" : item.d.dir === "down" ? "↓" : "→"}{" "}
              {item.d.pct.toFixed(1)}% vs last week
            </div>
          </div>
        ))}
      </div>

      {/* Daily Recovery Chart */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur mb-5">
        <div className="text-sm font-medium text-white/80 mb-3">Daily Recovery</div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} width={28} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  background: "rgba(0,0,0,0.85)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelStyle={{ color: "rgba(255,255,255,0.75)" }}
              />
              <Bar dataKey="recovery" radius={[6, 6, 0, 0]} name="Recovery">
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={recoveryColor(entry.recovery)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/50">Workouts</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{thisWeekMetrics.filter((m) => (m.active_calories ?? 0) > 50).length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/50">Steps</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{totalSteps.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/50">Calories</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{totalCals.toLocaleString()}</div>
        </div>
      </div>

      {/* Sleep Summary */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
        <div className="text-sm font-medium text-white/80 mb-3">Sleep Summary</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Avg Sleep Score</div>
            <div className="mt-1 text-xl font-bold tabular-nums">{Math.round(thisAvg.sleep)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Avg Resting HR</div>
            <div className="mt-1 text-xl font-bold tabular-nums">
              {Math.round(avg(thisWeekMetrics.map((m) => m.resting_hr)))}
              <span className="text-xs text-white/40 ml-1">bpm</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
