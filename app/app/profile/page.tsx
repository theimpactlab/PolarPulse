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



  return (
    <ProfileClient
      email={userRes.user.email ?? ""}
      userId={userRes.user.id}
      connection={connection}
      profileName={profile?.name ?? ""}
      profileDob={profile?.date_of_birth ?? ""}
      profileAvatarUrl={profile?.avatar_url ?? ""}
    />
  );
}
