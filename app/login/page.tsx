"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/browser";

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string>("");

  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") || "/app/dashboard";

  async function sendMagicLink() {
    setErr("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}${next}`,
      },
    });
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 px-5 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-white/60">Use a magic link to access your dashboard.</p>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <label className="text-sm text-white/70">Email</label>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            type="email"
          />

          <button
            className="mt-4 w-full rounded-2xl bg-white px-4 py-3 font-medium text-black hover:bg-white/90"
            onClick={sendMagicLink}
          >
            Send magic link
          </button>

          {sent && (
            <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              Check your inbox for the sign-in link.
            </div>
          )}

          {err && (
            <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
              {err}
            </div>
          )}

          <button
            className="mt-4 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 font-medium text-white hover:bg-white/10"
            onClick={() => router.push("/")}
          >
            Back
          </button>
        </div>
      </div>
    </main>
  );
}