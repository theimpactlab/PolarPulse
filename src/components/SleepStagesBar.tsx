"use client";

import React, { useMemo } from "react";

type StageKey = "awake" | "light" | "deep" | "rem";

const LABELS: Record<StageKey, string> = {
  awake: "Awake",
  light: "Light",
  deep: "Deep",
  rem: "REM",
};

export function SleepStagesBar({
  stages,
}: {
  stages: Partial<Record<StageKey, number>>; // minutes
}) {
  const items = useMemo(() => {
    const keys: StageKey[] = ["awake", "light", "deep", "rem"];
    const arr = keys.map((k) => ({ key: k, minutes: stages[k] ?? 0 }));
    const total = arr.reduce((a, b) => a + b.minutes, 0) || 1;
    return { arr, total };
  }, [stages]);

  function pct(min: number) {
    return Math.max(0, Math.min(100, (min / items.total) * 100));
  }

  // We keep colors subtle and consistent with the dark UI.
  // You can later swap these to your extracted palette.
  const colorClass: Record<StageKey, string> = {
    awake: "bg-white/25",
    light: "bg-white/40",
    deep: "bg-white/60",
    rem: "bg-white/50",
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-white/80">Sleep Stages</div>
        <div className="text-xs text-white/45">{Math.round(items.total)} min</div>
      </div>

      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
        {items.arr.map((s) => (
          <span
            key={s.key}
            className={`inline-block h-full ${colorClass[s.key]}`}
            style={{ width: `${pct(s.minutes)}%` }}
            title={`${LABELS[s.key]}: ${s.minutes} min`}
          />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {items.arr.map((s) => (
          <div key={s.key} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/55">{LABELS[s.key]}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-white">
              {s.minutes}
              <span className="ml-1 text-xs font-normal text-white/50">min</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}