import WeeklyClient from "./ui/WeeklyClient";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getWeekRange(date: Date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setUTCDate(diff));
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return { monday: iso(monday), sunday: iso(sunday) };
}

export default async function WeeklyPage() {
  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80">Not signed in.</div>;
  }

  const today = new Date();
  const currentWeek = getWeekRange(today);

  const lastWeekDate = new Date(today);
  lastWeekDate.setUTCDate(lastWeekDate.getUTCDate() - 7);
  const previousWeek = getWeekRange(lastWeekDate);

  // Fetch this week's daily_metrics - use columns that actually exist in the schema
  const { data: thisWeekMetrics } = await supabase
    .from("daily_metrics")
    .select("date,sleep_score,recovery_score,strain_score,strain_21,active_calories,hrv_ms,resting_hr,steps")
    .eq("user_id", userRes.user.id)
    .gte("date", currentWeek.monday)
    .lte("date", currentWeek.sunday)
    .order("date", { ascending: true });

  // Fetch previous week for comparison
  const { data: prevWeekMetrics } = await supabase
    .from("daily_metrics")
    .select("date,sleep_score,recovery_score,strain_score,strain_21,active_calories,hrv_ms,resting_hr,steps")
    .eq("user_id", userRes.user.id)
    .gte("date", previousWeek.monday)
    .lte("date", previousWeek.sunday)
    .order("date", { ascending: true });

  // Fetch weekly_assessments if available
  const { data: assessmentData } = await supabase
    .from("weekly_assessments")
    .select("week_start,training_state")
    .eq("user_id", userRes.user.id)
    .eq("week_start", currentWeek.monday)
    .maybeSingle();

  return (
    <WeeklyClient
      weekStart={currentWeek.monday}
      weekEnd={currentWeek.sunday}
      thisWeekMetrics={thisWeekMetrics ?? []}
      prevWeekMetrics={prevWeekMetrics ?? []}
      existingAssessment={assessmentData}
    />
  );
}
