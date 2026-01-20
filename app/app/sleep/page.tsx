import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import SleepClient from "./ui/SleepClient";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function SleepPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const supabase = createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) return <div className="text-white/80">Not signed in.</div>;

  // Default: yesterday (sleep belongs to previous night)
  const today = new Date();
  const yday = new Date(today);
  yday.setUTCDate(yday.getUTCDate() - 1);

  const selected = typeof searchParams?.date === "string" ? searchParams.date : iso(yday);

  // Daily score
  const { data: dm, error: dmErr } = await supabase
    .from("daily_metrics")
    .select("date,sleep_score")
    .eq("date", selected)
    .maybeSingle();

  if (dmErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load daily metrics</div>
        <div className="mt-2 text-sm text-white/50">{dmErr.message}</div>
      </div>
    );
  }

  // Sleep session (pick longest if multiple)
  const { data: sessions, error: sErr } = await supabase
    .from("sleep_sessions")
    .select("sleep_start,sleep_end,duration_min,efficiency_pct,sleep_score")
    .eq("sleep_date", selected)
    .order("duration_min", { ascending: false })
    .limit(1);

  if (sErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep session</div>
        <div className="mt-2 text-sm text-white/50">{sErr.message}</div>
      </div>
    );
  }

  const session = sessions?.[0] ?? null;

  // Stages for that date
  const { data: stagesRows, error: stErr } = await supabase
    .from("sleep_stages")
    .select("stage,minutes")
    .eq("sleep_date", selected);

  if (stErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep stages</div>
        <div className="mt-2 text-sm text-white/50">{stErr.message}</div>
      </div>
    );
  }

  // HR series
  const { data: hrRows, error: hrErr } = await supabase
    .from("sleep_hr_series")
    .select("t_offset_min,hr")
    .eq("sleep_date", selected)
    .order("t_offset_min", { ascending: true });

  if (hrErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep HR series</div>
        <div className="mt-2 text-sm text-white/50">{hrErr.message}</div>
      </div>
    );
  }

  return (
    <SleepClient
      date={selected}
      sleepScore={(session?.sleep_score ?? dm?.sleep_score) ?? null}
      session={session}
      stages={stagesRows ?? []}
      hrSeries={(hrRows ?? []).map((r) => ({ t: r.t_offset_min, hr: r.hr }))}
    />
  );
}