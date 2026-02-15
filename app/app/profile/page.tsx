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

  const connection = cErr ? null : conn;

  // Fetch profile data (name, DOB, avatar)
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, date_of_birth, avatar_url")
    .eq("id", userRes.user.id)
    .maybeSingle();

  // Fetch last 30 days of daily metrics for healthspan calculation
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: metricsRows } = await supabase
    .from("daily_metrics")
    .select("date,hrv_ms,resting_hr,sleep_needed_min,sleep_debt_min,sleep_score,steps,respiratory_rate")
    .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
    .order("date", { ascending: false });

  // Compute user age from DOB
  const dob = profile?.date_of_birth;
  const userAge = dob
    ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000)
    : 30;

  return (
    <ProfileClient
      email={userRes.user.email ?? ""}
      userId={userRes.user.id}
      connection={connection}
      dailyMetrics={metricsRows ?? []}
      userAge={userAge}
      profileName={profile?.name ?? ""}
      profileDob={profile?.date_of_birth ?? ""}
      profileAvatarUrl={profile?.avatar_url ?? ""}
    />
  );
}
