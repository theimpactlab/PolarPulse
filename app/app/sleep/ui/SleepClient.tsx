"use client";

import React from "react";
import { SleepStagesBar } from "@/src/components/SleepStagesBar";
import { SleepHRLine } from "@/src/components/SleepHRLine";

type Props = {
  date: string;
  session: {
    startTime: string; // "HH:MM" or "–"
    endTime: string; // "HH:MM" or "–"
    sleepScore: number | null;
    efficiencyPct: number | null;
    durationMin: number | null;
    timeInBedMin: number | null;
    avgHr: number | null;
  };
  stages: {
    awake: number;
    light: number;
    deep: number;
    rem: number;
  };
  hrPoints: Array<{ t: number; hr: number }>;
};

function fmt(v: number | null | undefined) {
  return typeof v === "number" ? String(v) : "–";
}

export default function SleepClient({ date, session, stages, hrPoints }: Props) {
  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-white/60">Sleep</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{date}</h1>
        <p className="mt-2 text-white/60">Sleep session summary and charts.</p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Start</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {session.startTime}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">End</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {session.endTime}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Sleep score</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {fmt(session.sleepScore)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Efficiency</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {session.efficiencyPct == null ? "–" : `${session.efficiencyPct}%`}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Duration</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {session.durationMin == null ? "–" : `${session.durationMin} min`}
            </div>
            <div className="mt-1 text-xs text-white/40">
              Time in bed: {session.timeInBedMin == null ? "–" : `${session.timeInBedMin} min`}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Avg HR</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {fmt(session.avgHr)}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-2 text-sm font-medium text-white/80">Stages</div>
            <SleepStagesBar
              stages={{
                awake: stages.awake,
                light: stages.light,
                deep: stages.deep,
                rem: stages.rem,
              }}
            />
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