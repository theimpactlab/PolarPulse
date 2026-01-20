// Supabase Edge Function: post-sync-orchestrator
// Deploy: supabase functions deploy post-sync-orchestrator
//
// Purpose
// - Orchestrate the full pipeline after Polar data arrives
// - Given a list of dates (usually from sync-polar.datesTouched), run:
//     1) compute-daily-metrics(date)
//     2) compute-recovery(date)
//     3) compute-strain(date)
//   Then once per run:
//     4) compute-baselines-28d(computedOn=today)
//
// Modes
// - Service mode (recommended): called from sync-polar using x-sync-secret
// - User mode: callable from the app with Authorization Bearer JWT (runs for caller)
//
// Request body
// {
//   "dates": ["YYYY-MM-DD", ...],        // optional; defaults to last N days
//   "userId": "uuid",                   // required in service mode, ignored in user mode
//   "recomputeLastDays": 5,             // optional, default 5 if dates not provided
//   "computeBaselines": true            // optional, default true
// }
//
// Required env vars:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - SUPABASE_ANON_KEY
// - SYNC_SECRET
//
// Function URLs (set these to your project endpoints or let it derive from SUPABASE_URL)
// - COMPUTE_DAILY_METRICS_URL   (optional)
// - COMPUTE_RECOVERY_URL        (optional)
// - COMPUTE_STRAIN_URL          (optional)
// - COMPUTE_BASELINES_URL       (optional)
//
// Notes
// - This function calls other functions via HTTP so it works even if you later move
//   compute logic to different functions.
// - In service mode, it calls downstream functions in service mode too (x-sync-secret).
// - In user mode, it calls downstream functions in user mode (Authorization bearer token).
//
// Tip
// - Call this at the end of sync-polar with { userId, dates: datesTouched }.

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

async function callFn(opts: {
  url: string;
  headers: Record<string, string>;
  body: any;
}): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch(opts.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...opts.headers },
    body: JSON.stringify(opts.body ?? {}),
  });

  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && (json?.ok ?? true), status: res.status, json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = getEnv("SUPABASE_URL");
    const SERVICE_ROLE = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY = getEnv("SUPABASE_ANON_KEY");
    const SYNC_SECRET = getEnv("SYNC_SECRET");

    const body = await req.json().catch(() => ({}));
    const syncSecretHeader = req.headers.get("x-sync-secret");
    const isServiceMode = syncSecretHeader && syncSecretHeader === SYNC_SECRET;

    // Determine user + auth headers for downstream calls
    let userId: string | null = null;
    let downstreamHeaders: Record<string, string> = {};

    if (isServiceMode) {
      userId = typeof body?.userId === "string" ? body.userId : null;
      if (!userId) return jsonResponse({ ok: false, error: "Missing userId (service mode)" }, 400);
      downstreamHeaders = { "x-sync-secret": SYNC_SECRET };
    } else {
      const authHeader = req.headers.get("authorization") ?? "";
      const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!jwt) return jsonResponse({ ok: false, error: "Missing Authorization bearer token" }, 401);

      userId = await getUserIdFromJwt({ supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, jwt });
      downstreamHeaders = { Authorization: `Bearer ${jwt}` };
    }

    // Resolve function URLs
    const base = SUPABASE_URL.replace(/\/+$/, "");
    const urlDaily = Deno.env.get("COMPUTE_DAILY_METRICS_URL") ?? `${base}/functions/v1/compute-daily-metrics`;
    const urlRecov = Deno.env.get("COMPUTE_RECOVERY_URL") ?? `${base}/functions/v1/compute-recovery`;
    const urlStrain = Deno.env.get("COMPUTE_STRAIN_URL") ?? `${base}/functions/v1/compute-strain`;
    const urlBase = Deno.env.get("COMPUTE_BASELINES_URL") ?? `${base}/functions/v1/compute-baselines-28d`;

    // Determine which dates to compute
    let dates: string[] = [];
    if (Array.isArray(body?.dates)) {
      dates = body.dates.filter((d: any) => typeof d === "string" && isIsoDate(d));
    }

    if (!dates.length) {
      const n = Number.isFinite(Number(body?.recomputeLastDays)) ? Math.max(1, Math.min(14, Number(body.recomputeLastDays))) : 5;
      const today = toIsoDateUTC(new Date());
      dates = [];
      for (let i = 0; i < n; i++) dates.push(addDays(today, -i));
    }

    // De-dupe and sort
    dates = Array.from(new Set(dates)).sort();

    const computeBaselines = body?.computeBaselines !== false;

    // In service mode, pass userId to downstream compute fns; in user mode, do not.
    const baseBody = isServiceMode ? { userId } : {};

    // Run per-date computations sequentially (safe + simple).
    // If you want faster, we can parallelize with a small concurrency cap.
    const perDateResults: any[] = [];
    for (const d of dates) {
      const r1 = await callFn({ url: urlDaily, headers: downstreamHeaders, body: { ...baseBody, date: d } });
      const r2 = await callFn({ url: urlRecov, headers: downstreamHeaders, body: { ...baseBody, date: d } });
      const r3 = await callFn({ url: urlStrain, headers: downstreamHeaders, body: { ...baseBody, date: d } });

      perDateResults.push({
        date: d,
        computeDaily: { ok: r1.ok, status: r1.status, error: r1.ok ? null : r1.json?.error ?? "failed" },
        computeRecovery: { ok: r2.ok, status: r2.status, error: r2.ok ? null : r2.json?.error ?? "failed" },
        computeStrain: { ok: r3.ok, status: r3.status, error: r3.ok ? null : r3.json?.error ?? "failed" },
      });
    }

    // Compute baselines once (computedOn=today UTC)
    let baselineResult: any = null;
    if (computeBaselines) {
      const computedOn = toIsoDateUTC(new Date());
      const r = await callFn({
        url: urlBase,
        headers: downstreamHeaders,
        body: { ...baseBody, computedOn },
      });
      baselineResult = { ok: r.ok, status: r.status, error: r.ok ? null : r.json?.error ?? "failed", computedOn };
    }

    // Optional: write a small audit log row (if you later add a sync_jobs table)
    // For now we just return the summary.

    // Summarize
    const failures = perDateResults.flatMap((x) => {
      const out: any[] = [];
      if (!x.computeDaily.ok) out.push({ date: x.date, step: "compute-daily-metrics", error: x.computeDaily.error });
      if (!x.computeRecovery.ok) out.push({ date: x.date, step: "compute-recovery", error: x.computeRecovery.error });
      if (!x.computeStrain.ok) out.push({ date: x.date, step: "compute-strain", error: x.computeStrain.error });
      return out;
    });

    return jsonResponse({
      ok: failures.length === 0,
      userId,
      dates,
      perDateResults,
      baselineResult,
      failures,
      note:
        "If failures are only due to missing baselines or missing HRV/RHR/resp, ingest those daily vitals into daily_metrics and rerun orchestrator.",
    });
  } catch (e) {
    return jsonResponse(
      { ok: false, error: (e as Error)?.message ?? String(e) },
      500,
    );
  }
});