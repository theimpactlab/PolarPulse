"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { RingProgress } from "@/components/ui/ring-progress";
import Link from "next/link";
import { useMemo } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";

type DailyMetricsRow = {
  date: string;
  sleep_score: number | null;
  recovery_score: number | null;
  strain_score: number | null;
  health_indicator: number | null;
  steps: number | null;
  active_calories: number | null;
};

const chartConfig: ChartConfig = {
  sleep: { label: "Sleep" },
  recovery: { label: "Recovery" },
  strain: { label: "Strain" },
} satisfies ChartConfig;

function formatDateGB(isoDate: string) {
  // isoDate expected YYYY-MM-DD
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
}

function fmtNum(v: number | null | undefined) {
  if (v === null || v === undefined) return "–";
  return String(v);
}

export default function DashboardClient({
  rows,
  rangeDays,
}: {
  rows: DailyMetricsRow[];
  rangeDays: number;
}) {
  const latest = rows.length ? rows[rows.length - 1] : null;

  const chartData = useMemo(() => {
    return rows.map((r) => ({
      date: formatDateGB(r.date),
      sleep: r.sleep_score ?? undefined,
      recovery: r.recovery_score ?? undefined,
      strain: r.strain_score ?? undefined,
    }));
  }, [rows]);

  const sleep = latest?.sleep_score ?? null;
  const recovery = latest?.recovery_score ?? null;
  const strain = latest?.strain_score ?? null;
  const health = latest?.health_indicator ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <div className="mt-1 text-sm text-white/60">
            {latest ? (
              <>
                Latest: <span className="text-white/80">{formatDateGB(latest.date)}</span>
              </>
            ) : (
              "No daily metrics yet."
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`?range=7`}
            className={`rounded-full border px-3 py-1 text-sm ${
              rangeDays === 7 ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-white/70 hover:bg-white/5"
            }`}
          >
            7d
          </Link>
          <Link
            href={`?range=14`}
            className={`rounded-full border px-3 py-1 text-sm ${
              rangeDays === 14 ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-white/70 hover:bg-white/5"
            }`}
          >
            14d
          </Link>
          <Link
            href={`?range=28`}
            className={`rounded-full border px-3 py-1 text-sm ${
              rangeDays === 28 ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-white/70 hover:bg-white/5"
            }`}
          >
            28d
          </Link>
        </div>
      </div>

      {latest && (
        <Card className="rounded-3xl border-white/10 bg-white/5">
          <CardContent className="p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm text-white/60">Steps</div>
                <div className="mt-1 text-2xl font-semibold text-white">{fmtNum(latest.steps)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm text-white/60">Active calories</div>
                <div className="mt-1 text-2xl font-semibold text-white">{fmtNum(latest.active_calories)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm text-white/60">Health indicator</div>
                <div className="mt-1 text-2xl font-semibold text-white">{fmtNum(health)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-3xl border-white/10 bg-white/5">
          <CardContent className="p-5">
            <div className="text-sm text-white/60">Sleep</div>
            <div className="mt-3 flex items-center gap-4">
              <RingProgress value={sleep ?? 0} max={100} />
              <div>
                <div className="text-2xl font-semibold text-white">{fmtNum(sleep)}</div>
                <div className="text-xs text-white/50">out of 100</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/10 bg-white/5">
          <CardContent className="p-5">
            <div className="text-sm text-white/60">Recovery</div>
            <div className="mt-3 flex items-center gap-4">
              <RingProgress value={recovery ?? 0} max={100} />
              <div>
                <div className="text-2xl font-semibold text-white">{fmtNum(recovery)}</div>
                <div className="text-xs text-white/50">out of 100</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/10 bg-white/5">
          <CardContent className="p-5">
            <div className="text-sm text-white/60">Strain</div>
            <div className="mt-3 flex items-center gap-4">
              {/* IMPORTANT: strain is 0..200 */}
              <RingProgress value={strain ?? 0} max={200} />
              <div>
                <div className="text-2xl font-semibold text-white">{fmtNum(strain)}</div>
                <div className="text-xs text-white/50">out of 200</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/10 bg-white/5">
          <CardContent className="p-5">
            <div className="text-sm text-white/60">Health</div>
            <div className="mt-3 flex items-center gap-4">
              <RingProgress value={health ?? 0} max={100} />
              <div>
                <div className="text-2xl font-semibold text-white">{fmtNum(health)}</div>
                <div className="text-xs text-white/50">out of 100</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-white/10 bg-white/5">
        <CardContent className="p-5">
          <div className="mb-3">
            <div className="text-white/80">Last {rangeDays} days</div>
            <div className="text-sm text-white/50">Sleep, recovery, strain</div>
          </div>

          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <LineChart data={chartData} margin={{ left: 8, right: 8, top: 12, bottom: 0 }}>
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="sleep" dot={false} />
              <Line type="monotone" dataKey="recovery" dot={false} />
              <Line type="monotone" dataKey="strain" dot={false} />
            </LineChart>
          </ChartContainer>

          <div className="mt-4 text-xs text-white/50">
            Gaps mean the metric is missing for that day (stored as null).
          </div>
        </CardContent>
      </Card>
    </div>
  );
}