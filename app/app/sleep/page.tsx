import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import SleepClient from "./ui/SleepClient";

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toIsoDateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

function minutesBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return Math.max(0, Math.round((tb - ta) / 60000));
}

type SleepSessionRow = {
  id: string;
  user_id: string;
  sleep_date: string;
  sleep_start: string | null;
  sleep_end: string | null;
  duration_min: number | null;
  time_in_bed_min: number | null;
  efficiency_pct: number | null;
  sleep_score: number | null;
  avg_hr: number | null;
  avg_resp_rate: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SleepStageRow = {
  sleep_id: string;
  stage: "awake" | "light" | "deep" | "rem" | string;
  minutes: number | null; // in your DB this appears to actually be seconds
};

type SleepHrSeriesRow = {
  sleep_id: string;
  t_offset_sec: number | null;
  hr: number | null;
};

export default async function SleepPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80">Not signed in.</div>;
  }

  const sp = searchParams ? await searchParams : {};
  const requested = sp?.date ?? "";
  const requestedDate = isIsoDate(requested) ? requested : null;

  // Choose date:
  // 1) explicit ?date=YYYY-MM-DD
  // 2) latest sleep_sessions.sleep_date for user
  // 3) yesterday UTC
  let date = requestedDate;

  if (!date) {
    const { data: latest, error: latestErr } = await supabase
      .from("sleep_sessions")
      .select("sleep_date")
      .eq("user_id", userRes.user.id)
      .order("sleep_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestErr && latest?.sleep_date) {
      date = latest.sleep_date;
    } else {
      const y = new Date();
      y.setUTCDate(y.getUTCDate() - 1);
      date = toIsoDateUTC(y);
    }
  }

  // Pull sessions for that date, pick the "best" (longest duration)
  const { data: sessions, error: sErr } = await supabase
    .from("sleep_sessions")
    .select(
      "id,user_id,sleep_date,sleep_start,sleep_end,duration_min,time_in_bed_min,efficiency_pct,sleep_score,avg_hr,avg_resp_rate,created_at,updated_at",
    )
    .eq("user_id", userRes.user.id)
    .eq("sleep_date", date);

  if (sErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep session</div>
        <div className="mt-2 text-sm text-white/50">{sErr.message}</div>
      </div>
    );
  }

  let session: SleepSessionRow | null = null;

  if (Array.isArray(sessions) && sessions.length) {
    const scored = sessions
      .map((x: any) => {
        const dur =
          typeof x.duration_min === "number" && x.duration_min > 0
            ? x.duration_min
            : minutesBetween(x.sleep_start ?? null, x.sleep_end ?? null) ?? 0;
        return { row: x as SleepSessionRow, dur };
      })
      .sort((a, b) => b.dur - a.dur);

    session = scored[0]?.row ?? null;
  }

  if (!session) {
    return (
      <SleepClient
        date={date}
        session={null}
        stages={null}
        hrSeries={[]}
      />
    );
  }

  // Pull stages for the chosen sleep_id
  const { data: stageRows, error: stErr } = await supabase
    .from("sleep_stages")
    .select("sleep_id,stage,minutes")
    .eq("sleep_id", session.id);

  if (stErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep stages</div>
        <div className="mt-2 text-sm text-white/50">{stErr.message}</div>
      </div>
    );
  }

  // Your "minutes" column appears to actually store seconds.
  // Convert seconds -> minutes for display and charts.
  const totalsMin: Record<string, number> = { awake: 0, light: 0, deep: 0, rem: 0 };

  for (const r of (stageRows ?? []) as SleepStageRow[]) {
    const key = (r.stage ?? "").toLowerCase();
    const sec = typeof r.minutes === "number" ? r.minutes : 0;
    const min = sec / 60;
    if (key in totalsMin) totalsMin[key] += min;
  }

  const stages = {
    awakeMin: totalsMin.awake || 0,
    lightMin: totalsMin.light || 0,
    deepMin: totalsMin.deep || 0,
    remMin: totalsMin.rem || 0,
  };

  // Pull HR series points for the chosen sleep_id
  const { data: hrRows, error: hrErr } = await supabase
    .from("sleep_hr_series")
    .select("sleep_id,t_offset_sec,hr")
    .eq("sleep_id", session.id)
    .order("t_offset_sec", { ascending: true });

  if (hrErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep HR series</div>
        <div className="mt-2 text-sm text-white/50">{hrErr.message}</div>
      </div>
    );
  }

  const hrSeries =
    (hrRows ?? [])
      .map((r: SleepHrSeriesRow) => ({
        t: typeof r.t_offset_sec === "number" ? Math.round(r.t_offset_sec / 60) : null,
        hr: typeof r.hr === "number" ? r.hr : null,
      }))
      .filter((p) => p.t !== null && p.hr !== null)
      .map((p) => ({ t: p.t as number, hr: p.hr as number })) ?? [];

  return (
    <SleepClient
      date={date}
      session={session}
      stages={stages}
      hrSeries={hrSeries}
    />
  );
}