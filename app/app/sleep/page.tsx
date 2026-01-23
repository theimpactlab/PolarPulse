import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import SleepClient from "./ui/SleepClient";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isIsoDate(v: any): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function asDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function minutesBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  const ms = b.getTime() - a.getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.round(ms / 60000));
}

function hhmmUTC(d: Date | null): string {
  if (!d) return "–";
  return d.toISOString().slice(11, 16); // HH:MM in UTC
}

type SleepSessionRow = {
  id: string;
  sleep_date: string;
  sleep_start: string | null;
  sleep_end: string | null;
  duration_min: number | null;
  time_in_bed_min: number | null;
  efficiency_pct: number | null;
  sleep_score: number | null;
  avg_hr: number | null;
  raw: any | null;
};

type SleepStageRow = {
  stage: string;
  minutes: number | null; // NOTE: in your data this is actually seconds
};

type SleepHrRow = {
  t_offset_sec: number;
  hr: number;
};

export default async function SleepPage({ searchParams }: any) {
  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80">Not signed in.</div>;
  }

  const requested = searchParams?.date;
  const date = isIsoDate(requested) ? requested : iso(new Date());

  // ------------------------------------------------------------
  // Load the sleep session for that date
  // ------------------------------------------------------------
  const { data: session, error: sErr } = await supabase
    .from("sleep_sessions")
    .select(
      "id,sleep_date,sleep_start,sleep_end,duration_min,time_in_bed_min,efficiency_pct,sleep_score,avg_hr,raw",
    )
    .eq("user_id", userRes.user.id)
    .eq("sleep_date", date)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SleepSessionRow>();

  if (sErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep session</div>
        <div className="mt-2 text-sm text-white/50">{sErr.message}</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Sleep</div>
        <div className="mt-2 text-sm text-white/50">
          No sleep session found for {date}.
        </div>
      </div>
    );
  }

  // Use explicit columns first, then fall back to raw payload
  const startDt =
    asDate(session.sleep_start) ?? asDate(session.raw?.["sleep_start"]) ?? asDate(session.raw?.["sleep-start"]);
  const endDt =
    asDate(session.sleep_end) ?? asDate(session.raw?.["sleep_end"]) ?? asDate(session.raw?.["sleep-end"]);

  const derivedTimeInBedMin = minutesBetween(startDt, endDt);
  const durationMin =
    typeof session.duration_min === "number" && session.duration_min > 0
      ? Math.round(session.duration_min)
      : derivedTimeInBedMin;

  // If time_in_bed_min is not populated, use the derived window
  const timeInBedMin =
    typeof session.time_in_bed_min === "number" && session.time_in_bed_min > 0
      ? Math.round(session.time_in_bed_min)
      : derivedTimeInBedMin;

  const efficiencyPct =
    typeof session.efficiency_pct === "number" && session.efficiency_pct > 0
      ? Math.round(session.efficiency_pct)
      : durationMin && timeInBedMin && timeInBedMin > 0
        ? Math.round((durationMin / timeInBedMin) * 100)
        : null;

  // ------------------------------------------------------------
  // Load stages (your "minutes" column is actually seconds)
  // ------------------------------------------------------------
  const { data: stageRows, error: stErr } = await supabase
    .from("sleep_stages")
    .select("stage,minutes")
    .eq("sleep_id", session.id)
    .returns<SleepStageRow[]>();

  if (stErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep stages</div>
        <div className="mt-2 text-sm text-white/50">{stErr.message}</div>
      </div>
    );
  }

  // Convert seconds -> minutes (rounded)
  const stageMinutesByKey: Record<"awake" | "light" | "deep" | "rem", number> = {
    awake: 0,
    light: 0,
    deep: 0,
    rem: 0,
  };

  for (const r of stageRows ?? []) {
    const sec = typeof r.minutes === "number" ? r.minutes : 0;
    const min = Math.round(sec / 60);

    const k = String(r.stage ?? "").toUpperCase();
    if (k === "WAKE" || k === "AWAKE") stageMinutesByKey.awake += min;
    else if (k === "LIGHT") stageMinutesByKey.light += min;
    else if (k === "DEEP") stageMinutesByKey.deep += min;
    else if (k === "REM") stageMinutesByKey.rem += min;
  }

  // ------------------------------------------------------------
  // Load HR series
  // ------------------------------------------------------------
  const { data: hrRows, error: hrErr } = await supabase
    .from("sleep_hr_series")
    .select("t_offset_sec,hr")
    .eq("sleep_id", session.id)
    .order("t_offset_sec", { ascending: true })
    .returns<SleepHrRow[]>();

  if (hrErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep HR series</div>
        <div className="mt-2 text-sm text-white/50">{hrErr.message}</div>
      </div>
    );
  }

  const hrPoints =
    (hrRows ?? [])
      .filter((p) => typeof p.t_offset_sec === "number" && typeof p.hr === "number")
      .map((p) => ({
        t: Math.round(p.t_offset_sec / 60), // minutes from start
        hr: p.hr,
      })) ?? [];

  const avgHrDerived =
    hrPoints.length > 0
      ? Math.round(hrPoints.reduce((a, b) => a + b.hr, 0) / hrPoints.length)
      : null;

  const avgHr =
    typeof session.avg_hr === "number" && session.avg_hr > 0
      ? Math.round(session.avg_hr)
      : avgHrDerived;

  return (
    <SleepClient
      date={date}
      session={{
        startTime: hhmmUTC(startDt),
        endTime: hhmmUTC(endDt),
        sleepScore: session.sleep_score ?? null,
        efficiencyPct,
        durationMin,
        timeInBedMin,
        avgHr,
      }}
      stages={stageMinutesByKey}
      hrPoints={hrPoints}
    />
  );
}