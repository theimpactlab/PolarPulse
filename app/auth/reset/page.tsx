import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import ResetClient from "./ResetClient";

export default async function ResetPage() {
  const supabase = await createSupabaseServerClient();

  // If the user already has a valid session, they can reset immediately.
  // If they arrived via a recovery link, Supabase will also set the session cookies.
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 px-5 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
          <p className="mt-2 text-white/60">
            Choose a new password for your account.
          </p>

          <div className="mt-4">
            <ResetClient initialEmail={user?.email ?? ""} />
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
              {error.message}
            </div>
          )}

          <div className="mt-6 text-xs text-white/40">
            Tip: you can get here from a Supabase “password recovery” email, or while already signed
            in.
          </div>
        </div>
      </div>
    </main>
  );
}