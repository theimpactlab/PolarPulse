// app/app/sleep/page.tsx
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

  // Polar sometimes returns "YYYY-MM-DDTHH:mm:ss" without timezone.
  // Force UTC in that case to avoid local-time skew.
  if (typeof v === "string") {
    const hasTz = /[zZ]|[+-]\d{2}:\d{2}$/.test(v);
    const s = hasTz ? v : `${v}Z`;
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
  }

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
  return d.toISOString().slice(11, 16);
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
  minutes: number | null; // In your DB this is actually seconds
};

type SleepHrRow = {
  t_offset_sec: number;
  hr: number;
};

type PageProps = {
  searchParams?: Promise<{ date?: string }>;
};

export default async function SleepPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80">Not signed in.</div>;
  }

  const sp = (await searchParams) ?? {};
  const requested = sp?.date;
  const date = isIsoDate(requested) ? requested : iso(new Date());

  // ------------------------------------------------------------
  // Available dates for picker (most recent first)
  // ------------------------------------------------------------
  const { data: dateRows, error: datesErr } = await supabase
    .from("sleep_sessions")
    .select("sleep_date")
    .eq("user_id", userRes.user.id)
    .order("sleep_date", { ascending: false })
    .limit(90);

  if (datesErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep dates</div>
        <div className="mt-2 text-sm text-white/50">{datesErr.message}</div>
      </div>
    );
  }

  const availableDates =
    (dateRows ?? [])
      .map((r: any) => r.sleep_date)
      .filter((d: any): d is string => isIsoDate(d));

  const effectiveDate = availableDates.includes(date)
    ? date
    : (availableDates[0] ?? date);

  // ------------------------------------------------------------
  // Load the sleep session for that date
  // ------------------------------------------------------------
  const { data: session, error: sErr } = await supabase
    .from("sleep_sessions")
    .select(
      "id,sleep_date,sleep_start,sleep_end,duration_min,time_in_bed_min,efficiency_pct,sleep_score,avg_hr,raw",
    )
    .eq("user_id", userRes.user.id)
    .eq("sleep_date", effectiveDate)
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
      <SleepClient
        date={effectiveDate}
        availableDates={availableDates}
        session={null}
        stages={null}
        hrPoints={[]}
      />
    );
  }

  // Use explicit columns first, then fall back to raw payload
  const startDt =
    asDate(session.sleep_start) ??
    asDate(session.raw?.sleep_start) ??
    asDate(session.raw?.["sleep-start"]);

  const endDt =
    asDate(session.sleep_end) ??
    asDate(session.raw?.sleep_end) ??
    asDate(session.raw?.["sleep-end"]);

  const derivedTimeInBedMin = minutesBetween(startDt, endDt);

  const durationMin =
    typeof session.duration_min === "number" && session.duration_min > 0
      ? Math.round(session.duration_min)
      : derivedTimeInBedMin;

  const timeInBedMin =
    typeof session.time_in_bed_min === "number" && session.time_in_bed_min > 0
      ? Math.round(session.time_in_bed_min)
      : derivedTimeInBedMin;

  const efficiencyPct =
    typeof session.efficiency_pct === "number" && session.efficiency_pct > 0
      ? Math.round(session.efficiency_pct)
      : durationMin != null && timeInBedMin != null && timeInBedMin > 0
        ? Math.round((durationMin / timeInBedMin) * 100)
        : null;

  // ------------------------------------------------------------
  // Load stages (DB column called "minutes" but it stores seconds)
  // Sum seconds per stage first, then convert once (avoids rounding losses).
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

  const secByKey: Record<"awake" | "light" | "deep" | "rem", number> = {
    awake: 0,
    light: 0,
    deep: 0,
    rem: 0,
  };

  for (const r of stageRows ?? []) {
    const sec = typeof r.minutes === "number" ? r.minutes : 0;
    const k = String(r.stage ?? "").toUpperCase();

    if (k === "WAKE" || k === "AWAKE") secByKey.awake += sec;
    else if (k === "LIGHT") secByKey.light += sec;
    else if (k === "DEEP") secByKey.deep += sec;
    else if (k === "REM") secByKey.rem += sec;
  }

  const stageMinutesByKey = {
    awake: Math.round(secByKey.awake / 60),
    light: Math.round(secByKey.light / 60),
    deep: Math.round(secByKey.deep / 60),
    rem: Math.round(secByKey.rem / 60),
  };

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
      date={effectiveDate}
      availableDates={availableDates}
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