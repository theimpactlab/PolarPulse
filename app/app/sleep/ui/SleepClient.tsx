"use client";

import { RingProgress } from "@/src/components/RingProgress";
import { SleepStagesBar } from "@/src/components/SleepStagesBar";
import { SleepHRLine } from "@/src/components/SleepHRLine";
import { SleepCoach } from "@/src/components/SleepCoach";
import Link from "next/link";

type Session = {
  sleep_start: string | null;
  sleep_end: string | null;
  duration_min: number | null;
  time_in_bed_min: number | null;
  efficiency_pct: number | null;
  sleep_score: number | null;
  avg_hr: number | null;
  min_hr: number | null;
  max_hr: number | null;
  avg_resp_rate: number | null;
  sleep_needed_min: number | null;
  sleep_debt_min: number | null;
  sleep_performance_pct: number | null;
  latency_min: number | null;
};

type Stage = { stage: string; minutes: number };
type HRPoint = { t: number; hr: number };
type RecentSleep = {
  date: string;
  score: number | null;
  duration: number | null;
  efficiency: number | null;
  performance: number | null;
};

interface SleepClientProps {
  date: string;
  sleepScore: number | null;
  session: Session | null;
  stages: Stage[];
  hrSeries: HRPoint[];
  recentSleep: RecentSleep[];
}

function getSleepColor(score: number | null): string {
  if (score === null) return "#666666";
  if (score >= 85) return "#4ade80";
  if (score >= 70) return "#60a5fa";
  if (score >= 55) return "#facc15";
  return "#f87171";
}

