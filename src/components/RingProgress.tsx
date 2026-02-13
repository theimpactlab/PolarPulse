"use client";

import React, { useId } from "react";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function getRecoveryColor(pct: number): string {
  if (pct >= 67) return "#22c55e";
  if (pct >= 34) return "#eab308";
  return "#ef4444";
}

function getStrainColor(val: number): string {
  if (val < 10) return "#38bdf8";
  if (val < 14) return "#3b82f6";
  if (val < 18) return "#a855f7";
  return "#ec4899";
}

function getSleepColor(pct: number): string {
  if (pct >= 85) return "#22c55e";
  if (pct >= 70) return "#eab308";
  return "#ef4444";
}

export function RingProgress({
  value,
  max = 100,
  size = 120,
  stroke = 10,
  label,
  sublabel,
  color,
  colorZone,
  unit,
}: {
  value: number | null | undefined;
  max?: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  colorZone?: "recovery" | "strain" | "sleep" | "none";
  unit?: string;
}) {
  const gradId = useId();
  const v = typeof value === "number" && Number.isFinite(value) ? value : null;
  const pct = v === null ? 0 : clamp(v / max, 0, 1);
  const pct100 = pct * 100;

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;

  // Determine ring color
  let ringColor = "#ffffff";
  if (color) {
    ringColor = color;
  } else if (colorZone === "recovery" && v !== null) {
    ringColor = getRecoveryColor(pct100);
  } else if (colorZone === "strain" && v !== null) {
    ringColor = getStrainColor(v);
  } else if (colorZone === "sleep" && v !== null) {
    ringColor = getSleepColor(pct100);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="rotate-[-90deg]"
          style={{ filter: `drop-shadow(0 0 8px ${ringColor}33)` }}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={ringColor} stopOpacity={1} />
              <stop offset="100%" stopColor={ringColor} stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${CSS.escape(gradId)})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={`${dash} ${c - dash}`}
            style={{
              transition: "stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1)",
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="text-2xl font-bold tabular-nums transition-colors duration-300"
            style={{ color: v !== null ? ringColor : "rgba(255,255,255,0.35)" }}
          >
            {v === null ? "–" : Math.round(v)}
            {unit && v !== null && (
              <span className="text-xs ml-0.5 font-medium opacity-70">{unit}</span>
            )}
          </div>
          {label && (
            <div className="text-[11px] font-medium text-white/55 mt-0.5">{label}</div>
          )}
          {sublabel && (
            <div className="text-[10px] text-white/40">{sublabel}</div>
          )}
        </div>
      </div>
    </div>
  );
}
