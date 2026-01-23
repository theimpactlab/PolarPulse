import Link from "next/link";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtDateLabel(d: string) {
  // YYYY-MM-DD -> Mon 12 Jan
  const dt = new Date(d + "T00:00:00Z");
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

type WorkoutRow = {
  id: string;
  workout_date: string;
  type: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_min: number | null;
  calories: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
};

function km(m: number | null) {
  if (typeof m !== "number") return "–";
  return (m / 1000).toFixed(2);
}

function mins(m: number | null) {
  if (typeof m !== "number") return "–";
  return `${Math.round(m)} min`;
}

export default async function ActivityPage() {
  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80">Not signed in.</div>;
  }

  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 30);

  const { data, error } = await supabase
    .from("workouts")
    .select("id,workout_date,type,start_time,end_time,duration_min,calories,distance_m,avg_hr,max_hr")
    .eq("user_id", userRes.user.id)
    .gte("workout_date", iso(from))
    .lte("workout_date", iso(today))
    .order("workout_date", { ascending: false })
    .order("start_time", { ascending: false })
    .returns<WorkoutRow[]>();

  if (error) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load activity</div>
        <div className="mt-2 text-sm text-white/50">{error.message}</div>
      </div>
    );
  }

  const rows = data ?? [];

  // group by date
  const byDate = rows.reduce<Record<string, WorkoutRow[]>>((acc, r) => {
    acc[r.workout_date] = acc[r.workout_date] ?? [];
    acc[r.workout_date].push(r);
    return acc;
  }, {});

  const dates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-white/60">Activity</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Workouts</h1>
        <p className="mt-2 text-white/60">Tap a workout to see heart rate, zones, and performance.</p>
      </div>

      {dates.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white/70">
          No workouts found in the last 30 days.
        </div>
      ) : (
        <div className="space-y-4">
          {dates.map((d) => (
            <div key={d} className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 text-sm font-medium text-white/80">{fmtDateLabel(d)}</div>

              <div className="space-y-2">
                {byDate[d].map((w) => (
                  <Link
                    key={w.id}
                    href={`/app/activity/${w.id}`}
                    prefetch
                    className={[
                      "block rounded-2xl border border-white/10 bg-black/20 p-4",
                      "hover:bg-black/25 active:scale-[0.995] transition",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {w.type ?? "Workout"}
                        </div>
                        <div className="mt-1 text-xs text-white/55">
                          {mins(w.duration_min)} • {km(w.distance_m)} km • {w.calories ?? "–"} cal
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-white/50">Avg HR</div>
                        <div className="text-sm font-semibold tabular-nums text-white">
                          {w.avg_hr ?? "–"}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}