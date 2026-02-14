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

  // Parallel fetch for speed
  const [metricsRes, rechargeRes, baselinesRes] = await Promise.all([
    supabase
      .from('daily_metrics')
      .select('date, hrv_ms, resting_hr, respiratory_rate, spo2, stress_avg')
      .eq('user_id', user.id)
      .gte('date', fromDate)
      .order('date', { ascending: true }),

    supabase
      .from('nightly_recharge')
      .select('date, ans_charge, hrv_avg, hr_avg')
      .eq('user_id', user.id)
      .gte('date', fromDate)
      .order('date', { ascending: true }),

    supabase
      .from('baselines_28d')
      .select('metric, avg')
      .eq('user_id', user.id)
      .in('metric', ['hrv_ms', 'resting_hr', 'respiratory_rate', 'spo2', 'stress_avg'])
      .order('computed_on', { ascending: false })
      .limit(5),
  ]);

  if (metricsRes.error) {
    return <div>Error loading health data: {metricsRes.error.message}</div>;
  }

  // Map baselines_28d rows to the shape HealthClient expects
  const baselineRows = baselinesRes.data ?? [];
  const baselineMap: Record<string, number> = {};
  baselineRows.forEach((r: any) => { baselineMap[r.metric] = r.avg; });

  const baseline = {
    hrv_baseline: baselineMap['hrv_ms'] ?? 50,
    resting_hr_baseline: baselineMap['resting_hr'] ?? 60,
    respiratory_rate_baseline: baselineMap['respiratory_rate'] ?? 15,
    spo2_baseline: baselineMap['spo2'] ?? 97,
    stress_baseline: baselineMap['stress_avg'] ?? 40,
  };

  // Map nightly_recharge to the shape HealthClient expects
  const nightlyRecharge = (rechargeRes.data ?? []).map((r: any) => ({
    date: r.date,
    recovery_index: r.ans_charge,
    hrv_balance: r.hrv_avg,
    rmssd_sleep: null,
  }));

  return (
    <HealthClient
      dailyMetrics={metricsRes.data || []}
      nightlyRecharge={nightlyRecharge}
      baselines={baseline}
    />
  );
}
import { createSupabaseServerClient } from '@/src/lib/supabase/server';
import { HealthClient } from './ui/HealthClient';

export default async function HealthPage() {
  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return <div>Please sign in to view health monitor</div>;
  }

  // Fetch last 30 days of daily metrics
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: dailyMetrics, error: metricsError } = await supabase
    .from('daily_metrics')
    .select(
      'date, hrv_ms, resting_hr, respiratory_rate, spo2, stress_avg'
    )
    .eq('user_id', user.id)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true });

  // Fetch last 30 days of nightly recharge data
  const { data: nightlyRecharge, error: nightlyError } = await supabase
    .from('nightly_recharge')
    .select('date, recovery_index, hrv_balance, rmssd_sleep')
    .eq('user_id', user.id)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true });

  // Fetch baselines for comparison
  const { data: baselines, error: baselinesError } = await supabase
    .from('user_baselines')
    .select('hrv_baseline, resting_hr_baseline, respiratory_rate_baseline, spo2_baseline, stress_baseline')
    .eq('user_id', user.id)
    .single();

  if (metricsError || nightlyError) {
    return <div>Error loading health data</div>;
  }

  const baseline = baselines || {
    hrv_baseline: 50,
    resting_hr_baseline: 60,
    respiratory_rate_baseline: 15,
    spo2_baseline: 97,
    stress_baseline: 40,
  };

  return (
    <HealthClient
      dailyMetrics={dailyMetrics || []}
      nightlyRecharge={nightlyRecharge || []}
      baselines={baseline}
    />
  );
}
