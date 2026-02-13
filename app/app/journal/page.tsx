import JournalClient from "./ui/JournalClient";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;

  const supabase = await createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80">Not signed in.</div>;
  }

  const today = new Date();
  const selectedDate =
    typeof sp?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
      ? sp.date
      : iso(today);

  // Fetch today's journal behaviors
  const { data: journalData, error: jErr } = await supabase
    .from("journal_behaviors")
    .select("behavior,value")
    .eq("user_id", userRes.user.id)
    .eq("date", selectedDate)
    .returns<Array<{ behavior: string; value: boolean }>>();

  if (jErr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load journal</div>
        <div className="mt-2 text-sm text-white/50">{jErr.message}</div>
      </div>
    );
  }

  // Fetch behavior_recovery_impact data (last 90 days analysis)
  const { data: impactData, error: iErr } = await supabase
    .from("behavior_recovery_impact")
    .select("behavior,avg_recovery_with,avg_recovery_without,days_with,days_without")
    .eq("user_id", userRes.user.id)
    .returns<
      Array<{
        behavior: string;
        avg_recovery_with: number | null;
        avg_recovery_without: number | null;
        days_with: number | null;
        days_without: number | null;
      }>
    >();

  if (iErr) {
    console.error("Impact data error:", iErr);
  }

  return (
    <JournalClient
      date={selectedDate}
      journalBehaviors={journalData ?? []}
      recoveryImpact={impactData ?? []}
    />
  );
}
