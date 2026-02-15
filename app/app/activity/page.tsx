import Link from "next/link";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { RingProgress } from "@/src/components/RingProgress";
import { StrainCoach } from "@/src/components/StrainCoach";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

type WorkoutRow = {
  id: string;
  workout_date: string;
  type: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_min: number | null;
  calories: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
};

function km(m: number | null) {
  if (typeof m !== "number") return "–";
  return (m / 1000).toFixed(2);
}

function mins(m: number | null) {
  if (typeof m !== "number") return "–";
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
}

function fmtTime(isoStr: string | null) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function getStrainColor(strain: number): string {
  if (strain >= 18) return "#ef4444";
  if (strain >= 14) return "#f97316";
  if (strain >= 10) return "#eab308";
  if (strain >= 6) return "#22d3ee";
  return "#6366f1";
}

function getStrainLabel(strain: number): string {
  if (strain >= 18) return "Overreaching";
  if (strain >= 14) return "Strenuous";
  if (strain >= 10) return "Moderate";
  if (strain >= 6) return "Light";
  return "Minimal";
}
export default async function StrainPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80 p-4">Not signed in.</div>;
  }

  const today = new Date();
  const from30 = new Date(today);
  from30.setUTCDate(from30.getUTCDate() - 30);

  const [strainRes, strainHistoryRes, workoutsRes] = await Promise.all([
    supabase
      .from("daily_metrics")
      .select("strain_21, active_calories, strain_target_low, strain_target_high, recovery_score")
      .eq("user_id", userRes.user.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("daily_metrics")
      .select("date, strain_21")
      .eq("user_id", userRes.user.id)
      .gte("date", iso(from30))
      .order("date", { ascending: true }),
    supabase
      .from("workouts")
      .select("id,workout_date,type,start_time,end_time,duration_min,calories,distance_m,avg_hr,max_hr")
      .eq("user_id", userRes.user.id)
      .gte("workout_date", iso(from30))
      .lte("workout_date", iso(today))
      .order("workout_date", { ascending: false })
      .order("start_time", { ascending: false })
      .returns<WorkoutRow[]>(),
  ]);

  const strain = strainRes.data?.strain_21 ?? 0;
  const recovery = strainRes.data?.recovery_score ?? null;
  const rows = workoutsRes.data ?? [];
  const strainHistory = strainHistoryRes.data ?? [];
  const last7 = strainHistory.slice(-7);
  const target = {
    low: strainRes.data?.strain_target_low ?? 8,
    high: strainRes.data?.strain_target_high ?? 14,
  };

  const byDate = rows.reduce<Record<string, WorkoutRow[]>>((acc, r) => {
    acc[r.workout_date] = acc[r.workout_date] ?? [];
    acc[r.workout_date].push(r);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));

  const strainColor = getStrainColor(strain);
  const strainLabel = getStrainLabel(strain);
  return (
    <div className="min-h-screen bg-black text-white/90">
      <div className="flex flex-col items-center pt-8 pb-2">
        <RingProgress
          value={strain}
          max={21}
          size={200}
          stroke={10}
          color={strainColor}
          label={strain.toFixed(1)}
          sublabel="Day Strain"
        />
        <div className="mt-3 text-sm font-medium" style={{ color: strainColor }}>
          {strainLabel}
        </div>
        <div className="text-white/40 text-xs mt-1">
          {strain.toFixed(1)} / 21.0
        </div>
      </div>

      <div className="px-4 mt-4">
        <StrainCoach
          currentStrain={strain}
          targetLow={target.low}
          targetHigh={target.high}
          recoveryScore={recovery}
        />
      </div>

      {/* Stats - 2 col, no calories */}
      <div className="px-4 mt-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
            <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Workouts</div>
            <div className="text-lg font-semibold tabular-nums">{rows.length}</div>
          </div>
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
            <div className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Max HR</div>
            <div className="text-lg font-semibold tabular-nums">
              {rows.length > 0 ? Math.max(...rows.map(w => w.max_hr ?? 0)) || "--" : "--"}
            </div>
          </div>
        </div>
      </div>
      {/* 7-Day Strain Line Chart */}
      {last7.length > 1 && (
        <div className="px-4 mt-6">
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
            <div className="text-white/50 text-[10px] uppercase tracking-wider mb-3">Strain (7 Days)</div>
            <svg viewBox="0 0 200 80" className="w-full h-20" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1="20" x2="200" y2="20" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
              <line x1="0" y1="40" x2="200" y2="40" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
              <line x1="0" y1="60" x2="200" y2="60" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
              {/* Line path */}
              <polyline
                fill="none"
                stroke="url(#strainGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={last7.map((d: { date: string; strain_21: number | null }, i: number) => {
                  const x = last7.length === 1 ? 100 : (i / (last7.length - 1)) * 196 + 2;
                  const y = 76 - ((d.strain_21 ?? 0) / 21) * 72;
                  return `${x},${y}`;
                }).join(" ")}
              />
              {/* Gradient fill under line */}
              <polygon
                fill="url(#strainFill)"
                opacity="0.15"
                points={[
                  ...last7.map((d: { date: string; strain_21: number | null }, i: number) => {
                    const x = last7.length === 1 ? 100 : (i / (last7.length - 1)) * 196 + 2;
                    const y = 76 - ((d.strain_21 ?? 0) / 21) * 72;
                    return `${x},${y}`;
                  }),
                  `${last7.length === 1 ? 100 : 198},80`,
                  "2,80"
                ].join(" ")}
              />
              {/* Dots */}
              {last7.map((d: { date: string; strain_21: number | null }, i: number) => {
                const x = last7.length === 1 ? 100 : (i / (last7.length - 1)) * 196 + 2;
                const y = 76 - ((d.strain_21 ?? 0) / 21) * 72;
                return <circle key={i} cx={x} cy={y} r="3" fill={getStrainColor(d.strain_21 ?? 0)} />;
              })}
              <defs>
                <linearGradient id="strainGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="50%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
                <linearGradient id="strainFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
            </svg>
            <div className="flex justify-between mt-1">
              {last7.map((d: { date: string; strain_21: number | null }, i: number) => {
                const dt = new Date(d.date + "T00:00:00Z");
                const day = dt.toLocaleDateString("en-US", { weekday: "narrow" });
                return <div key={i} className="text-white/40 text-[9px] flex-1 text-center">{day}</div>;
              })}
            </div>
          </div>
        </div>
      )}
      {/* Recent Workouts */}
      <div className="px-4 mt-6 pb-28">
        <div className="text-white/50 text-[10px] uppercase tracking-wider mb-3">Recent Workouts</div>
        {dates.length === 0 ? (
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5 text-center text-white/40 text-sm">
            No workouts in the last 30 days
          </div>
        ) : (
          <div className="space-y-3">
            {dates.map((d) => {
              const dt = new Date(d + "T00:00:00Z");
              const label = dt.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "2-digit",
                month: "short",
              });
              return (
                <div key={d}>
                  <div className="text-white/40 text-xs font-medium mb-2">{label}</div>
                  <div className="space-y-2">
                    {byDate[d].map((w) => (
                      <Link
                        key={w.id}
                        href={`/app/activity/${w.id}`}
                        prefetch
                        className="block bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.06] active:scale-[0.98] transition"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold">{w.type ?? "Workout"}</div>
                            <div className="text-xs text-white/40 mt-1">
                              {mins(w.duration_min)} · {km(w.distance_m)} km · {w.calories ?? "–"} cal
                            </div>
                            {w.start_time && (
                              <div className="text-[10px] text-white/30 mt-1">{fmtTime(w.start_time)}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-white/40 uppercase">Avg HR</div>
                            <div className="text-lg font-semibold tabular-nums">{w.avg_hr ?? "–"}</div>
                            {w.max_hr && (
                              <div className="text-[10px] text-white/30">max {w.max_hr}</div>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
