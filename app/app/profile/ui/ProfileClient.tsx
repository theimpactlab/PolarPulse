"use client";

import React, { useState } from "react";

export default function ProfileClient() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  async function syncNow() {
    setBusy(true);
    setMsg(null);
    setDetail(null);

    try {
      const res = await fetch("/api/sync-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // optional fallback if no datesTouched returned
        body: JSON.stringify({ recomputeLastDays: 7 }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Sync failed");
      }

      setMsg("Sync complete.");
      setDetail(json);
    } catch (e: any) {
      setMsg(e?.message ?? "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white/80">Sync</div>
          <div className="mt-1 text-xs text-white/50">
            Pull latest Polar data, then recompute daily metrics, recovery, strain, and baselines.
          </div>
        </div>

        <button
          onClick={syncNow}
          disabled={busy}
          className="rounded-2xl border border-white/15 bg-black/30 px-4 py-2 text-sm text-white/90 hover:bg-black/40 disabled:opacity-60"
        >
          {busy ? "Syncing..." : "Sync now"}
        </button>
      </div>

      {msg ? <div className="mt-3 text-sm text-white/80">{msg}</div> : null}

      {detail ? (
        <pre className="mt-3 max-h-64 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
          {JSON.stringify(detail, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}