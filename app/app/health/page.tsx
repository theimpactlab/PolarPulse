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
