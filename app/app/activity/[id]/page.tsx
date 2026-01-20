import Link from "next/link";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import WorkoutDetailClient from "./ui/WorkoutDetailClient";

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: workoutId } = await params;

  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) return <div className="text-white/80">Not signed in.</div>;

  const { data: w, error: wErr } = await supabase
    .from("workouts")
    .select("id,workout_date,type,start_time,end_time,duration_min,calories,avg_hr,max_hr")
    .eq("id", workoutId)
    .maybeSingle();

  if (wErr || !w) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Workout not found</div>
        <div className="mt-3">
          <Link className="text-sm text-white/70 underline" href="/app/activity">
            Back to activity
          </Link>
        </div>
      </div>
    );
  }

  const { data: hrRows, error: hrErr } = await supabase
    .from("workout_hr_series")
    .select("t_offset_min,hr")
    .eq("workout_id", workoutId)
    .order("t_offset_min", { ascending: true });

  if (hrErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load HR series</div>
        <div className="mt-2 text-sm text-white/50">{hrErr.message}</div>
      </div>
    );
  }

  const { data: zoneRows, error: zErr } = await supabase
    .from("workout_hr_zones")
    .select("zone,minutes")
    .eq("workout_id", workoutId)
    .order("zone", { ascending: true });

  if (zErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load HR zones</div>
        <div className="mt-2 text-sm text-white/50">{zErr.message}</div>
      </div>
    );
  }

  return (
    <WorkoutDetailClient
      workout={w}
      hrSeries={(hrRows ?? []).map((r) => ({ t: r.t_offset_min, hr: r.hr }))}
      zones={(zoneRows ?? []).map((r) => ({ zone: r.zone, minutes: r.minutes }))}
    />
  );
}