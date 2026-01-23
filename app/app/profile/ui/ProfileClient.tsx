"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/browser";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "–";
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return "–";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function ProfileClient({
  email,
  connection,
}: {
  email: string;
  connection: null | {
    connected_at: string | null;
    last_synced_at: string | null;
    expires_at: string | null;
    scope: string | null;
  };
}) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const isConnected = !!connection?.connected_at;

  const status = useMemo(() => {
    if (!isConnected) return { label: "Not connected", ok: false };
    return { label: "Connected", ok: true };
  }, [isConnected]);

  async function syncNow() {
    setBusy(true);
    setMsg("");
    setErr("");

    try {
      const { data: sessionData, error: sErr } = await supabase.auth.getSession();
      if (sErr) throw sErr;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("You’re not logged in.");

      const url = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/sync-polar`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `Sync failed (${res.status})`);

      setMsg(`Sync complete. Workouts: ${json.workoutsUpserted ?? 0}, Sleep: ${json.sleepUpserted ?? 0}`);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteMyData() {
    const confirmed = window.confirm(
      "This will permanently delete your sleep, workouts, scores, and Polar connection. Continue?",
    );
    if (!confirmed) return;

    setBusy(true);
    setMsg("");
    setErr("");

    try {
      const { data: sessionData, error: sErr } = await supabase.auth.getSession();
      if (sErr) throw sErr;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("You’re not logged in.");

      const url = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/delete-user-data`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAuthUser: false }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `Delete failed (${res.status})`);

      setMsg("Your data has been deleted.");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push("/login");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-white/60">Profile</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-2 text-white/60">{email}</p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white/80">Polar</div>
            <div className="mt-1 text-xs text-white/50">Connection status</div>
          </div>

          <div
            className={cx(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm",
              status.ok
                ? "bg-emerald-400/10 text-emerald-200 border border-emerald-300/20"
                : "bg-rose-400/10 text-rose-200 border border-rose-300/20",
            )}
          >
            <span className={cx("h-2 w-2 rounded-full", status.ok ? "bg-emerald-300" : "bg-rose-300")} />
            {status.label}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Connected at</div>
            <div className="mt-1 text-sm text-white/80">{fmtDateTime(connection?.connected_at ?? null)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/50">Last synced</div>
            <div className="mt-1 text-sm text-white/80">{fmtDateTime(connection?.last_synced_at ?? null)}</div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/50">Token expiry</div>
          <div className="mt-1 text-sm text-white/80">{fmtDateTime(connection?.expires_at ?? null)}</div>
          <div className="mt-2 text-xs text-white/45 break-words">
            Scope: {connection?.scope ?? "–"}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <a
            href="/api/polar/connect?next=/app/dashboard"
            className={cx(
              "w-full rounded-2xl px-4 py-3 text-base font-medium text-center",
              "bg-white text-black hover:bg-white/90",
            )}
          >
            {isConnected ? "Reconnect Polar" : "Connect Polar"}
          </a>

          <button
            onClick={syncNow}
            disabled={busy || !isConnected}
            className={cx(
              "w-full rounded-2xl px-4 py-3 text-base font-medium",
              "border border-white/15 bg-white/5 text-white hover:bg-white/10",
              (busy || !isConnected) && "opacity-60 cursor-not-allowed",
            )}
          >
            {busy ? "Working..." : "Sync now"}
          </button>

          <button
            onClick={deleteMyData}
            disabled={busy}
            className={cx(
              "w-full rounded-2xl px-4 py-3 text-base font-medium",
              "border border-rose-300/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15",
              busy && "opacity-60 cursor-not-allowed",
            )}
          >
            Delete my data
          </button>

          <button
            onClick={signOut}
            disabled={busy}
            className={cx(
              "w-full rounded-2xl px-4 py-3 text-base font-medium",
              "border border-white/15 bg-white/5 text-white hover:bg-white/10",
              busy && "opacity-60 cursor-not-allowed",
            )}
          >
            Sign out
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            {msg}
          </div>
        )}
        {err && (
          <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            {err}
          </div>
        )}
      </div>
    </div>
  );
}