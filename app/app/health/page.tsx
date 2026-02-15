import { createSupabaseServerClient } from '@/src/lib/supabase/server';
import { HealthClient } from './ui/HealthClient';

export default async function HealthPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return <div>Please sign in to view health monitor</div>;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDate = thirtyDaysAgo.toISOString().split('T')[0];

  const [metricsRes, rechargeRes, baselinesRes, profileRes] = await Promise.all([
    supabase
      .from('daily_metrics')
      .select('date, hrv_ms, resting_hr, respiratory_rate, sleep_needed_min, sleep_debt_min, sleep_score, steps')
      .eq('user_id', user.id)
      .gte('date', fromDate)
      .order('date', { ascending: true }),
    supabase
      .from('nightly_recharge')
      .select('date, ans_charge, hrv_avg, hr_avg, breathing_rate_avg')
      .eq('user_id', user.id)
      .gte('date', fromDate)
      .order('date', { ascending: true }),
    supabase
      .from('baselines_28d')
      .select('metric, avg')
      .eq('user_id', user.id)
      .in('metric', ['hrv_ms', 'resting_hr', 'respiratory_rate'])
      .order('computed_on', { ascending: false })
      .limit(3),
    supabase
      .from('profiles')
      .select('date_of_birth')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  if (metricsRes.error) {
    return <div>Error loading health data: {metricsRes.error.message}</div>;
  }

  const baselineRows = baselinesRes.data ?? [];
  const baselineMap: Record<string, number> = {};
  baselineRows.forEach((r: any) => {
    baselineMap[r.metric] = r.avg;
  });

  const baseline = {
    hrv_baseline: baselineMap['hrv_ms'] ?? 50,
    resting_hr_baseline: baselineMap['resting_hr'] ?? 60,
    respiratory_rate_baseline: baselineMap['respiratory_rate'] ?? 15,
  };

  const nightlyRecharge = (rechargeRes.data ?? []).map((r: any) => ({
    date: r.date,
    recovery_index: r.ans_charge,
    hrv_balance: r.hrv_avg,
    breathing_rate: r.breathing_rate_avg,
  }));

  // Compute user age from DOB
  const dob = profileRes.data?.date_of_birth;
  const userAge = dob
    ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000)
    : 30;

  // Build healthspan metrics rows (descending for computeHealthspan)
  const healthspanMetrics = (metricsRes.data || []).slice().reverse().map((r: any) => ({
    date: r.date,
    hrv_ms: r.hrv_ms,
    resting_hr: r.resting_hr,
    sleep_needed_min: r.sleep_needed_min,
    sleep_debt_min: r.sleep_debt_min,
    sleep_score: r.sleep_score,
    steps: r.steps,
    respiratory_rate: r.respiratory_rate,
  }));

  return (
    <HealthClient
      dailyMetrics={metricsRes.data || []}
      nightlyRecharge={nightlyRecharge}
      baselines={baseline}
      healthspanMetrics={healthspanMetrics}
      userAge={userAge}
    />
  );
}
