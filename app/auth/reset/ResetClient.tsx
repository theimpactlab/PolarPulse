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

  if (msg.includes("auth session missing")) {
    return "Your reset link is missing or expired. Request a new password reset email.";
  }
  if (msg.includes("same password")) {
    return "Please choose a different password.";
  }
  if (msg.includes("password")) {
    // keep raw error if it’s specifically about password rules
    return err?.message || "Password did not meet requirements.";
  }
  return err?.message || "Something went wrong. Please try again.";
}

function passwordStrengthHint(pw: string): string | null {
  if (!pw) return null;
  if (pw.length < 8) return "Use at least 8 characters.";
  return null;
}

export default function ResetClient({ initialEmail }: { initialEmail?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => sanitizeNext(searchParams.get("next")), [searchParams]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [status, setStatus] = useState<"idle" | "working" | "success" | "error">("idle");
  const [msg, setMsg] = useState<string>("");

  const hint = passwordStrengthHint(password);
  const disabled = status === "working";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (password.length < 8) {
      setStatus("error");
      setMsg("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setStatus("error");
      setMsg("Passwords do not match.");
      return;
    }

    setStatus("working");

    try {
      const supabase = createSupabaseBrowserClient();

      // This requires a valid session. With Supabase recovery links, the session is established
      // after the user lands on your site (cookies set by your callback / SSR plumbing).
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setStatus("success");
      setMsg("Password updated. Redirecting…");

      router.replace(nextPath);
      router.refresh();
    } catch (err: any) {
      setStatus("error");
      setMsg(prettyAuthError(err));
    }
  }

  return (
    <div>
      {initialEmail ? (
        <div className="mb-4 text-xs text-white/50">
          Signed in as <span className="text-white/70">{initialEmail}</span>
        </div>
      ) : (
        <div className="mb-4 text-xs text-white/50">
          If you arrived from a reset email, this page should authenticate you automatically. If it
          didn’t, request a new reset email.
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          autoComplete="new-password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={disabled}
          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/20"
        />

        <input
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          disabled={disabled}
          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/20"
        />

        {hint && <div className="text-xs text-white/45">{hint}</div>}

        <button
          type="submit"
          disabled={disabled}
          className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium hover:bg-white/15 disabled:opacity-60"
        >
          {status === "working" ? "Updating…" : "Update password"}
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
        After updating, you’ll be redirected to{" "}
        <span className="text-white/60">{nextPath}</span>
      </div>
    </div>
  );
}