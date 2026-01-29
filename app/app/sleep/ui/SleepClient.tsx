"use client";

import React from "react";
import { RingProgress } from "@/src/components/RingProgress";
import { SleepStagesBar } from "@/src/components/SleepStagesBar";
import { SleepHRLine } from "@/src/components/SleepHRLine";
import Link from "next/link";

type StageRow = { stage: string; minutes: number };
type Session = {
  sleep_start: string | null;
  sleep_end: string | null;
  duration_min: number | null;
  efficiency_pct: number | null;
  sleep_score: number | null;
};

function minsToHhMm(mins: number | null) {
  if (typeof mins !== "number" || !Number.isFinite(mins)) return "–";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function SleepClient({
  date,
  sleepScore,
  session,
  stages,
  hrSeries,
}: {
  date: string;
  sleepScore: number | null;
  session: Session | null;
  stages: StageRow[];
  hrSeries: Array<{ t: number; hr: number }>;
}) {
  const stageMap = stages.reduce((acc, s) => {
    const k = String(s.stage || "").toLowerCase();
    const v = typeof s.minutes === "number" ? s.minutes : 0;
    (acc as any)[k] = ((acc as any)[k] ?? 0) + v;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-white/60">Sleep</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Night summary
        </h1>
        <p className="mt-2 text-white/60">Date: {date}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            href={`/app/sleep?date=${date}`}
          >
            Refresh
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Ring: smaller on mobile to avoid squashing */}
          <div className="flex justify-center sm:justify-start">
            <div className="block sm:hidden">
              <RingProgress
                value={sleepScore}
                max={100}
                label="Sleep Score"
                size={112}
                stroke={10}
              />
            </div>
            <div className="hidden sm:block">
              <RingProgress
                value={sleepScore}
                max={100}
                label="Sleep Score"
                size={140}
                stroke={12}
              />
            </div>
          </div>

          <div className="min-w-0 sm:ml-4 sm:flex-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
                <div className="text-xs text-white/50">Duration</div>
                <div className="mt-1 text-base font-semibold tabular-nums sm:text-lg">
                  {minsToHhMm(session?.duration_min ?? null)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
                <div className="text-xs text-white/50">Efficiency</div>
                <div className="mt-1 text-base font-semibold tabular-nums sm:text-lg">
                  {typeof session?.efficiency_pct === "number"
                    ? `${Math.round(session.efficiency_pct)}%`
                    : "–"}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/45">
              <span>
                Start:{" "}
                {session?.sleep_start
                  ? new Date(session.sleep_start).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "–"}
              </span>
              <span className="hidden sm:inline">·</span>
              <span>
                End:{" "}
                {session?.sleep_end
                  ? new Date(session.sleep_end).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "–"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <SleepStagesBar
            stages={{
              awake: stageMap["awake"] ?? 0,
              light: stageMap["light"] ?? 0,
              deep: stageMap["deep"] ?? 0,
              rem: stageMap["rem"] ?? 0,
            }}
          />
        </div>

        <div className="mt-6">
          <SleepHRLine points={hrSeries} />
        </div>
      </div>
    </div>
  );
}