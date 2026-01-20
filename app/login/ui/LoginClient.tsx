"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/client";

function sanitizeNext(nextRaw: string | null): string {
  const fallback = "/app/dashboard";
  if (!nextRaw) return fallback;
  const n = nextRaw.trim();
  if (!n.startsWith("/")) return fallback;
  if (!n.startsWith("/app")) return fallback;
  return n;
}

export default function LoginClient() {
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => sanitizeNext(searchParams.get("next")), [searchParams]);

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState<string>("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMsg("");

    try {
      const supabase = createSupabaseBrowserClient();

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");

      const redirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;

      setStatus("sent");
      setMsg("Magic link sent. Check your email.");
    } catch (err: any) {
      setStatus("error");
      setMsg(err?.message || "Could not send magic link.");
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 px-5 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-white/60">Enter your email and we’ll send you a sign-in link.</p>

          <form onSubmit={sendLink} className="mt-6 space-y-3">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/20"
              required
            />

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium hover:bg-white/15 disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
          </form>

          {msg && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">
              {msg}
            </div>
          )}

          <div className="mt-6 text-xs text-white/40">
            After signing in you will be redirected to{" "}
            <span className="text-white/60">{nextPath}</span>
          </div>
        </div>
      </div>
    </main>
  );
}