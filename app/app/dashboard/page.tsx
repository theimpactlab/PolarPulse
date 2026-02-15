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

  // Run all queries in parallel
  const [metricsRes, rechargeRes, baselinesRes, sleepRes] = await Promise.all([
    supabase
      .from("daily_metrics")
      .select("date,sleep_score,recovery_score,strain_score,strain_21,health_indicator,steps,active_calories,hrv_ms,resting_hr,respiratory_rate,spo2,stress_avg,strain_target_low,strain_target_high,sleep_needed_min,sleep_debt_min,sleep_performance_pct")
      .gte("date", iso(from))
      .lte("date", iso(today))
      .order("date", { ascending: true }),
    // Get the most recent nightly recharge (not just today)
    supabase
      .from("nightly_recharge")
      .select("hrv_avg,hr_avg,hr_min,breathing_rate_avg,ans_charge,ans_charge_status")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("baselines_28d")
      .select("metric,avg")
      .in("metric", ["hrv_ms", "resting_hr", "respiratory_rate", "sleep_score"])
      .order("computed_on", { ascending: false })
      .limit(4),
    // Get the most recent sleep session (not just today)
    supabase
      .from("sleep_sessions")
      .select("duration_min,sleep_needed_min,sleep_debt_min,sleep_performance_pct,sleep_score")
      .order("sleep_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <DashboardClient
      rows={metricsRes.data ?? []}
      recharge={rechargeRes.data}
      baselines={baselinesRes.data ?? []}
      sleepGotMin={sleepRes.data?.duration_min ?? null}
      sleepNeededMin={sleepRes.data?.sleep_needed_min ?? null}
      sleepScore={sleepRes.data?.sleep_score ?? null}
    />
  );
}
