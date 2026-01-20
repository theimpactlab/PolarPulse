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

  // If table doesn’t exist yet or RLS blocks it, show as disconnected
  const connection = cErr ? null : conn;

  return (
    <ProfileClient
      email={userRes.user.email ?? ""}
      connection={connection}
    />
  );
}