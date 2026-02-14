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

type Stage = {
  stage: string;
  minutes: number;
};

type HRPoint = {
  t: number;
  hr: number;
};

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

function getSleepQualityColor(score: number | null): string {
  if (score === null || score === undefined) return "text-gray-400";
  if (score >= 85) return "text-green-400";
  if (score >= 70) return "text-blue-400";
  if (score >= 55) return "text-yellow-400";
  return "text-red-400";
}

function formatTime(isoString: string | null): string {
  if (!isoString) return "--:--";
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
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
  
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" });
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

export default function SleepClient({
  date,
  sleepScore,
  session,
  stages,
  hrSeries,
  recentSleep,
}: SleepClientProps) {
  return (
    <div className="min-h-screen bg-black text-white/90">
      {/* Header with date navigation */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-4">
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
      <div className="p-4 space-y-6 pb-24">
        {/* No data state */}
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
            {/* Sleep Score Ring with Coach */}
            <div className="flex items-center justify-center pt-4">
              <div className="relative">
                <RingProgress
                  value={sleepScore ?? 0}
                  max={100}
                  size={200}
                  stroke={8}
                  color={
                    sleepScore === null || sleepScore === undefined
                      ? "#999999"
                      : sleepScore >= 85
                        ? "#4ade80"
                        : sleepScore >= 70
                          ? "#60a5fa"
                          : sleepScore >= 55
                            ? "#facc15"
                            : "#f87171"
                  }
                
                  label={sleepScore != null ? String(sleepScore) : "--"}
                  sublabel="Sleep Score"
                />

              </div>
            </div>

            {/* Sleep Coach */}
            {sleepScore !== null && (
              <SleepCoach
                sleepGotMin={session?.duration_min ?? null}
                sleepNeededMin={session?.sleep_needed_min ?? null}
                sleepDebtMin={session?.sleep_debt_min ?? null}
                sleepPerformancePct={session?.sleep_performance_pct ?? null}
              />
            )}

            {/* Sleep Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Duration */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-white/60 text-xs font-medium mb-2">Duration</div>
                <div className="text-xl font-semibold">
                  {session.duration_min ? `${Math.round(session.duration_min / 60)}h ${session.duration_min % 60}m` : "--"}
                </div>
              </div>

              {/* Efficiency */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-white/60 text-xs font-medium mb-2">Efficiency</div>
                <div className="text-xl font-semibold">
                  {session.efficiency_pct ? `${Math.round(session.efficiency_pct)}%` : "--"}
                </div>
              </div>

              {/* Time in Bed */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-white/60 text-xs font-medium mb-2">Time in Bed</div>
                <div className="text-xl font-semibold">
                  {session.time_in_bed_min ? `${Math.round(session.time_in_bed_min / 60)}h ${session.time_in_bed_min % 60}m` : "--"}
                </div>
              </div>

              {/* Latency */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-white/60 text-xs font-medium mb-2">Latency</div>
                <div className="text-xl font-semibold">
                  {session.latency_min ? `${Math.round(session.latency_min)}m` : "--"}
                </div>
              </div>

              {/* Avg HR */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-white/60 text-xs font-medium mb-2">Avg HR</div>
                <div className="text-xl font-semibold">
                  {session.avg_hr ? `${Math.round(session.avg_hr)} bpm` : "--"}
                </div>
              </div>

              {/* Resp Rate */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-white/60 text-xs font-medium mb-2">Resp Rate</div>
                <div className="text-xl font-semibold">
                  {session.avg_resp_rate ? `${Math.round(session.avg_resp_rate)}/min` : "--"}
                </div>
              </div>
            </div>

            {/* Sleep Performance */}
            {session.sleep_performance_pct !== null && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white/60 text-xs font-medium">Sleep Performance</div>
                  <div className="text-sm font-semibold">{Math.round(session.sleep_performance_pct)}%</div>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(session.sleep_performance_pct, 100)}%` }}
                  ></div>
                </div>
                {session.sleep_needed_min && session.duration_min && (
                  <div className="text-white/50 text-xs mt-2">
                    Got {session.duration_min} min of {session.sleep_needed_min} min needed
                  </div>
                )}
              </div>
            )}

            {/* Sleep Times */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-white/60 text-xs font-medium mb-1">Sleep Time</div>
                  <div className="text-lg font-semibold">{formatTime(session.sleep_start)}</div>
                </div>
                <div>
                  <div className="text-white/60 text-xs font-medium mb-1">Wake Time</div>
                  <div className="text-lg font-semibold">{formatTime(session.sleep_end)}</div>
                </div>
              </div>
            </div>

            {/* Sleep Stages */}
            {stages.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-white/60 text-xs font-medium mb-3">Sleep Stages</div>
                <SleepStagesBar stages={Object.fromEntries(
                  stages.map(s => [
                    s.stage.toLowerCase() as "awake" | "light" | "deep" | "rem",
                    s.minutes
                  ])
                )} />
              </div>
            )}

            {/* Heart Rate Chart */}
            {hrSeries.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-white/60 text-xs font-medium mb-3">Heart Rate</div>
                <SleepHRLine points={hrSeries} />
              </div>
            )}

            {/* 7-day Sleep Trend */}
            {recentSleep.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-white/60 text-xs font-medium mb-3">Sleep Trends (7 days)</div>
                <div className="flex items-flex-end justify-between gap-1 h-20">
                  {recentSleep.map((sleep, idx) => {
                    const score = sleep.score ?? 0;
                    const maxScore = 100;
                    const height = (score / maxScore) * 100;
                    const dateObj = new Date(sleep.date + "T00:00:00Z");
                    const dayLabel = dateObj.toLocaleDateString("en-US", { weekday: "narrow" });
                    
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center justify-end gap-1">
                        <div
                          className={`w-full rounded transition-all ${
                            score >= 85
                              ? "bg-green-500"
                              : score >= 70
                                ? "bg-blue-500"
                                : score >= 55
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                          }`}
                          style={{ height: `${Math.max(height, 4)}%` }}
                        ></div>
                        <div className="text-white/50 text-xs">{dayLabel}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
