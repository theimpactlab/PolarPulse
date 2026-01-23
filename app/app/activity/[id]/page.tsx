import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import WorkoutDetailClient from "../ui/WorkoutDetailClient";

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
  raw: any | null;
};

type ZoneRow = {
  zone: number;          // 1..5
  minutes: number | null; // minutes
};

type HrRow = {
  t_offset_sec: number;
  hr: number;
};

export default async function WorkoutDetailPage({ params }: any) {
  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80">Not signed in.</div>;
  }

  const id = params?.id as string;

  const { data: workout, error: wErr } = await supabase
    .from("workouts")
    .select("id,workout_date,type,start_time,end_time,duration_min,calories,distance_m,avg_hr,max_hr,raw")
    .eq("user_id", userRes.user.id)
    .eq("id", id)
    .maybeSingle<WorkoutRow>();

  if (wErr || !workout) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Workout not found</div>
        <div className="mt-2 text-sm text-white/50">{wErr?.message ?? "Missing workout"}</div>
      </div>
    );
  }

  // HR zones (if you have them)
  const { data: zonesRows } = await supabase
    .from("workout_hr_zones")
    .select("zone,minutes")
    .eq("workout_id", workout.id)
    .order("zone", { ascending: true })
    .returns<ZoneRow[]>();

  const zones = (zonesRows ?? []).reduce<Record<number, number>>((acc, r) => {
    acc[r.zone] = (acc[r.zone] ?? 0) + (typeof r.minutes === "number" ? r.minutes : 0);
    return acc;
  }, {});

  // HR series (if you have it)
  const { data: hrRows } = await supabase
    .from("workout_hr_series")
    .select("t_offset_sec,hr")
    .eq("workout_id", workout.id)
    .order("t_offset_sec", { ascending: true })
    .returns<HrRow[]>();

  const hrPoints =
    (hrRows ?? [])
      .filter((p) => typeof p.t_offset_sec === "number" && typeof p.hr === "number")
      .map((p) => ({
        t: Math.round(p.t_offset_sec / 60), // minutes from start
        hr: p.hr,
      })) ?? [];

  return (
    <WorkoutDetailClient
      workout={{
        id: workout.id,
        date: workout.workout_date,
        type: workout.type ?? "Workout",
        durationMin: workout.duration_min ?? null,
        calories: workout.calories ?? null,
        distanceM: workout.distance_m ?? null,
        avgHr: workout.avg_hr ?? null,
        maxHr: workout.max_hr ?? null,
      }}
      hrPoints={hrPoints}
      zones={{
        z1: zones[1] ?? 0,
        z2: zones[2] ?? 0,
        z3: zones[3] ?? 0,
        z4: zones[4] ?? 0,
        z5: zones[5] ?? 0,
      }}
    />
  );
}