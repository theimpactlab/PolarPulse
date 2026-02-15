"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { computeHealthspan, DailyMetricRow } from "@/src/lib/healthspan";

interface Connection {
  connected_at: string | null;
  last_synced_at: string | null;
  expires_at: string | null;
  scope: string | null;
}

export default function ProfileClient({
  email,
  connection,
  dailyMetrics = [],
}: {
  email: string;
  connection: Connection | null;
  dailyMetrics?: DailyMetricRow[];
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [deleting, setDeleting] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Compute healthspan
  const healthspan = computeHealthspan(dailyMetrics, 30);

  // Initials from email
  const initials = email
    ? email.split("@")[0].slice(0, 2).toUpperCase()
    : "??";

  // Name from email (capitalize first part)
  const displayName = email
    ? email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "User";

  async function syncNow() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSyncMsg("Not logged in"); return; }
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-polar`,
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        setSyncMsg("Synced successfully!");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const body = await res.text();
        setSyncMsg("Sync failed: " + body.slice(0, 80));
      }
    } catch (e: any) {
      setSyncMsg("Error: " + e.message);
    } finally {
      setSyncing(false);
    }
  }

  async function deleteMyData() {
    if (!confirm("Delete ALL your data? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const tables = ["workout_hr_zones","workout_hr_series","workouts","sleep_stages","sleep_hr_series","sleep_sessions","nightly_recharge","activity_summary","continuous_hr","daily_metrics"];
      for (const t of tables) {
        await supabase.from(t).delete().eq("user_id", session.user.id);
      }
      alert("Data deleted.");
      window.location.reload();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setDeleting(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const lastSynced = connection?.last_synced_at
    ? timeAgo(new Date(connection.last_synced_at))
    : null;

  return (
    <div className="min-h-screen bg-black px-4 pt-10 pb-32">
      {/* ── Profile Header ── */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-2xl font-bold text-black mb-3">
          {initials}
        </div>
        <h1 className="text-xl font-semibold text-white">{displayName}</h1>
        <p className="text-sm text-white/40 mt-0.5">{email}</p>
      </div>

      {/* ── Healthspan Section ── */}
      {healthspan.biologicalAge !== null && (
        <div className="mb-6">
          <h2 className="text-[11px] uppercase tracking-widest font-medium text-white/40 mb-3 px-1">Healthspan</h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Biological Age */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4 text-center">
              <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1">Biological Age</div>
              <div className="text-4xl font-bold text-white">{healthspan.biologicalAge}</div>
              <div className="text-xs text-white/30 mt-1">years</div>
            </div>
            {/* Pace of Aging */}
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4 text-center">
              <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1">Pace of Aging</div>
              <div className="text-4xl font-bold" style={{ color: healthspan.paceColor }}>
                {healthspan.paceOfAging !== null ? healthspan.paceOfAging.toFixed(1) + "x" : "–"}
              </div>
              <div className="text-xs mt-1" style={{ color: healthspan.paceColor + "99" }}>{healthspan.paceLabel}</div>
            </div>
          </div>

          {/* Metric Breakdown */}
          {healthspan.metricBreakdown.length > 0 && (
            <div className="mt-3 bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-wider text-white/40 mb-3">Health Score: {healthspan.healthScore}/100</div>
              <div className="space-y-2.5">
                {healthspan.metricBreakdown.map((m) => (
                  <div key={m.label} className="flex items-center justify-between">
                    <span className="text-xs text-white/50 w-20">{m.label}</span>
                    <div className="flex-1 mx-3 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: m.score + "%", backgroundColor: m.color }}
                      />
                    </div>
                    <span className="text-xs text-white/60 w-20 text-right">{m.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-white/25 mt-3">Estimate based on HRV, heart rate, sleep, activity & respiratory data from Polar</p>
            </div>
          )}
        </div>
      )}

      {/* ── Polar Connection ── */}
      <div className="mb-6">
        <h2 className="text-[11px] uppercase tracking-widest font-medium text-white/40 mb-3 px-1">Polar Connection</h2>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/70">Status</span>
            {connection ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-medium text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                Disconnected
              </span>
            )}
          </div>

          {connection && (
            <>
              {lastSynced && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-white/40">Last synced</span>
                  <span className="text-xs text-white/60">{lastSynced}</span>
                </div>
              )}
              {connection.connected_at && (
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-white/40">Connected since</span>
                  <span className="text-xs text-white/60">
                    {new Date(connection.connected_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              )}
            </>
          )}

          <div className="flex gap-2">
            <a
              href="/api/polar/connect"
              className="flex-1 text-center py-2.5 rounded-xl bg-white/[0.06] text-sm font-medium text-white/70 hover:bg-white/[0.1] transition"
            >
              {connection ? "Reconnect" : "Connect Polar"}
            </a>
            {connection && (
              <button
                onClick={syncNow}
                disabled={syncing}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30 transition disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Sync Now"}
              </button>
            )}
          </div>
          {syncMsg && <p className="text-xs text-center mt-2 text-white/50">{syncMsg}</p>}
        </div>
      </div>

      {/* ── Account ── */}
      <div className="mb-6">
        <h2 className="text-[11px] uppercase tracking-widest font-medium text-white/40 mb-3 px-1">Account</h2>
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl overflow-hidden">
          <button
            onClick={deleteMyData}
            disabled={deleting}
            className="w-full text-left px-4 py-3.5 text-sm text-red-400 hover:bg-white/[0.04] transition border-b border-white/[0.06] disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete My Data"}
          </button>
          <button
            onClick={signOut}
            className="w-full text-left px-4 py-3.5 text-sm text-white/60 hover:bg-white/[0.04] transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  return days + "d ago";
}
