// app/app/sleep/SleepClient.tsx
"use client";

import SleepStagesBar from "./SleepStagesBar";
import SleepHRLine from "./SleepHRLine";

type SleepSession = {
  id: string;
  user_id: string;
  sleep_date: string;

  duration_min: number | null;
  time_in_bed_min: number | null;
  efficiency_pct: number | null;

  sleep_score: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_resp_rate: number | null;

  created_at?: string | null;
  updated_at?: string | null;

  // allow extra columns without breaking
  [key: string]: any;
};

type SleepStageRow = {
  stage: "awake" | "light" | "deep" | "rem";
  start_time: string;
  end_time: string;
  duration_sec: number;
};

type HrPoint = {
  ts: string;
  hr: number;
};

function fmtDateLabel(isoDate: string) {
  // YYYY-MM-DD -> DD/MM/YYYY (UK friendly)
  const y = isoDate.slice(0, 4);
  const m = isoDate.slice(5, 7);
  const d = isoDate.slice(8, 10);
  return `${d}/${m}/${y}`;
}

function fmtMinutes(min: number | null) {
  if (min == null) return "–";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function SleepClient({
  session,
  stages,
  hrSeries,
}: {
  session: SleepSession;
  stages: SleepStageRow[];
  hrSeries: HrPoint[];
}) {
  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-white/60">Sleep</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {fmtDateLabel(session.sleep_date)}
        </h1>
        <p className="mt-2 text-white/60">
          Nightly sleep breakdown and heart rate.
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Sleep score" value={session.sleep_score} suffix="" />
        <Stat label="Duration" value={session.duration_min} formatter={fmtMinutes} />
        <Stat label="Efficiency" value={session.efficiency_pct} suffix="%" />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Time in bed" value={session.time_in_bed_min} formatter={fmtMinutes} />
        <Stat label="Avg HR" value={session.avg_hr} suffix=" bpm" />
        <Stat label="Resp rate" value={session.avg_resp_rate} suffix=" /min" />
      </div>

      {/* Stages */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur mb-6">
        <div className="mb-3 text-sm font-medium text-white/80">Sleep stages</div>
        <SleepStagesBar stages={stages} />
      </div>

      {/* HR */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
        <div className="mb-3 text-sm font-medium text-white/80">
          Heart rate during sleep
        </div>
        <SleepHRLine points={hrSeries} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  formatter,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  formatter?: (v: number | null) => string;
}) {
  const display =
    formatter ? formatter(value) : value == null ? "–" : `${value}${suffix ?? ""}`;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{display}</div>
    </div>
  );
}