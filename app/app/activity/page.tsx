import Link from "next/link";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtDate(d: string) {
  // YYYY-MM-DD -> DD Mon
  const dt = new Date(`${d}T00:00:00Z`);
  return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

export default async function ActivityPage() {
  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) return <div className="text-white/80">Not signed in.</div>;

  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 30);

  const { data: workouts, error } = await supabase
    .from("workouts")
    .select("id,workout_date,type,duration_min,calories,avg_hr,max_hr,start_time")
    .gte("workout_date", iso(from))
    .lte("workout_date", iso(today))
    .order("workout_date", { ascending: false })
    .limit(60);

  if (error) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load workouts</div>
        <div className="mt-2 text-sm text-white/50">{error.message}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-white/60">Activity</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Workouts</h1>
        <p className="mt-2 text-white/60">Last 30 days</p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-3 shadow-xl backdrop-blur">
        {(workouts ?? []).length === 0 ? (
          <div className="p-5 text-sm text-white/60">No workouts found.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {(workouts ?? []).map((w) => (
              <Link
                key={w.id}
                href={`/app/activity/${w.id}`}
                className="block rounded-2xl p-4 hover:bg-white/5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-white/85">
                      {w.type || "Workout"}
                    </div>
                    <div className="mt-1 text-xs text-white/50">
                      {fmtDate(w.workout_date)}
                      {w.start_time
                        ? ` · ${new Date(w.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : ""}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-white">
                      {typeof w.duration_min === "number" ? `${w.duration_min} min` : "–"}
                    </div>
                    <div className="mt-1 text-xs text-white/50 tabular-nums">
                      {typeof w.calories === "number" ? `${w.calories} kcal` : "–"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex gap-2 text-xs text-white/55">
                  <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">
                    Avg HR: {typeof w.avg_hr === "number" ? w.avg_hr : "–"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">
                    Max HR: {typeof w.max_hr === "number" ? w.max_hr : "–"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}