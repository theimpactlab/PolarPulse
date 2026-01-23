import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import SleepClient from "./ui/SleepClient";

function isoDateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function minutesBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return Math.max(0, Math.round((tb - ta) / 60000));
}

type SearchParams = { date?: string };

export default async function SleepPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};

  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80">Not signed in.</div>;
  }

  // Default to "yesterday UTC" because sleep for a night belongs to the next morning date
  const today = new Date();
  const yday = new Date(today);
  yday.setUTCDate(yday.getUTCDate() - 1);

  const requested = sp.date ?? "";
  const date = isIsoDate(requested) ? requested : isoDateUTC(yday);

  // Get sleep sessions for the date, choose the longest
  const { data: sessions, error: sErr } = await supabase
    .from("sleep_sessions")
    .select(
      "id,sleep_date,sleep_start,sleep_end,duration_min,time_in_bed_min,efficiency_pct,sleep_score,avg_hr,avg_resp_rate,created_at",
    )
    .eq("sleep_date", date)
    .order("duration_min", { ascending: false });

  if (sErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep session</div>
        <div className="mt-2 text-sm text-white/50">{sErr.message}</div>
      </div>
    );
  }

  const session = (sessions ?? [])[0] ?? null;

  if (!session) {
    return (
      <SleepClient
        date={date}
        session={null}
        stages={{ awakeMin: null, lightMin: null, deepMin: null, remMin: null }}
        hrSeries={[]}
      />
    );
  }

  const [{ data: stageRows, error: stErr }, { data: hrRows, error: hrErr }] =
    await Promise.all([
      supabase
        .from("sleep_stages")
        .select("stage,seconds")
        .eq("sleep_id", session.id),
      supabase
        .from("sleep_hr_series")
        .select("t_offset_sec,hr")
        .eq("sleep_id", session.id)
        .order("t_offset_sec", { ascending: true }),
    ]);

  if (stErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep stages</div>
        <div className="mt-2 text-sm text-white/50">{stErr.message}</div>
      </div>
    );
  }

  if (hrErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep HR series</div>
        <div className="mt-2 text-sm text-white/50">{hrErr.message}</div>
      </div>
    );
  }

  const stageSeconds: Record<string, number> = { awake: 0, light: 0, deep: 0, rem: 0 };
  for (const r of stageRows ?? []) {
    const key = String(r.stage ?? "").toLowerCase();
    const secs = typeof r.seconds === "number" ? r.seconds : 0;
    if (key in stageSeconds) stageSeconds[key] += Math.max(0, secs);
  }

  const stages = {
    awakeMin: stageSeconds.awake ? Math.round(stageSeconds.awake / 60) : null,
    lightMin: stageSeconds.light ? Math.round(stageSeconds.light / 60) : null,
    deepMin: stageSeconds.deep ? Math.round(stageSeconds.deep / 60) : null,
    remMin: stageSeconds.rem ? Math.round(stageSeconds.rem / 60) : null,
  };

  const hrSeries =
    (hrRows ?? [])
      .map((r) => ({
        tMin: typeof r.t_offset_sec === "number" ? Math.round(r.t_offset_sec / 60) : null,
        hr: typeof r.hr === "number" ? r.hr : null,
      }))
      .filter((p) => p.tMin !== null && p.hr !== null)
      .map((p) => ({ tMin: p.tMin as number, hr: p.hr as number }));

  const computedDuration = minutesBetween(session.sleep_start, session.sleep_end);

  const durationMin =
    typeof session.duration_min === "number" && session.duration_min > 0
      ? session.duration_min
      : computedDuration;

  const timeInBedMin =
    typeof session.time_in_bed_min === "number" && session.time_in_bed_min > 0
      ? session.time_in_bed_min
      : computedDuration;

  const normalizedSession = {
    ...session,
    duration_min: durationMin ?? null,
    time_in_bed_min: timeInBedMin ?? null,
  };

  return (
    <SleepClient
      date={date}
      session={normalizedSession}
      stages={stages}
      hrSeries={hrSeries}
    />
  );
}