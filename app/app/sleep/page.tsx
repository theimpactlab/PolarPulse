import SleepClient from "./ui/SleepClient";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function SleepPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80">Not signed in.</div>;
  }

  const today = new Date();
  const yday = new Date(today);
  yday.setUTCDate(yday.getUTCDate() - 1);
  const selectedDate =
    typeof sp?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
      ? sp.date
      : iso(yday);

  // Main session
  const { data: sessionRow } = await supabase
    .from("sleep_sessions")
    .select("id,sleep_start,sleep_end,duration_min,time_in_bed_min,efficiency_pct,sleep_score,sleep_date,avg_hr,min_hr,max_hr,avg_resp_rate,sleep_needed_min,sleep_debt_min,sleep_performance_pct,latency_min")
    .eq("sleep_date", selectedDate)
    .order("sleep_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sessionRow) {
    return <SleepClient date={selectedDate} sleepScore={null} session={null} stages={[]} hrSeries={[]} recentSleep={[]} />;
  }

  const sleepId = sessionRow.id;

  const [stagesRes, hrRes, recentRes] = await Promise.all([
    supabase.from("sleep_stages").select("stage,minutes").eq("sleep_id", sleepId),
    supabase.from("sleep_hr_series").select("t_offset_sec,hr").eq("sleep_id", sleepId).order("t_offset_sec", { ascending: true }),
    // Last 7 days of sleep for trends
    supabase.from("sleep_sessions")
      .select("sleep_date,sleep_score,duration_min,efficiency_pct,sleep_performance_pct")
      .gte("sleep_date", iso(new Date(new Date(selectedDate).getTime() - 6 * 86400000)))
      .lte("sleep_date", selectedDate)
      .order("sleep_date", { ascending: true }),
  ]);

  return (
    <SleepClient
      date={selectedDate}
      sleepScore={sessionRow.sleep_score ?? null}
      session={{
        sleep_start: sessionRow.sleep_start ?? null,
        sleep_end: sessionRow.sleep_end ?? null,
        duration_min: sessionRow.duration_min ?? null,
        time_in_bed_min: sessionRow.time_in_bed_min ?? null,
        efficiency_pct: sessionRow.efficiency_pct ?? null,
        sleep_score: sessionRow.sleep_score ?? null,
        avg_hr: sessionRow.avg_hr ?? null,
        min_hr: sessionRow.min_hr ?? null,
        max_hr: sessionRow.max_hr ?? null,
        avg_resp_rate: sessionRow.avg_resp_rate ?? null,
        sleep_needed_min: sessionRow.sleep_needed_min ?? null,
        sleep_debt_min: sessionRow.sleep_debt_min ?? null,
        sleep_performance_pct: sessionRow.sleep_performance_pct ?? null,
        latency_min: sessionRow.latency_min ?? null,
      }}
      stages={(stagesRes.data ?? []).map((r) => ({ stage: r.stage, minutes: r.minutes }))}
      hrSeries={(hrRes.data ?? []).map((r) => ({
        t: typeof r.t_offset_sec === "number" ? r.t_offset_sec / 60 : 0,
        hr: r.hr,
      }))}
      recentSleep={(recentRes.data ?? []).map((r) => ({
        date: r.sleep_date,
        score: r.sleep_score,
        duration: r.duration_min,
        efficiency: r.efficiency_pct,
        performance: r.sleep_performance_pct,
      }))}
    />
  );
}
