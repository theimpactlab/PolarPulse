"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { SleepStagesBar } from "@/src/components/SleepStagesBar";
import { SleepHRLine } from "@/src/components/SleepHRLine";

type Session = {
  startTime: string; // "HH:MM" or "–"
  endTime: string; // "HH:MM" or "–"
  sleepScore: number | null;
  efficiencyPct: number | null;
  durationMin: number | null;
  timeInBedMin: number | null;
  avgHr: number | null;
};

type Stages = {
  awake: number;
  light: number;
  deep: number;
  rem: number;
};

type HrPoint = { t: number; hr: number };

type Props = {
  date: string;
  availableDates: string[];
  session: Session | null;
  stages: Stages;
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

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-white/60">Sleep</div>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{date}</h1>

          {availableDates.length > 0 && (
            <select
              value={date}
              onChange={(e) => router.push(`/app/sleep?date=${encodeURIComponent(e.target.value)}`)}
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            >
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </div>

        <p className="mt-2 text-white/60">Sleep session summary and charts.</p>
      </div>

      {!session ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-white/80">No sleep session found for {date}.</div>
          <div className="mt-2 text-sm text-white/50">
            Try another date from the picker.
          </div>
        </div>
      ) : (
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
                Time in bed:{" "}
                {session.timeInBedMin == null ? "–" : `${session.timeInBedMin} min`}
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
              <SleepStagesBar stages={stages} />
              <div className="mt-3 text-xs text-white/45">
                Values are minutes from <code>sleep_stages.minutes</code>.
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
      )}
    </div>
  );
}