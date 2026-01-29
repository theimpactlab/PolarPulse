import SleepClient from "./ui/SleepClient";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function SleepPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;

  // In your project this returns a Promise, so it must be awaited.
  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80">Not signed in.</div>;
  }

  // Sleep belongs to the previous night
  const today = new Date();
  const yday = new Date(today);
  yday.setUTCDate(yday.getUTCDate() - 1);

  const selectedDate =
    typeof sp?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
      ? sp.date
      : iso(yday);

  // 1) Get the sleep session for this date (this is the only table with sleep_date)
  const { data: sessionRow, error: sErr } = await supabase
    .from("sleep_sessions")
    .select(
      "id,sleep_start,sleep_end,duration_min,efficiency_pct,sleep_score,sleep_date"
    )
    .eq("sleep_date", selectedDate)
    .order("sleep_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep session</div>
        <div className="mt-2 text-sm text-white/50">{sErr.message}</div>
      </div>
    );
  }

  // If there is no session for that date, render empty UI safely
  if (!sessionRow) {
    return (
      <SleepClient
        date={selectedDate}
        sleepScore={null}
        session={null}
        stages={[]}
        hrSeries={[]}
      />
    );
  }

  const sleepSessionId = sessionRow.id as string | number;

  // 2) Stages are keyed by sleep_session_id (not sleep_date)
  const { data: stageRows, error: stErr } = await supabase
    .from("sleep_stages")
    .select("stage,minutes")
    .eq("sleep_session_id", sleepSessionId);

  if (stErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep stages</div>
        <div className="mt-2 text-sm text-white/50">{stErr.message}</div>
      </div>
    );
  }

  // 3) HR series is keyed by sleep_session_id and uses offset_sec
  const { data: hrRows, error: hrErr } = await supabase
    .from("sleep_hr_series")
    .select("offset_sec,hr")
    .eq("sleep_session_id", sleepSessionId)
    .order("offset_sec", { ascending: true });

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
      date={selectedDate}
      sleepScore={sessionRow.sleep_score ?? null}
      session={{
        sleep_start: sessionRow.sleep_start ?? null,
        sleep_end: sessionRow.sleep_end ?? null,
        duration_min: sessionRow.duration_min ?? null,
        efficiency_pct: sessionRow.efficiency_pct ?? null,
        sleep_score: sessionRow.sleep_score ?? null,
      }}
      stages={(stageRows ?? []).map((r) => ({
        stage: r.stage,
        minutes: r.minutes,
      }))}
      hrSeries={(hrRows ?? []).map((r) => ({
        // Convert sec -> minutes for chart x-axis (keep as number)
        t: typeof r.offset_sec === "number" ? r.offset_sec / 60 : 0,
        hr: r.hr,
      }))}
    />
  );
}