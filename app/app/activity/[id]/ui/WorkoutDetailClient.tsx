"use client";

import React from "react";
import Link from "next/link";
import { WorkoutHRLine } from "@/src/components/WorkoutHRLine";
import { ZoneBars } from "@/src/components/ZoneBars";

type Workout = {
  id: string;
  workout_date: string;
  type: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_min: number | null;
  calories: number | null;
  avg_hr: number | null;
  max_hr: number | null;
};

function fmtDate(iso: string) {
  const dt = new Date(`${iso}T00:00:00Z`);
  return dt.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
}

export default function WorkoutDetailClient({
  workout,
  hrSeries,
  zones,
}: {
  workout: Workout;
  hrSeries: Array<{ t: number; hr: number }>;
  zones: Array<{ zone: number; minutes: number }>;
}) {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-white/60">Activity</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {workout.type || "Workout"}
            </h1>
            <p className="mt-2 text-white/60">{fmtDate(workout.workout_date)}</p>
          </div>

          <Link
            href="/app/activity"
            className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Back
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Duration</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {typeof workout.duration_min === "number" ? `${workout.duration_min} min` : "–"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Calories</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {typeof workout.calories === "number" ? `${workout.calories} kcal` : "–"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Avg HR</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {typeof workout.avg_hr === "number" ? `${workout.avg_hr} bpm` : "–"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Max HR</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {typeof workout.max_hr === "number" ? `${workout.max_hr} bpm` : "–"}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <WorkoutHRLine points={hrSeries} />
        </div>

        <div className="mt-6">
          <ZoneBars zones={zones} />
        </div>
      </div>
    </div>
  );
}