function formatTime(isoString: string | null): string {
  if (!isoString) return "--:--";
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateNorm = new Date(dateStr + "T00:00:00Z");
  dateNorm.setUTCHours(0, 0, 0, 0);
  if (dateNorm.getTime() === today.getTime()) return "Tonight";
  if (dateNorm.getTime() === yesterday.getTime()) return "Last Night";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function getPrevDate(dateStr: string): string {
  const date = new Date(dateStr);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function getNextDate(dateStr: string): string {
  const date = new Date(dateStr);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function fmtDuration(mins: number | null): string {
  if (!mins) return "--";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function SleepClient({
  date,
  sleepScore,
  session,
  stages,
  hrSeries,
  recentSleep,
}: SleepClientProps) {
  const sleepColor = getSleepColor(sleepScore);

  return (
    <div className="min-h-screen bg-black text-white/90">
      {/* Header with date navigation */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            href={`/app/sleep?date=${getPrevDate(date)}`}
            className="p-2 hover:bg-white/5 rounded-lg transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </Link>
          <h1 className="text-lg font-semibold">{getDateDisplay(date)}</h1>
          <Link
            href={`/app/sleep?date=${getNextDate(date)}`}
            className="p-2 hover:bg-white/5 rounded-lg transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-28">
        {!session ? (
          <div className="text-center py-16">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4 text-white/40">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <p className="text-white/50 text-sm">No sleep data available</p>
          </div>
        ) : (
          <>
            {/* Sleep Score Ring */}
            <div className="flex flex-col items-center pt-6 pb-2">
              <RingProgress
                value={sleepScore ?? 0}
                max={100}
                size={200}
                stroke={10}
                color={sleepColor}
                label={sleepScore != null ? String(sleepScore) : "--"}
                sublabel="Sleep Score"
              />
            </div>

            {/* Sleep Coach */}
            {sleepScore !== null && (
              <div className="mt-4">
                <SleepCoach
                  sleepGotMin={session?.duration_min ?? null}
                  sleepNeededMin={session?.sleep_needed_min ?? null}
                  sleepDebtMin={session?.sleep_debt_min ?? null}
                  sleepPerformancePct={session?.sleep_performance_pct ?? null}
                />
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Duration</div>
                <div className="text-xl font-semibold">{fmtDuration(session.duration_min)}</div>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Efficiency</div>
                <div className="text-xl font-semibold">
                  {session.efficiency_pct ? `${Math.round(session.efficiency_pct)}%` : "--"}
                </div>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Time in Bed</div>
                <div className="text-xl font-semibold">{fmtDuration(session.time_in_bed_min)}</div>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Latency</div>
                <div className="text-xl font-semibold">
                  {session.latency_min ? `${Math.round(session.latency_min)}m` : "--"}
                </div>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Avg HR</div>
                <div className="text-xl font-semibold">
                  {session.avg_hr ? `${Math.round(session.avg_hr)} bpm` : "--"}
                </div>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Resp Rate</div>
                <div className="text-xl font-semibold">
                  {session.avg_resp_rate ? `${Math.round(session.avg_resp_rate)}/min` : "--"}
                </div>
              </div>
            </div>

            {/* Sleep Times */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mt-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Sleep Time</div>
                  <div className="text-lg font-semibold">{formatTime(session.sleep_start)}</div>
                </div>
                <div>
                  <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Wake Time</div>
                  <div className="text-lg font-semibold">{formatTime(session.sleep_end)}</div>
                </div>
              </div>
            </div>

            {/* Sleep Stages */}
            {stages.length > 0 && (
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mt-3">
                <div className="text-white/50 text-[10px] uppercase tracking-wider mb-3">Sleep Stages</div>
                <SleepStagesBar
                  stages={Object.fromEntries(
                    stages.map(
                      (s) =>
                        [
                          s.stage.toLowerCase() as "awake" | "light" | "deep" | "rem",
                          s.minutes,
                        ] as const
                    )
                  )}
                />
              </div>
            )}

            {/* Heart Rate Chart */}
            {hrSeries.length > 0 && (
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mt-3">
                <div className="text-white/50 text-[10px] uppercase tracking-wider mb-3">Heart Rate</div>
                <SleepHRLine points={hrSeries} />
              </div>
            )}

            {/* 7-day Sleep Trend */}
            {recentSleep.length > 0 && (
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 mt-3">
                <div className="text-white/50 text-[10px] uppercase tracking-wider mb-3">Sleep Trends (7 Days)</div>
                <svg viewBox="0 0 200 80" className="w-full h-20" preserveAspectRatio="none">
                  <line x1="0" y1="20" x2="200" y2="20" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                  <line x1="0" y1="40" x2="200" y2="40" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                  <line x1="0" y1="60" x2="200" y2="60" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                  <polyline
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={recentSleep.map((s, i) => {
                      const x = recentSleep.length === 1 ? 100 : (i / (recentSleep.length - 1)) * 196 + 2;
                      const y = 76 - ((s.score ?? 0) / 100) * 72;
                      return `${x},${y}`;
                    }).join(" ")}
                  />
                  <polygon
                    fill="url(#sleepFill)"
                    opacity="0.15"
                    points={[
                      ...recentSleep.map((s, i) => {
                        const x = recentSleep.length === 1 ? 100 : (i / (recentSleep.length - 1)) * 196 + 2;
                        const y = 76 - ((s.score ?? 0) / 100) * 72;
                        return `${x},${y}`;
                      }),
                      `${recentSleep.length === 1 ? 100 : 198},80`,
                      "2,80"
                    ].join(" ")}
                  />
                  {recentSleep.map((s, i) => {
                    const x = recentSleep.length === 1 ? 100 : (i / (recentSleep.length - 1)) * 196 + 2;
                    const y = 76 - ((s.score ?? 0) / 100) * 72;
                    return <circle key={i} cx={x} cy={y} r="3" fill={getSleepColor(s.score)} />;
                  })}
                  <defs>
                    <linearGradient id="sleepFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="flex justify-between mt-1">
                  {recentSleep.map((s, i) => {
                    const dt = new Date(s.date + "T00:00:00Z");
                    const day = dt.toLocaleDateString("en-US", { weekday: "narrow" });
                    return <div key={i} className="text-white/40 text-[9px] flex-1 text-center">{day}</div>;
                  })}
                </div>
              </div>
            )}          </>
        )}
      </div>
    </div>
  );
}
