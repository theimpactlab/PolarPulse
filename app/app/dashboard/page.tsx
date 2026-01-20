import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import DashboardClient from "./ui/DashboardClient";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();

  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userRes.user) {
    return <div className="text-white/80">Not signed in.</div>;
  }

  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 13);

  const { data, error } = await supabase
    .from("daily_metrics")
    .select("date,sleep_score,recovery_score,strain_score,health_indicator,steps,active_calories")
    .gte("date", iso(from))
    .lte("date", iso(today))
    .order("date", { ascending: true });

  if (error) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-white/80">Failed to load metrics</div>
        <div className="mt-2 text-sm text-white/50">{error.message}</div>
      </div>
    );
  }

  return (
    <DashboardClient rows={data ?? []} />
  );
}