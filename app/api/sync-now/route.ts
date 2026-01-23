// app/api/sync-now/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

function mustGetEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function callEdgeFn<T>(opts: {
  baseUrl: string;
  fnName: string;
  syncSecret: string;
  body: any;
}): Promise<T> {
  const url = `${opts.baseUrl.replace(/\/+$/, "")}/functions/v1/${opts.fnName}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-secret": opts.syncSecret,
    },
    body: JSON.stringify(opts.body ?? {}),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || `Edge function failed: ${opts.fnName} (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

export async function POST(req: Request) {
  try {
    const SUPABASE_URL = mustGetEnv("SUPABASE_URL");
    const SYNC_SECRET = mustGetEnv("SYNC_SECRET");

    const supabase = await createSupabaseServerClient();
    const { data: userRes, error: uErr } = await supabase.auth.getUser();
    if (uErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
    }

    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const recomputeLastDays =
      Number.isFinite(Number(body?.recomputeLastDays)) ? Number(body.recomputeLastDays) : null;

    // 1) sync-polar
    const sync = await callEdgeFn<{
      ok: boolean;
      userId: string;
      polarUserId?: string;
      datesTouched?: string[];
      workoutsUpserted?: number;
      sleepUpserted?: number;
    }>({
      baseUrl: SUPABASE_URL,
      fnName: "sync-polar",
      syncSecret: SYNC_SECRET,
      body: { userId },
    });

    const datesTouched = Array.isArray(sync?.datesTouched) ? sync.datesTouched : [];

    // 2) post-sync-orchestrator
    // If sync-polar touched dates, compute those. If not, optionally fall back to recomputeLastDays.
    const orchBody: any = {
      userId,
      computeBaselines: true,
    };

    if (datesTouched.length) orchBody.dates = datesTouched;
    if (!datesTouched.length && recomputeLastDays) orchBody.recomputeLastDays = recomputeLastDays;

    const orch = await callEdgeFn<any>({
      baseUrl: SUPABASE_URL,
      fnName: "post-sync-orchestrator",
      syncSecret: SYNC_SECRET,
      body: orchBody,
    });

    return NextResponse.json({
      ok: true,
      userId,
      sync: {
        datesTouched,
        workoutsUpserted: sync?.workoutsUpserted ?? null,
        sleepUpserted: sync?.sleepUpserted ?? null,
      },
      orchestrator: {
        ok: orch?.ok ?? true,
        dates: orch?.dates ?? [],
        failures: orch?.failures ?? [],
        baselineComputedOn: orch?.baselineResult?.computedOn ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}