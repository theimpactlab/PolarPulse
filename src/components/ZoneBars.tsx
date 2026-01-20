"use client";

import React, { useMemo } from "react";

export function ZoneBars({
  zones,
}: {
  zones: Array<{ zone: number; minutes: number }>;
}) {
  const sorted = useMemo(() => {
    const map = new Map<number, number>();
    for (const z of zones) {
      if (typeof z.zone !== "number") continue;
      const mins = typeof z.minutes === "number" ? z.minutes : 0;
      map.set(z.zone, (map.get(z.zone) ?? 0) + mins);
    }
    const out = Array.from(map.entries())
      .map(([zone, minutes]) => ({ zone, minutes }))
      .sort((a, b) => a.zone - b.zone);

    // Ensure 1..5 exist
    for (let i = 1; i <= 5; i++) if (!out.find((x) => x.zone === i)) out.push({ zone: i, minutes: 0 });
    return out.sort((a, b) => a.zone - b.zone);
  }, [zones]);

  const total = sorted.reduce((a, b) => a + b.minutes, 0) || 1;

  function pct(mins: number) {
    return Math.max(0, Math.min(100, (mins / total) * 100));
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-sm font-medium text-white/80">Heart Rate Zones</div>
        <div className="text-xs text-white/45">{Math.round(total)} min</div>
      </div>

      <div className="space-y-2">
        {sorted.map((z) => (
          <div key={z.zone} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/55">Zone {z.zone}</div>
              <div className="text-xs text-white/55 tabular-nums">{z.minutes} min</div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-white/60"
                style={{ width: `${pct(z.minutes)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}