"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function sanitizeNext(nextRaw: string | null): string {
  const fallback = "/app/dashboard";
  if (!nextRaw) return fallback;

  const n = nextRaw.trim();
  if (!n.startsWith("/")) return fallback;
  if (!n.startsWith("/app")) return fallback;

  return n;
}

export default function PolarCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();

  const polar = params.get("polar"); // "connected" or "error"
  const connected = params.get("connected");
  const reason = params.get("reason");
  const message = params.get("message");
  const next = params.get("next");

  const nextPath = useMemo(() => sanitizeNext(next), [next]);

  const isOk = polar === "connected" || connected === "true";
  const title = isOk ? "Connected" : "Connection failed";
  const subtitle = isOk
    ? "Polar is linked. Loading your dashboard…"
    : "We couldn’t complete the connection. Redirecting you back…";

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(nextPath);
      router.refresh();
    }, 900);

    return () => clearTimeout(t);
  }, [router, nextPath]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 px-5 py-10">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
          <div className="flex items-start gap-4">
            <div
              className={
                "mt-1 h-10 w-10 rounded-2xl border " +
                (isOk
                  ? "border-emerald-300/20 bg-emerald-400/10"
                  : "border-rose-300/20 bg-rose-400/10")
              }
            />
            <div className="flex-1">
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {title}
              </h1>
              <p className="mt-2 text-white/60">{subtitle}</p>

              {!isOk && (reason || message) && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  {reason && (
                    <div className="text-xs text-white/50">
                      Reason: <span className="text-white/70">{reason}</span>
                    </div>
                  )}
                  {message && (
                    <div className="mt-2 text-xs text-white/50">
                      Message: <span className="text-white/70">{message}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 bg-white/50" />
              </div>

              <div className="mt-3 text-xs text-white/45">
                Taking you to: <span className="text-white/70">{nextPath}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-white/40">
          If you get stuck here, go to{" "}
          <span className="text-white/60">Profile</span> and tap{" "}
          <span className="text-white/60">Sync now</span>.
        </div>
      </div>
    </main>
  );
}