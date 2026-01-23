"use client";

import React from "react";
import { RingProgress } from "@/src/components/RingProgress";
import { SleepStagesBar } from "@/src/components/SleepStagesBar";
import { SleepHRLine } from "@/src/components/SleepHRLine";
import Link from "next/link";

type SleepSession = {
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
  created_at?: string | null;
};

type Props = {
  date: string; // YYYY-MM-DD (sleep_date)
  session: SleepSession | null;
  stages: {
    awakeMin: number | null;
    lightMin: number | null;
    deepMin: number | null;
    remMin: number | null;
  };
  hrSeries: Array<{ tMin: number; hr: number }>;
};

function fmtTime(ts?: string | null) {
  if (!ts) return "–";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtMins(m?: number | null) {
  if (m == null) return "–";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

export default function SleepClient({ date, session, stages, hrSeries }: Props) {
  const stageChart = useMemo(() => {
    // Pass minutes to your bar component (it expects numbers, can be null)
    return [
      { name: "Awake", minutes: stages.awakeMin ?? 0 },
      { name: "Light", minutes: stages.lightMin ?? 0 },
      { name: "Deep", minutes: stages.deepMin ?? 0 },
      { name: "REM", minutes: stages.remMin ?? 0 },
    ];
  }, [stages.awakeMin, stages.lightMin, stages.deepMin, stages.remMin]);

  const hrChart = useMemo(
    () =>
      hrSeries.map((p) => ({
        t: p.tMin, // minutes since sleep start
        hr: p.hr,
      })),
    [hrSeries],
  );

  const hasSession = !!session;

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-white/60">Sleep</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{date}</h1>
        <p className="mt-2 text-white/60">
          {hasSession ? "Your latest sleep details for this date." : "No sleep session found for this date."}
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Sleep score</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {session?.sleep_score ?? "–"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Duration</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {fmtMins(session?.duration_min ?? null)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Avg HR</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {session?.avg_hr ?? "–"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Resp. rate</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {session?.avg_resp_rate ?? "–"}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Start</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {fmtTime(session?.sleep_start ?? null)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">End</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {fmtTime(session?.sleep_end ?? null)}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-2 text-sm font-medium text-white/80">Stages</div>
            <SleepStagesBar data={stageChart} />
            <div className="mt-3 text-xs text-white/45">
              Values are minutes derived from stored stage seconds.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-2 text-sm font-medium text-white/80">Heart rate</div>
            <SleepHRLine data={hrChart} />
            <div className="mt-3 text-xs text-white/45">
              X axis is minutes since sleep start (from t_offset_sec).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}