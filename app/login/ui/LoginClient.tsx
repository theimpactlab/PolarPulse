"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const next = searchParams.get("next") || "/app/dashboard";

  useEffect(() => {
    // If you later add magic links / OAuth login, this is where it will land
    // For now we just forward after login completes elsewhere
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 px-5 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>

          <p className="mt-2 text-white/60">
            Please sign in to continue.
          </p>

          {/* Placeholder for auth UI */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
            Authentication UI goes here.
          </div>

          <div className="mt-6 text-xs text-white/40">
            After signing in you will be redirected to{" "}
            <span className="text-white/60">{next}</span>
          </div>
        </div>
      </div>
    </main>
  );
}