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

type Props = {
  workout: {
    id: string;
    date: string;
    type: string;
    durationMin: number | null;
    calories: number | null;
    distanceM: number | null;
    avgHr: number | null;
    maxHr: number | null;
  };
  hrPoints: Array<{ t: number; hr: number }>;
  zones: { z1: number; z2: number; z3: number; z4: number; z5: number };
};

function km(m: number | null) {
  if (typeof m !== "number") return null;
  return m / 1000;
}

function fmtNum(v: number | null | undefined, suffix = "") {
  if (typeof v !== "number" || !Number.isFinite(v)) return "–";
  return `${Math.round(v)}${suffix}`;
}

function fmt1(v: number | null | undefined, suffix = "") {
  if (typeof v !== "number" || !Number.isFinite(v)) return "–";
  return `${v.toFixed(1)}${suffix}`;
}

export default function WorkoutDetailClient({ workout, hrPoints, zones }: Props) {
  const distanceKm = km(workout.distanceM);

  const avgSpeedKmh = useMemo(() => {
    if (!distanceKm || !workout.durationMin || workout.durationMin <= 0) return null;
    return (distanceKm / (workout.durationMin / 60));
  }, [distanceKm, workout.durationMin]);

  const paceMinPerKm = useMemo(() => {
    if (!distanceKm || !workout.durationMin || workout.durationMin <= 0) return null;
    return workout.durationMin / distanceKm; // min/km
  }, [distanceKm, workout.durationMin]);

  const zoneTotal = zones.z1 + zones.z2 + zones.z3 + zones.z4 + zones.z5 || 1;
  const zonePct = (m: number) => Math.max(0, Math.min(100, (m / zoneTotal) * 100));

  const chartData = useMemo(
    () => hrPoints.map((p) => ({ t: p.t, hr: p.hr })),
    [hrPoints],
  );

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-white/60">Activity</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{workout.type}</h1>
        <p className="mt-2 text-white/60">{workout.date}</p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Duration" value={workout.durationMin == null ? "–" : `${Math.round(workout.durationMin)} min`} />
          <Tile label="Distance" value={distanceKm == null ? "–" : `${distanceKm.toFixed(2)} km`} />
          <Tile label="Calories" value={fmtNum(workout.calories)} />
          <Tile label="Avg HR" value={fmtNum(workout.avgHr)} />
          <Tile label="Max HR" value={fmtNum(workout.maxHr)} />
          <Tile label="Avg Speed" value={avgSpeedKmh == null ? "–" : fmt1(avgSpeedKmh, " km/h")} />
          <Tile
            label="Pace"
            value={
              paceMinPerKm == null
                ? "–"
                : `${Math.floor(paceMinPerKm)}:${String(Math.round((paceMinPerKm % 1) * 60)).padStart(2, "0")} /km`
            }
          />
          <Tile label="Load" value="–" hint="(wire this once training-load exists in DB)" />
        </div>

        {/* Heart rate chart */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="text-sm font-medium text-white/80">Heart Rate</div>
            <div className="text-xs text-white/45">minutes</div>
          </div>

          <div className="h-44 w-full">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-white/50">
                No heart rate series for this workout.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="t" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} />
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
                    dataKey="hr"
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* HR Zones */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-white/80">Heart Rate Zones</div>
            <div className="text-xs text-white/45">{Math.round(zoneTotal)} min</div>
          </div>

          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
            <span className="inline-block h-full bg-white/25" style={{ width: `${zonePct(zones.z1)}%` }} />
            <span className="inline-block h-full bg-white/35" style={{ width: `${zonePct(zones.z2)}%` }} />
            <span className="inline-block h-full bg-white/45" style={{ width: `${zonePct(zones.z3)}%` }} />
            <span className="inline-block h-full bg-white/55" style={{ width: `${zonePct(zones.z4)}%` }} />
            <span className="inline-block h-full bg-white/65" style={{ width: `${zonePct(zones.z5)}%` }} />
          </div>

          <div className="mt-3 grid grid-cols-5 gap-2">
            <ZoneCard label="Z1" minutes={zones.z1} />
            <ZoneCard label="Z2" minutes={zones.z2} />
            <ZoneCard label="Z3" minutes={zones.z3} />
            <ZoneCard label="Z4" minutes={zones.z4} />
            <ZoneCard label="Z5" minutes={zones.z5} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-white/35">{hint}</div> : null}
    </div>
  );
}

function ZoneCard({ label, minutes }: { label: string; minutes: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
      <div className="text-xs text-white/55">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-white">
        {Math.round(minutes)}
        <span className="ml-1 text-[10px] font-normal text-white/45">min</span>
      </div>
    </div>
  );
}