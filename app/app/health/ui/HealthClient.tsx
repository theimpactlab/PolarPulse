'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { MetricCard } from '@/src/components/MetricCard';

interface DailyMetric {
  date: string;
  hrv_ms?: number;
  resting_hr?: number;
  respiratory_rate?: number;
  spo2?: number;
  stress_avg?: number;
}

interface NightlyRecharge {
  date: string;
  recovery_index?: number;
  hrv_balance?: number;
  rmssd_sleep?: number;
}

interface Baseline {
  hrv_baseline: number;
  resting_hr_baseline: number;
  respiratory_rate_baseline: number;
  spo2_baseline: number;
  stress_baseline: number;
}

interface HealthClientProps {
  dailyMetrics: DailyMetric[];
  nightlyRecharge: NightlyRecharge[];
  baselines: Baseline;
}

type Status = 'good' | 'warning' | 'critical';

const getMetricStatus = (
  value: number | undefined,
  baseline: number,
  isHigherBetter: boolean
): Status => {
  if (value === undefined) return 'warning';

  const threshold = baseline * 0.1;

  if (isHigherBetter) {
    if (value >= baseline - threshold) return 'good';
    if (value >= baseline - threshold * 2) return 'warning';
    return 'critical';
  } else {
    if (value <= baseline + threshold) return 'good';
    if (value <= baseline + threshold * 2) return 'warning';
    return 'critical';
  }
};

const getStatusColor = (status: Status): string => {
  switch (status) {
    case 'good':
      return '#22c55e';
    case 'warning':
      return '#eab308';
    case 'critical':
      return '#ef4444';
  }
};

const getStatusBg = (status: Status): string => {
  switch (status) {
    case 'good':
      return 'bg-green-500/10';
    case 'warning':
      return 'bg-yellow-500/10';
    case 'critical':
      return 'bg-red-500/10';
  }
};

