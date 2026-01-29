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
  created_at?: string | null;
};

type SleepStageRow = {
  stage: string;
  minutes: number | null; // IMPORTANT: in your real data this is MINUTES already
};

type SleepHrRow = {
  t_offset_sec: number;
  hr: number;
};

type SearchParamsShape = { date?: string };

// Next.js 15 sometimes types searchParams as a Promise.
// Accept both without fighting the framework typing.
async function readSearchParams(searchParams: any): Promise<SearchParamsShape> {
  if (!searchParams) return {};
  if (typeof searchParams?.then === "function") {
    const awaited = await searchParams;
    return (awaited ?? {}) as SearchParamsShape;
  }
  return (searchParams ?? {}) as SearchParamsShape;
}

function normalizeStageMinutes(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;

  // Heuristic:
  // - Most real rows are already minutes (e.g. 333, 112, 46).
  // - If you ever ingest seconds by accident, they'd likely be > 1000.
  //   In that case, convert seconds -> minutes.
  if (n > 1000) return Math.round(n / 60);

  return Math.round(n);
}

function clampPct(n: number) {
  return Math.max(0, Math.min(100, n));
}

export default async function SleepPage(props: any) {
  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80">Not signed in.</div>;
  }

  const sp = await readSearchParams(props?.searchParams);
  const requested = sp?.date;
  const date = isIsoDate(requested) ? requested : iso(new Date());

  // ------------------------------------------------------------
  // Build available dates list for picker (distinct sleep_date)
  // ------------------------------------------------------------
  const { data: datesRows, error: dErr } = await supabase
    .from("sleep_sessions")
    .select("sleep_date")
    .eq("user_id", userRes.user.id)
    .order("sleep_date", { ascending: false });

  if (dErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep dates</div>
        <div className="mt-2 text-sm text-white/50">{dErr.message}</div>
      </div>
    );
  }

  const availableDates = Array.from(
    new Set((datesRows ?? []).map((r: any) => r.sleep_date).filter(isIsoDate)),
  );

  // ------------------------------------------------------------
  // Load the sleep session for that date (latest created_at)
  // ------------------------------------------------------------
  const { data: session, error: sErr } = await supabase
    .from("sleep_sessions")
    .select(
      "id,sleep_date,sleep_start,sleep_end,duration_min,time_in_bed_min,efficiency_pct,sleep_score,avg_hr,raw,created_at",
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
      <SleepClient
        date={date}
        sleepScore={sleepScore ?? null}
        session={null}
        stages={[
          { stage: "awake", minutes: 0 },
          { stage: "light", minutes: 0 },
          { stage: "deep", minutes: 0 },
          { stage: "rem", minutes: 0 },
        ]}
        hrSeries={[]}
      />
    );
  }

  // Prefer explicit columns, then fall back to raw payload keys
  const startDt =
    asDate(session.sleep_start) ??
    asDate(session.raw?.["sleep_start"]) ??
    asDate(session.raw?.["sleep-start"]);
  const endDt =
    asDate(session.sleep_end) ??
    asDate(session.raw?.["sleep_end"]) ??
    asDate(session.raw?.["sleep-end"]);

  const derivedTimeInBedMin = minutesBetween(startDt, endDt);

  const durationMin =
    typeof session.duration_min === "number" && session.duration_min > 0
      ? Math.round(session.duration_min)
      : derivedTimeInBedMin;

  // time_in_bed_min not populated: derive it
  const timeInBedMin =
    typeof session.time_in_bed_min === "number" && session.time_in_bed_min > 0
      ? Math.round(session.time_in_bed_min)
      : derivedTimeInBedMin;

  // ------------------------------------------------------------
  // Load stages (minutes column is minutes already in your current backend)
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

  const stageMinutesByKey: Record<"awake" | "light" | "deep" | "rem", number> = {
    awake: 0,
    light: 0,
    deep: 0,
    rem: 0,
  };

  for (const r of stageRows ?? []) {
    const min = normalizeStageMinutes(r.minutes);
    const k = String(r.stage ?? "").toUpperCase();
    if (k === "WAKE" || k === "AWAKE") stageMinutesByKey.awake += min;
    else if (k === "LIGHT") stageMinutesByKey.light += min;
    else if (k === "DEEP") stageMinutesByKey.deep += min;
    else if (k === "REM") stageMinutesByKey.rem += min;
  }

  // ------------------------------------------------------------
  // Efficiency (requested improvement)
  // (light + deep + rem) / duration * 100
  // ------------------------------------------------------------
  const asleepMin =
    (stageMinutesByKey.light ?? 0) +
    (stageMinutesByKey.deep ?? 0) +
    (stageMinutesByKey.rem ?? 0);

  const efficiencyPct =
    typeof session.efficiency_pct === "number" && session.efficiency_pct > 0
      ? Math.round(session.efficiency_pct)
      : durationMin && durationMin > 0
        ? clampPct(Math.round((asleepMin / durationMin) * 100))
        : null;

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