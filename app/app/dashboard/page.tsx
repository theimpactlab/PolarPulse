import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import DashboardClient from "./ui/DashboardClient";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80">Not signed in.</div>;
  }
  const userId = userRes.user.id;
  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 13);

  const { data: metrics } = await supabase
    .from("daily_metrics")
    .select("date,sleep_score,recovery_score,strain_score,strain_21,health_indicator,steps,active_calories,hrv_ms,resting_hr,respiratory_rate,spo2,stress_avg,strain_target_low,strain_target_high,sleep_needed_min,sleep_debt_min,sleep_performance_pct")
    .gte("date", iso(from))
    .lte("date", iso(today))
    .order("date", { ascending: true });

  const { data: recharge } = await supabase
    .from("nightly_recharge")
    .select("hrv_avg,hr_avg,hr_min,breathing_rate_avg,ans_charge,ans_charge_status")
    .eq("date", iso(today))
    .maybeSingle();

  const { data: baselines } = await supabase
    .from("baselines_28d")
    .select("metric,avg")
    .in("metric", ["hrv_ms", "resting_hr", "respiratory_rate", "sleep_score"])
    .order("computed_on", { ascending: false })
    .limit(4);

  return (
    <DashboardClient
      rows={metrics ?? []}
      recharge={recharge}
      baselines={baselines ?? []}
    />
  );
}
