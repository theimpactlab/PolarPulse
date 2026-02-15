"use client";

import { useRef, useState, useCallback, ReactNode } from "react";
import { createBrowserClient } from "@supabase/ssr";

const THRESHOLD = 80;
const MAX_PULL = 130;

export function PullToRefresh({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const doSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setToast({ msg: "Not logged in", type: "err" }); return; }
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-polar`,
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        setToast({ msg: "Synced!", type: "ok" });
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setToast({ msg: "Sync failed", type: "err" });
      }
    } catch {
      setToast({ msg: "Network error", type: "err" });
    } finally {
      setSyncing(false);
      setTimeout(() => setToast(null), 3000);
    }
  }, [supabase]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current;
    if (!el || el.scrollTop > 5 || syncing) return;
    startY.current = e.touches[0].clientY;
  }, [syncing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startY.current || syncing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 5) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setPullDistance(Math.min(dy * 0.5, MAX_PULL));
    }
  }, [syncing]);

  const onTouchEnd = useCallback(() => {
    if (pullDistance >= THRESHOLD && !syncing) {
      doSync();
    }
    setPullDistance(0);
    startY.current = 0;
  }, [pullDistance, syncing, doSync]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const ready = pullDistance >= THRESHOLD;

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-y-auto overscroll-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center transition-all duration-200 overflow-hidden"
        style={{ height: syncing ? 56 : pullDistance > 10 ? pullDistance : 0 }}
      >
        <div className="flex flex-col items-center gap-1">
          <svg
            className="transition-transform duration-200"
            style={{
              transform: `rotate(${syncing ? 0 : progress * 360}deg)`,
              animation: syncing ? "spin 1s linear infinite" : "none",
            }}
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke={ready || syncing ? "#22c55e" : "rgba(255,255,255,0.3)"}
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
            <path d="M21 3v5h-5" />
          </svg>
          <span className="text-[10px] text-white/40">
            {syncing ? "Syncing\u2026" : ready ? "Release to sync" : "Pull to sync"}
          </span>
        </div>
      </div>

      {children}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className={`px-4 py-2 rounded-full text-sm font-medium shadow-lg ${
            toast.type === "ok" ? "bg-emerald-500/90 text-white" : "bg-red-500/90 text-white"
          }`}>
            {toast.msg}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fade-in { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}
