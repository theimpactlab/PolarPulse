import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import SleepClient from "./ui/SleepClient";

function isoUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Your sleep_stages values often look like seconds (eg 19950).
// Normalize to minutes for display.
function normalizeStageMinutes(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;

  // If it looks like seconds, treat as seconds
  if (n > 2000) return Math.round((n / 60) * 10) / 10; // one decimal place
  return Math.round(n * 10) / 10;
}

export default async function SleepPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80">Not signed in.</div>;
  }

  const userId = userRes.user.id;

  // Default to yesterday (sleep usually belongs to the night before)
  const now = new Date();
  const yday = new Date(now);
  yday.setUTCDate(yday.getUTCDate() - 1);

  const requested = typeof searchParams?.date === "string" ? searchParams.date : "";
  const date = isIsoDate(requested) ? requested : isoUTC(yday);

  // ---- session (pick best = longest duration if multiple) ----
  const { data: sessions, error: sErr } = await supabase
    .from("sleep_sessions")
    .select(
      "id,sleep_date,sleep_start,sleep_end,duration_min,time_in_bed_min,efficiency_pct,sleep_score,avg_hr,avg_resp_rate,created_at",
    )
    .eq("user_id", userId)
    .eq("sleep_date", date);

  if (sErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep session</div>
        <div className="mt-2 text-sm text-white/50">{sErr.message}</div>
      </div>
    );
  }

  const session =
    (sessions ?? [])
      .slice()
      .sort((a: any, b: any) => Number(b.duration_min ?? 0) - Number(a.duration_min ?? 0))[0] ??
    null;

  // ---- stages ----
  const { data: stagesRaw, error: stErr } = await supabase
    .from("sleep_stages")
    .select("stage,minutes")
    .eq("user_id", userId)
    .eq("sleep_date", date);

  if (stErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep stages</div>
        <div className="mt-2 text-sm text-white/50">{stErr.message}</div>
      </div>
    );
  }

  const stages =
    (stagesRaw ?? [])
      .map((r: any) => ({
        stage: String(r.stage ?? ""),
        minutes: normalizeStageMinutes(r.minutes),
      }))
      .filter((r) => r.stage && r.minutes != null) ?? [];

  // ---- HR series ----
  const { data: hrRaw, error: hrErr } = await supabase
    .from("sleep_hr_series")
    .select("sample_index,hr")
    .eq("user_id", userId)
    .eq("sleep_date", date)
    .order("sample_index", { ascending: true });

  if (hrErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load sleep HR series</div>
        <div className="mt-2 text-sm text-white/50">{hrErr.message}</div>
      </div>
    );
  }

  const hrSeries =
    (hrRaw ?? [])
      .map((p: any) => {
        const t = Number(p.sample_index);
        const hr = Number(p.hr);
        if (!Number.isFinite(t) || !Number.isFinite(hr)) return null;
        return { t, hr };
      })
      .filter(Boolean) as Array<{ t: number; hr: number }>;

  // ---- available dates (for arrows/nav) ----
  const { data: dateRows } = await supabase
    .from("sleep_sessions")
    .select("sleep_date")
    .eq("user_id", userId)
    .order("sleep_date", { ascending: false })
    .limit(30);

  const availableDates = Array.from(
    new Set((dateRows ?? []).map((r: any) => String(r.sleep_date)).filter(isIsoDate)),
  ).sort();

  return (
    <SleepClient
      date={date}
      session={session}
      stages={stages}
      hrSeries={hrSeries}
      availableDates={availableDates}
    />
  );
}