import { createSupabaseServerClient } from '@/src/lib/supabase/server';
import { TrendsClient } from './ui/TrendsClient';

export default async function TrendsPage() {
  const supabase = await createSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return <div>Please sign in to view trends</div>;
  }

  // Fetch last 90 days of daily metrics
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: dailyMetrics, error: metricsError } = await supabase
    .from('daily_metrics')
    .select(
      'date, recovery_score, strain_score, strain_21, sleep_score, hrv_ms, resting_hr, respiratory_rate, steps, active_calories'
    )
    .eq('user_id', user.id)
    .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (metricsError) {
    return <div>Error loading trends data</div>;
  }

  return <TrendsClient data={dailyMetrics || []} />;
}
