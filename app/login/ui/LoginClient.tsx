"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/client";

function sanitizeNext(nextRaw: string | null): string {
  const fallback = "/app/dashboard";
  if (!nextRaw) return fallback;
  const n = nextRaw.trim();
  if (!n.startsWith("/")) return fallback;
  if (!n.startsWith("/app")) return fallback;
  return n;
}

function prettyAuthError(err: any): string {
  const msg = (err?.message || "").toString().toLowerCase();

  if (!msg) return "Something went wrong. Please try again.";

  // Common Supabase Auth messages
  if (msg.includes("invalid login credentials")) {
    return "That email/password combination didn’t work.";
  }
  if (msg.includes("email not confirmed")) {
    return "Your email isn’t confirmed yet. Check your inbox (or spam) for the confirmation email.";
  }
  if (msg.includes("user not found")) {
    return "No account found for that email address.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (msg.includes("otp") && msg.includes("expired")) {
    return "That sign-in link has expired. Please request a new one.";
  }

  // Default fallback
  return err?.message || "Something went wrong. Please try again.";
}

export default function LoginClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const nextPath = useMemo(() => sanitizeNext(searchParams.get("next")), [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [mode, setMode] = useState<"password" | "magic">("password");
  const [status, setStatus] = useState<"idle" | "working" | "success" | "error">("idle");
  const [msg, setMsg] = useState<string>("");

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setMsg("");

    try {
      const supabase = createSupabaseBrowserClient();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setStatus("success");
      setMsg("Signed in. Redirecting…");
      router.push(nextPath);
      router.refresh();
    } catch (err: any) {
      setStatus("error");
      setMsg(prettyAuthError(err));
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
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

      setStatus("success");
      setMsg("Magic link sent. Check your email.");
    } catch (err: any) {
      setStatus("error");
      setMsg(prettyAuthError(err));
    }
  }

  const disabled = status === "working";

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 px-5 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
              <p className="mt-2 text-white/60">
                Use your password, or request a magic link.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode("password");
                  setStatus("idle");
                  setMsg("");
                }}
                className={`rounded-xl px-3 py-2 ${
                  mode === "password" ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("magic");
                  setStatus("idle");
                  setMsg("");
                }}
                className={`rounded-xl px-3 py-2 ${
                  mode === "magic" ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                }`}
              >
                Magic link
              </button>
            </div>
          </div>

          <form
            onSubmit={mode === "password" ? signInWithPassword : sendMagicLink}
            className="mt-6 space-y-3"
          >
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/20"
              required
              disabled={disabled}
            />

            {mode === "password" && (
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/20"
                required
                disabled={disabled}
              />
            )}

            <button
              type="submit"
              disabled={disabled || (mode === "password" && password.length < 1)}
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium hover:bg-white/15 disabled:opacity-60"
            >
              {status === "working"
                ? "Working…"
                : mode === "password"
                  ? "Sign in"
                  : "Send magic link"}
            </button>
          </form>

          {msg && (
            <div
              className={`mt-4 rounded-2xl border p-3 text-sm ${
                status === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-100/90"
                  : "border-white/10 bg-black/20 text-white/70"
              }`}
            >
              {msg}
            </div>
          )}

          <div className="mt-6 text-xs text-white/40">
            After signing in you will be redirected to{" "}
            <span className="text-white/60">{nextPath}</span>
          </div>

          <div className="mt-4 text-xs text-white/40">
            Tip: If you use password sign-in on Apple devices, Safari/iCloud Keychain can unlock
            saved passwords with Face ID/Touch ID.
          </div>
        </div>
      </div>
    </main>
  );
}