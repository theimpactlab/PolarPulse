// app/app/sleep/ui/SleepClient.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { SleepStagesBar } from "@/src/components/SleepStagesBar";
import { SleepHRLine } from "@/src/components/SleepHRLine";

type SleepSessionView = {
  startTime: string; // "HH:MM" or "–"
  endTime: string; // "HH:MM" or "–"
  sleepScore: number | null;
  efficiencyPct: number | null;
  durationMin: number | null;
  timeInBedMin: number | null;
  avgHr: number | null;
};

type SleepStagesView = {
  awake: number;
  light: number;
  deep: number;
  rem: number;
};

type HrPoint = { t: number; hr: number };

type Props = {
  date: string;
  availableDates: string[];
  session: SleepSessionView | null;
  stages: SleepStagesView | null;
  hrPoints: HrPoint[];
};

function fmt(v: number | null | undefined) {
  return typeof v === "number" ? String(v) : "–";
}

export default function SleepClient({
  date,
  availableDates,
  session,
  stages,
  hrPoints,
}: Props) {
  const router = useRouter();

  const hasSession = !!session;
  const s = session ?? {
    startTime: "–",
    endTime: "–",
    sleepScore: null,
    efficiencyPct: null,
    durationMin: null,
    timeInBedMin: null,
    avgHr: null,
  };

  const st = stages ?? { awake: 0, light: 0, deep: 0, rem: 0 };

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-white/60">Sleep</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{date}</h1>
        <p className="mt-2 text-white/60">Sleep session summary and charts.</p>

        {availableDates.length > 0 ? (
          <div className="mt-4">
            <select
              value={date}
              onChange={(e) => router.push(`/app/sleep?date=${e.target.value}`)}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            >
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
        {!hasSession ? (
          <div className="text-white/60">No sleep session found for this date.</div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Start</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{s.startTime}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">End</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{s.endTime}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Sleep score</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{fmt(s.sleepScore)}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Efficiency</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {s.efficiencyPct == null ? "–" : `${s.efficiencyPct}%`}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Duration</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {s.durationMin == null ? "–" : `${s.durationMin} min`}
            </div>
            <div className="mt-1 text-xs text-white/40">
              Time in bed: {s.timeInBedMin == null ? "–" : `${s.timeInBedMin} min`}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Avg HR</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{fmt(s.avgHr)}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-2 text-sm font-medium text-white/80">Stages</div>
            <SleepStagesBar stages={st} />
            <div className="mt-3 text-xs text-white/45">
              Values are minutes derived from stored stage seconds.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <SleepHRLine points={hrPoints} />
            <div className="mt-3 text-xs text-white/45">
              Time axis is minutes from sleep start.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}