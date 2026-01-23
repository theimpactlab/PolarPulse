// app/app/sleep/page.tsx
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import SleepClient from ".ui/SleepClient";

export default async function SleepPage() {
  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80">Not signed in.</div>;
  }

  const userId = userRes.user.id;

  // Most recent sleep session for this user
  const { data: session, error: sErr } = await supabase
    .from("sleep_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("sleep_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sErr || !session) {
    return <div className="text-white/60">No sleep data available yet.</div>;
  }

  // Stages for this sleep session
  const { data: stages, error: stErr } = await supabase
    .from("sleep_stages")
    .select("stage,start_time,end_time,duration_sec")
    .eq("sleep_session_id", session.id)
    .order("start_time", { ascending: true });

  if (stErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep stages</div>
        <div className="mt-2 text-sm text-white/50">{stErr.message}</div>
      </div>
    );
  }

  // HR series for this sleep session
  const { data: hrSeries, error: hrErr } = await supabase
    .from("sleep_hr_series")
    .select("ts,hr")
    .eq("sleep_session_id", session.id)
    .order("ts", { ascending: true });

  if (hrErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep heart rate</div>
        <div className="mt-2 text-sm text-white/50">{hrErr.message}</div>
      </div>
    );
  }

  return (
    <SleepClient
      session={session}
      stages={stages ?? []}
      hrSeries={hrSeries ?? []}
    />
  );
}