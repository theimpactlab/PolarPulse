"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export function SleepHRLine({
  points,
}: {
  points: Array<{ t: number; hr: number }>; // t in minutes from sleep start
}) {
  const data = points.map((p) => ({
    t: p.t,
    hr: p.hr,
    label: `${Math.floor(p.t / 60)}h ${p.t % 60}m`,
  }));

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-sm font-medium text-white/80">Heart Rate During Sleep</div>
        <div className="text-xs text-white/45">{points.length ? "Series" : "No data"}</div>
      </div>

      <div className="h-44 w-full rounded-2xl border border-white/10 bg-black/20 p-3">
        {points.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={(v) => `${Math.round(v / 60)}h`}
                tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
                width={30}
                domain={["dataMin - 5", "dataMax + 5"]}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(0,0,0,0.85)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 14,
                }}
                labelStyle={{ color: "rgba(255,255,255,0.75)" }}
                formatter={(value) => [`${value} bpm`, "HR"]}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.label ?? ""
                }
              />
              <Line
                type="monotone"
                dataKey="hr"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/50">
            No HR series available for this night.
          </div>
        )}
      </div>
    </div>
  );
}