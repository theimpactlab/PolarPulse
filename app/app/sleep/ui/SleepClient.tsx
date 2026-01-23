"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { RingProgress } from "@/src/components/RingProgress";
import { SleepStagesBar } from "@/src/components/SleepStagesBar";
import { SleepHRLine } from "@/src/components/SleepHRLine";

type Session = {
  id: string;
  sleep_date: string;
  sleep_start: string | null;
  sleep_end: string | null;
  duration_min: number | null;
  time_in_bed_min: number | null;
  efficiency_pct: number | null;
  sleep_score: number | null;
  avg_hr: number | null;
  avg_resp_rate: number | null;
};

type StageRow = { stage: string; minutes: number };
type HRPoint = { t: number; hr: number };

function fmt(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function fmtMins(n: number | null) {
  if (n == null) return "–";
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function SleepClient({
  date,
  session,
  stages,
  hrSeries,
  availableDates,
}: {
  date: string;
  session: Session | null;
  stages: StageRow[];
  hrSeries: HRPoint[];
  availableDates: string[];
}) {
  const stageData = useMemo(() => stages, [stages]);
  const hrData = useMemo(() => hrSeries, [hrSeries]);

  const prevDate = useMemo(() => {
    const i = availableDates.indexOf(date);
    if (i <= 0) return null;
    return availableDates[i - 1];
  }, [availableDates, date]);

  const nextDate = useMemo(() => {
    const i = availableDates.indexOf(date);
    if (i < 0 || i >= availableDates.length - 1) return null;
    return availableDates[i + 1];
  }, [availableDates, date]);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-sm text-white/60">Sleep</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{fmt(date)}</h1>
          <p className="mt-2 text-white/60">Stages and heart rate for the selected night.</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            href={`/app/sleep?date=${prevDate ?? date}`}
            aria-disabled={!prevDate}
          >
            ←
          </Link>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
            {date}
          </div>

          <Link
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            href={`/app/sleep?date=${nextDate ?? date}`}
            aria-disabled={!nextDate}
          >
            →
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
        <div className="grid grid-cols-3 gap-3">
          <RingProgress value={session?.sleep_score ?? null} max={100} label="Sleep score" />
          <RingProgress value={session?.efficiency_pct ?? null} max={100} label="Efficiency" />
          <RingProgress value={session?.avg_hr ?? null} max={100} label="Avg HR" />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Duration</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {fmtMins(session?.duration_min ?? null)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Time in bed</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {fmtMins(session?.time_in_bed_min ?? null)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Resp rate</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {session?.avg_resp_rate ?? "–"}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-2 text-sm font-medium text-white/80">Stages</div>
            <SleepStagesBar stages={stageData} />
            {!stageData.length && (
              <div className="mt-3 text-xs text-white/45">No stage data for this date.</div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-2 text-sm font-medium text-white/80">Heart rate</div>
            <SleepHRLine points={hrData} />
            {!hrData.length && (
              <div className="mt-3 text-xs text-white/45">No HR series for this date.</div>
            )}
          </div>
        </div>

        {!session && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
            No sleep session found for this date.
          </div>
        )}
      </div>
    </div>
  );
}