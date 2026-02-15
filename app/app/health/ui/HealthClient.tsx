'use client';
import { computeHealthspan, DailyMetricRow } from '@/src/lib/healthspan';

import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';

interface DailyMetric {
  date: string;
  hrv_ms?: number;
  resting_hr?: number;
  respiratory_rate?: number;
}

interface NightlyRecharge {
  date: string;
  recovery_index?: number;
  hrv_balance?: number;
  breathing_rate?: number;
}

interface Baseline {
  hrv_baseline: number;
  resting_hr_baseline: number;
  respiratory_rate_baseline: number;
}

interface HealthClientProps {
  dailyMetrics: DailyMetric[];
  nightlyRecharge: NightlyRecharge[];
  baselines: Baseline;
  healthspanMetrics?: DailyMetricRow[];
  userAge?: number;
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getTrend(data: number[]): 'up' | 'down' | 'flat' {
  if (data.length < 2) return 'flat';
  const recent = data.slice(-3);
  const earlier = data.slice(-7, -3);
  if (recent.length === 0 || earlier.length === 0) return 'flat';
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
  const diff = ((recentAvg - earlierAvg) / earlierAvg) * 100;
  if (Math.abs(diff) < 2) return 'flat';
  return diff > 0 ? 'up' : 'down';
}

function TrendArrow({ direction, good }: { direction: 'up' | 'down' | 'flat'; good?: boolean }) {
  if (direction === 'flat') return <span className="text-white/40 text-xs">\u2192</span>;
  const color = good ? 'text-green-400' : 'text-red-400';
  return (
    <span className={color + ' text-xs'}>
      {direction === 'up' ? '\u2191' : '\u2193'}
    </span>
  );
}

function MetricSection({
  title,
  value,
  unit,
  baseline,
  data,
  dataKey,
  color,
  higherIsBetter,
  range,
}: {
  title: string;
  value: number | null;
  unit: string;
  baseline: number;
  data: any[];
  dataKey: string;
  color: string;
  higherIsBetter: boolean;
  range: string;
}) {
  const values = data.map((d) => d[dataKey]).filter((v: any) => v != null) as number[];
  const trend = getTrend(values);
  const trendGood = higherIsBetter ? trend === 'up' : trend === 'down';
  const diff = value !== null ? value - baseline : null;
  const diffStr = diff !== null ? (diff >= 0 ? '+' : '') + diff.toFixed(1) : null;

  return (
    <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-white/50 text-xs font-medium uppercase tracking-wider">{title}</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold tabular-nums" style={{ color: value !== null ? color : 'rgba(255,255,255,0.3)' }}>
              {value !== null ? Math.round(value * 10) / 10 : '\u2013'}
            </span>
            <span className="text-white/40 text-sm">{unit}</span>
            {value !== null && <TrendArrow direction={trend} good={trendGood} />}
          </div>
        </div>
        <div className="text-right">
          <div className="text-white/30 text-[10px] uppercase">vs baseline</div>
          <div className={'text-sm font-semibold ' + (diff !== null && diff !== 0 ? (trendGood ? 'text-green-400' : 'text-red-400') : 'text-white/40')}>
            {diffStr ?? '\u2013'} {unit}
          </div>
          <div className="text-white/30 text-[10px]">baseline: {Math.round(baseline * 10) / 10}</div>
        </div>
      </div>

      {/* Sparkline Chart */}
      <div className="h-32 w-full -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={'grad-' + dataKey} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
            <Tooltip
              contentStyle={{
                background: 'rgba(0,0,0,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
            />
            <ReferenceLine
              y={baseline}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="4 4"
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={'url(#grad-' + dataKey + ')'}
              dot={false}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function HealthClient({
  dailyMetrics,
  nightlyRecharge,
  baselines,
  healthspanMetrics = [],
  userAge = 30,
}: HealthClientProps) {
  const [range, setRange] = useState<'7d' | '30d'>('30d');

  const chartData = useMemo(() => {
    const filtered = range === '7d' ? dailyMetrics.slice(-7) : dailyMetrics;
    return filtered.map((item) => ({
      ...item,
      date: formatDate(item.date),
    }));
  }, [dailyMetrics, range]);

  const latest = dailyMetrics.length > 0 ? dailyMetrics[dailyMetrics.length - 1] : null;

  // Find the most recent non-null values for display
  const latestHrv = [...dailyMetrics].reverse().find((d) => d.hrv_ms != null)?.hrv_ms ?? null;
  const latestRhr = [...dailyMetrics].reverse().find((d) => d.resting_hr != null)?.resting_hr ?? null;
  const latestRr = [...dailyMetrics].reverse().find((d) => d.respiratory_rate != null)?.respiratory_rate ?? null;

  // Compute healthspan
  const healthspan = computeHealthspan(healthspanMetrics, userAge);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Health Monitor</h1>
        <div className="flex gap-1 bg-white/5 rounded-full p-1">
          <button
            onClick={() => setRange('7d')}
            className={'px-3 py-1 rounded-full text-xs font-medium transition ' +
              (range === '7d' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60')}
          >
            7D
          </button>
          <button
            onClick={() => setRange('30d')}
            className={'px-3 py-1 rounded-full text-xs font-medium transition ' +
              (range === '30d' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60')}
          >
            30D
          </button>
        </div>
      </div>



      {/* ── Healthspan Section ── */}
      {healthspan.biologicalAge !== null && (
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 text-center">
              <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1">Biological Age</div>
              <div className="text-4xl font-bold text-white">{healthspan.biologicalAge}</div>
              <div className="text-xs text-white/30 mt-1">years</div>
            </div>
            <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 text-center">
              <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1">Pace of Aging</div>
              <div className="text-4xl font-bold" style={{ color: healthspan.paceColor }}>
                {healthspan.paceOfAging !== null ? healthspan.paceOfAging.toFixed(1) + "x" : "\u2013"}
              </div>
              <div className="text-xs mt-1" style={{ color: healthspan.paceColor + "99" }}>{healthspan.paceLabel}</div>
            </div>
          </div>
          {healthspan.metricBreakdown.length > 0 && (
            <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-wider text-white/40 mb-3">Health Score: {healthspan.healthScore}/100</div>
              <div className="space-y-2.5">
                {healthspan.metricBreakdown.map((m) => (
                  <div key={m.label} className="flex items-center justify-between">
                    <span className="text-xs text-white/50 w-20">{m.label}</span>
                    <div className="flex-1 mx-3 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: m.score + "%", backgroundColor: m.color }} />
                    </div>
                    <span className="text-xs text-white/60 w-20 text-right">{m.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-white/25 mt-3">Estimate based on HRV, heart rate, sleep, activity & respiratory data from Polar</p>
            </div>
          )}
        </div>
      )}
      {/* Metric Sections */}
      <MetricSection
        title="Heart Rate Variability"
        value={latestHrv}
        unit="ms"
        baseline={baselines.hrv_baseline}
        data={chartData}
        dataKey="hrv_ms"
        color="#06b6d4"
        higherIsBetter={true}
        range={range}
      />

      <MetricSection
        title="Resting Heart Rate"
        value={latestRhr}
        unit="bpm"
        baseline={baselines.resting_hr_baseline}
        data={chartData}
        dataKey="resting_hr"
        color="#f43f5e"
        higherIsBetter={false}
        range={range}
      />

      <MetricSection
        title="Respiratory Rate"
        value={latestRr}
        unit="br/min"
        baseline={baselines.respiratory_rate_baseline}
        data={chartData}
        dataKey="respiratory_rate"
        color="#a855f7"
        higherIsBetter={false}
        range={range}
      />
    </div>
  );
}
