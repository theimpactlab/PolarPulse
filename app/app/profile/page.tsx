import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import ProfileClient from "./ui/ProfileClient";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) return <div className="text-white/80">Not signed in.</div>;

  // Read Polar connection row
  const { data: conn, error: cErr } = await supabase
    .from("polar_connections")
    .select("connected_at,last_synced_at,expires_at,scope")
    .maybeSingle();

  // If table doesn't exist yet or RLS blocks it, show as disconnected
  const connection = cErr ? null : conn;

  // Fetch last 30 days of daily metrics for healthspan calculation
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: metricsRows } = await supabase
    .from("daily_metrics")
    .select("date,hrv_ms,resting_hr,sleep_duration_min,sleep_score,steps,respiratory_rate")
    .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
    .order("date", { ascending: false });

  return (
    <ProfileClient
      email={userRes.user.email ?? ""}
      connection={connection}
      dailyMetrics={metricsRows ?? []}
    />
  );
}
