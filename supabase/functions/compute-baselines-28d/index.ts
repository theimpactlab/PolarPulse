// Supabase Edge Function: compute-baselines-28d
// Deploy: supabase functions deploy compute-baselines-28d
//
// Purpose
// - Compute rolling 28-day baselines for key metrics per user
// - Writes into: baselines_28d (user_id, metric, computed_on, avg, stddev, n)
//
// Inputs
// - User mode: Authorization Bearer JWT (computes baselines for caller)
// - Service mode (cron/admin): x-sync-secret + body.userId
//
// Request body
//   {
//     "computedOn": "YYYY-MM-DD",          // optional; defaults to today (UTC)
//     "userId": "uuid (service mode only)", // required in service mode
//     "metrics": ["sleep_score", ...]       // optional; defaults to standard set
//   }
//
// Required env vars:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - SUPABASE_ANON_KEY
// - SYNC_SECRET
//
// Notes
// - Uses daily_metrics as the canonical source for day-level baselines.
// - Baseline window: [computedOn - 27 days, computedOn], inclusive (28 days).
// - Null values are ignored per metric.
// - Stddev uses sample stddev (n-1) when n >= 2; returns null when n < 2.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string, required = true): string {
  const v = Deno.env.get(name);
  if (!v && required) throw new Error(`Missing env var: ${name}`);
  return v ?? "";
}

function isIsoDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function toIsoDateUTC(dt: Date): string {
  // Ensure YYYY-MM-DD in UTC
  return dt.toISOString().slice(0, 10);
}

function addDays(dateIso: string, deltaDays: number): string {
  const dt = new Date(`${dateIso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return toIsoDateUTC(dt);
}

async function getUserIdFromJwt(opts: {
  supabaseUrl: string;
  anonKey: string;
  jwt: string;
}): Promise<string> {
  const supabaseUser = createClient(opts.supabaseUrl, opts.anonKey, {
    global: { headers: { Authorization: `Bearer ${opts.jwt}` } },
    auth: { persistSession: false },
  });

  const { data, error } = await supabaseUser.auth.getUser();
  if (error || !data?.user?.id) throw new Error("Invalid user token");
  return data.user.id;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sampleStddev(values: number[], m: number): number | null {
  const n = values.length;
  if (n < 2) return null;
  const varSum = values.reduce((acc, x) => acc + (x - m) * (x - m), 0);
  return Math.sqrt(varSum / (n - 1));
}

type MetricKey =
  | "sleep_score"
  | "recovery_score"
  | "strain_score"
  | "hrv_ms"
  | "resting_hr"
  | "respiratory_rate"
  | "spo2"
  | "steps"
  | "active_calories"
  | "distance_m"
  | "stress_avg";

const DEFAULT_METRICS: MetricKey[] = [
  "sleep_score",
  "recovery_score",
  "strain_score",
  "hrv_ms",
  "resting_hr",
  "respiratory_rate",
  "spo2",
  "steps",
  "active_calories",
  "distance_m",
  "stress_avg",
];

function sanitizeMetrics(arr: any): MetricKey[] {
  if (!Array.isArray(arr) || arr.length === 0) return DEFAULT_METRICS;
  const set = new Set(DEFAULT_METRICS);
  const out: MetricKey[] = [];
  for (const x of arr) {
    if (typeof x === "string" && set.has(x as MetricKey)) out.push(x as MetricKey);
  }
  return out.length ? out : DEFAULT_METRICS;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = getEnv("SUPABASE_URL");
    const SERVICE_ROLE = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY = getEnv("SUPABASE_ANON_KEY");
    const SYNC_SECRET = getEnv("SYNC_SECRET");

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));

    const syncSecretHeader = req.headers.get("x-sync-secret");
    const isServiceMode = syncSecretHeader && syncSecretHeader === SYNC_SECRET;

    let userId: string | null = null;

    if (isServiceMode) {
      userId = typeof body?.userId === "string" ? body.userId : null;
      if (!userId) return jsonResponse({ ok: false, error: "Missing userId (service mode)" }, 400);
    } else {
      const authHeader = req.headers.get("authorization") ?? "";
      const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!jwt) return jsonResponse({ ok: false, error: "Missing Authorization bearer token" }, 401);
      userId = await getUserIdFromJwt({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, jwt });
    }

    const computedOn =
      typeof body?.computedOn === "string" && isIsoDate(body.computedOn)
        ? body.computedOn
        : toIsoDateUTC(new Date());

    const metrics = sanitizeMetrics(body?.metrics);

    const startDate = addDays(computedOn, -27); // inclusive 28 days
    const endDate = computedOn; // inclusive

    // Pull daily_metrics window for all requested metric fields.
    // We keep it simple: select date + each metric column.
    const selectCols = ["date", ...metrics].join(",");
    const { data: rows, error: dmErr } = await supabaseAdmin
      .from("daily_metrics")
      .select(selectCols)
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (dmErr) throw dmErr;

    const results: Array<{
      metric: MetricKey;
      avg: number | null;
      stddev: number | null;
      n: number;
    }> = [];

    for (const metric of metrics) {
      const values: number[] = [];

      for (const r of rows ?? []) {
        const v = (r as any)[metric];
        if (typeof v === "number" && Number.isFinite(v)) values.push(v);
      }

      if (values.length === 0) {
        results.push({ metric, avg: null, stddev: null, n: 0 });
        continue;
      }

      const m = mean(values);
      const sd = sampleStddev(values, m);

      results.push({
        metric,
        avg: m,
        stddev: sd,
        n: values.length,
      });
    }

    // Upsert into baselines_28d
    // (one row per metric for computed_on)
    const upserts = results.map((r) => ({
      user_id: userId,
      metric: r.metric,
      computed_on: computedOn,
      avg: r.avg,
      stddev: r.stddev,
      n: r.n,
    }));

    const { error: upErr } = await supabaseAdmin
      .from("baselines_28d")
      .upsert(upserts, { onConflict: "user_id,metric,computed_on" });

    if (upErr) throw upErr;

    return jsonResponse({
      ok: true,
      userId,
      computedOn,
      window: { startDate, endDate },
      metricsComputed: results.length,
      results,
      note:
        "Baselines are computed from daily_metrics. Ensure compute-daily-metrics runs first for dates in the window, then run compute-recovery/strain/health-indicator to populate score columns.",
    });
  } catch (e) {
    return jsonResponse(
      { ok: false, error: (e as Error)?.message ?? String(e) },
      500,
    );
  }
});