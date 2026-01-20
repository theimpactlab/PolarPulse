"use client";

import React from "react";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function RingProgress({
  value,
  max = 100,
  size = 120,
  stroke = 10,
  label,
  sublabel,
}: {
  value: number | null | undefined;
  max?: number;
  size?: number;
  stroke?: number;
  label: string;
  sublabel?: string;
}) {
  const v = typeof value === "number" && Number.isFinite(value) ? value : null;
  const pct = v === null ? 0 : clamp(v / max, 0, 1);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={stroke}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={`${dash} ${c - dash}`}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-semibold tabular-nums">
            {v === null ? "–" : Math.round(v)}
          </div>
          <div className="text-xs text-white/55">{label}</div>
          {sublabel && <div className="mt-0.5 text-[11px] text-white/40">{sublabel}</div>}
        </div>
      </div>
    </div>
  );
}