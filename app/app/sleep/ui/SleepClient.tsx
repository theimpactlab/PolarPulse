"use client";

import { useMemo } from "react";
import { SleepStagesBar } from "@/src/components/SleepStagesBar";
import { SleepHRLine } from "@/src/components/SleepHRLine";

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
};

type Stages = {
  awakeMin: number;
  lightMin: number;
  deepMin: number;
  remMin: number;
} | null;

type Props = {
  date: string;
  session: SleepSession | null;
  stages: Stages;
  hrSeries: Array<{ t: number; hr: number }>;
};

function fmtTime(ts: string | null) {
  if (!ts) return "–";
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return "–";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function safeNum(v: number | null | undefined, suffix = "") {
  if (typeof v !== "number" || !Number.isFinite(v)) return "–";
  return `${v}${suffix}`;
}

export default function SleepClient({ date, session, stages, hrSeries }: Props) {
  const stageMap = useMemo(() => {
    if (!stages) return {};
    return {
      awake: stages.awakeMin ?? 0,
      light: stages.lightMin ?? 0,
      deep: stages.deepMin ?? 0,
      rem: stages.remMin ?? 0,
    };
  }, [stages]);

  const hasSession = !!session;

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-white/60">Sleep</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{date}</h1>
        <p className="mt-2 text-white/60">
          {hasSession ? "Sleep session summary and charts." : "No sleep session found for this date."}
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
        <div className="grid grid-cols-2 gap-3">
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

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Sleep score</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {safeNum(session?.sleep_score ?? null)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Efficiency</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {safeNum(session?.efficiency_pct ?? null, "%")}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Duration</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {safeNum(session?.duration_min ?? null, " min")}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Avg HR</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {safeNum(session?.avg_hr ?? null)}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-2 text-sm font-medium text-white/80">Stages</div>
            <SleepStagesBar stages={stageMap} />
            <div className="mt-3 text-xs text-white/45">
              Values are minutes derived from stored stage seconds.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <SleepHRLine points={hrSeries} />
            <div className="mt-3 text-xs text-white/45">
              Time axis is minutes from sleep start.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}