export function HealthClient({
  dailyMetrics,
  nightlyRecharge,
  baselines,
}: HealthClientProps) {
  const latestMetrics = dailyMetrics[dailyMetrics.length - 1];

  const metricsStatus = useMemo(() => {
    if (!latestMetrics) return { good: 0, warning: 0, critical: 0 };

    const stats = {
      hrv: getMetricStatus(latestMetrics.hrv_ms, baselines.hrv_baseline, true),
      rhr: getMetricStatus(
        latestMetrics.resting_hr,
        baselines.resting_hr_baseline,
        false
      ),
      rr: getMetricStatus(
        latestMetrics.respiratory_rate,
        baselines.respiratory_rate_baseline,
        false
      ),
      spo2: getMetricStatus(
        latestMetrics.spo2,
        baselines.spo2_baseline,
        true
      ),
      stress: getMetricStatus(
        latestMetrics.stress_avg,
        baselines.stress_baseline,
        false
      ),
    };

    const good = Object.values(stats).filter((s) => s === 'good').length;
    const warning = Object.values(stats).filter((s) => s === 'warning').length;
    const critical = Object.values(stats).filter((s) => s === 'critical').length;

    return { stats, good, warning, critical };
  }, [latestMetrics, baselines]);

  const chartData = useMemo(() => {
    return dailyMetrics.map((item) => ({
      ...item,
      date: new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, [dailyMetrics]);

  const getStatusMessage = (): { text: string; color: string; bgClass: string } => {
    if (metricsStatus.critical > 0) {
      return {
        text: `${metricsStatus.critical} metric${metricsStatus.critical > 1 ? 's' : ''} need attention`,
        color: '#ef4444',
        bgClass: 'bg-red-500/10',
      };
    }
    if (metricsStatus.warning > 0) {
      return {
        text: `${metricsStatus.warning} metric${metricsStatus.warning > 1 ? 's' : ''} slightly off`,
        color: '#eab308',
        bgClass: 'bg-yellow-500/10',
      };
    }
    return {
      text: 'All metrics normal',
      color: '#22c55e',
      bgClass: 'bg-green-500/10',
    };
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-3 sm:p-6 md:p-8">
      <h1 className="text-2xl sm:text-4xl font-bold mb-4 sm:mb-6">Health Monitor</h1>

      {/* Status Banner */}
      <div
        className={`${statusMessage.bgClass} border border-white/10 rounded-3xl p-6 mb-8`}
        style={{ borderColor: statusMessage.color + '40' }}
      >
        <p
          className="text-lg font-semibold"
          style={{ color: statusMessage.color }}
        >
          {statusMessage.text}
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 mb-8 sm:mb-12">
        {latestMetrics && (
          <>
            <MetricCard
              label="Heart Rate Variability"
              value={latestMetrics.hrv_ms ?? null}
              unit="ms"
            />
            <MetricCard
              label="Resting Heart Rate"
              value={latestMetrics.resting_hr ?? null}
              unit="bpm"
            />
            <MetricCard
              label="Respiratory Rate"
              value={latestMetrics.respiratory_rate ?? null}
              unit="br/min"
            />
            <MetricCard
              label="Blood Oxygen"
              value={latestMetrics.spo2 ?? null}
              unit="%"
            />
            <MetricCard
              label="Stress Level"
              value={latestMetrics.stress_avg ?? null}
              unit="0-100"
            />
          </>
        )}
      </div>

      {/* Individual Metric Charts */}
      <div className="space-y-4 sm:space-y-8">
        {/* HRV Chart */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-3 sm:p-6">
          <h3 className="text-lg font-bold mb-4">Heart Rate Variability Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.5)"
                style={{ fontSize: '10px' }}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                }}
                labelStyle={{ color: 'white' }}
              />
              <ReferenceLine
                y={baselines.hrv_baseline}
                stroke="#06b6d4"
                strokeDasharray="5 5"
                label={{
                  value: 'Baseline',
                  position: 'right',
                  fill: 'rgba(255,255,255,0.5)',
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="hrv_ms"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Resting HR Chart */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-3 sm:p-6">
          <h3 className="text-lg font-bold mb-4">Resting Heart Rate Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.5)"
                style={{ fontSize: '10px' }}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                }}
                labelStyle={{ color: 'white' }}
              />
              <ReferenceLine
                y={baselines.resting_hr_baseline}
                stroke="#f43f5e"
                strokeDasharray="5 5"
                label={{
                  value: 'Baseline',
                  position: 'right',
                  fill: 'rgba(255,255,255,0.5)',
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="resting_hr"
                stroke="#f43f5e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Respiratory Rate Chart */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-3 sm:p-6">
          <h3 className="text-lg font-bold mb-4">Respiratory Rate Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.5)"
                style={{ fontSize: '10px' }}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                }}
                labelStyle={{ color: 'white' }}
              />
              <ReferenceLine
                y={baselines.respiratory_rate_baseline}
                stroke="#a855f7"
                strokeDasharray="5 5"
                label={{
                  value: 'Baseline',
                  position: 'right',
                  fill: 'rgba(255,255,255,0.5)',
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="respiratory_rate"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* SpO2 Chart */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-3 sm:p-6">
          <h3 className="text-lg font-bold mb-4">Blood Oxygen Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.5)"
                style={{ fontSize: '10px' }}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                }}
                labelStyle={{ color: 'white' }}
              />
              <ReferenceLine
                y={baselines.spo2_baseline}
                stroke="#22c55e"
                strokeDasharray="5 5"
                label={{
                  value: 'Baseline',
                  position: 'right',
                  fill: 'rgba(255,255,255,0.5)',
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="spo2"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stress Chart */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-3 sm:p-6">
          <h3 className="text-lg font-bold mb-4">Stress Level Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.5)"
                style={{ fontSize: '10px' }}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                }}
                labelStyle={{ color: 'white' }}
              />
              <ReferenceLine
                y={baselines.stress_baseline}
                stroke="#3b82f6"
                strokeDasharray="5 5"
                label={{
                  value: 'Baseline',
                  position: 'right',
                  fill: 'rgba(255,255,255,0.5)',
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="stress_avg"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
