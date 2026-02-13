"use client";

import React from "react";

function TrendUpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
      <path d="M16 7h6v6" />
    </svg>
  );
}

function TrendDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 17 13.5 8.5 8.5 13.5 2 7" />
      <path d="M16 17h6v-6" />
    </svg>
  );
}

function FlatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14" />
    </svg>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  trend,
  trendIsGood,
  baseline,
  colorZone,
}: {
  label: string;
  value: number | null;
  unit?: string;
  trend?: "up" | "down" | "flat" | null;
  trendIsGood?: boolean;
  baseline?: number | null;
  colorZone?: "green" | "yellow" | "red" | null;
}) {
  const dotColor =
    colorZone === "green"
      ? "bg-emerald-400"
      : colorZone === "yellow"
        ? "bg-yellow-400"
        : colorZone === "red"
          ? "bg-red-400"
          : "bg-white/20";

  const trendColor = trendIsGood ? "text-emerald-400" : "text-red-400";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-white/15">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/50 font-medium">{label}</span>
        {colorZone && <span className={`h-2 w-2 rounded-full ${dotColor}`} />}
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums text-white">
          {value !== null && value !== undefined ? Math.round(value) : "–"}
        </span>
        {unit && value !== null && (
          <span className="text-xs text-white/45 font-medium">{unit}</span>
        )}
      </div>

      {(trend || baseline !== null) && (
        <div className="mt-2 flex items-center gap-1.5">
          {trend && trend !== "flat" && (
            trend === "up" ? (
              <TrendUpIcon className={`w-3.5 h-3.5 ${trendColor}`} />
            ) : (
              <TrendDownIcon className={`w-3.5 h-3.5 ${trendColor}`} />
            )
          )}
          {trend === "flat" && <FlatIcon className="w-3.5 h-3.5 text-white/40" />}
          {baseline !== null && baseline !== undefined && (
            <span className="text-[11px] text-white/40">
              vs avg {Math.round(baseline)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
