"use client";

import React, { useMemo } from "react";
import { RingProgress } from "@/src/components/RingProgress";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Row = {
  date: string;
  sleep_score: number | null;
  recovery_score: number | null;
  strain_score: number | null;
  health_indicator: number | null;
  steps: number | null;
  active_calories: number | null;
};

function formatShortDate(iso: string) {
  // YYYY-MM-DD -> MM/DD (simple, local-friendly)
  const m = iso.slice(5, 7);
  const d = iso.slice(8, 10);
  return `${m}/${d}`;
}

export default function DashboardClient({ rows }: { rows: Row[] }) {
  const today = rows.length ? rows[rows.length - 1] : null;

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        date: formatShortDate(r.date),
        sleep: r.sleep_score ?? undefined,
        strain: r.strain_score ?? undefined,
      })),
    [rows],
  );

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-white/60">Dashboard</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Today</h1>
        <p className="mt-2 text-white/60">Overview of sleep, recovery, and strain.</p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
        <div className="grid grid-cols-3 gap-3">
          <RingProgress value={today?.sleep_score} max={100} label="Sleep" />
          <RingProgress value={today?.recovery_score} max={100} label="Recovery" />
          <RingProgress value={today?.strain_score} max={100} label="Strain" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Steps</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {today?.steps ?? "–"}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Active calories</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {today?.active_calories ?? "–"}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="text-sm font-medium text-white/80">Sleep vs Strain</div>
            <div className="text-xs text-white/45">Last 14 days</div>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} width={30} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(0,0,0,0.85)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 14,
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.75)" }}
                />
                <Line
                  type="monotone"
                  dataKey="sleep"
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="strain"
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}