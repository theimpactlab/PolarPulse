'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

type TimeRange = '7d' | '30d' | '90d';
type Metric = 'recovery' | 'strain' | 'sleep' | 'hrv' | 'rhr';

interface DailyMetric {
  date: string;
  recovery_score?: number;
  strain_score?: number;
  strain_21?: number;
  sleep_score?: number;
  hrv_ms?: number;
  resting_hr?: number;
  respiratory_rate?: number;
  steps?: number;
  active_calories?: number;
}

interface TrendsClientProps {
  data: DailyMetric[];
}

const metricConfig = {
  recovery: {
    label: 'Recovery',
    color: '#22c55e',
    dataKey: 'recovery_score',
    gradientId: 'colorRecovery',
  },
  strain: {
    label: 'Strain',
    color: '#3b82f6',
    dataKey: 'strain_21',
    gradientId: 'colorStrain',
  },
  sleep: {
    label: 'Sleep',
    color: '#a855f7',
    dataKey: 'sleep_score',
    gradientId: 'colorSleep',
  },
  hrv: {
    label: 'HRV',
    color: '#06b6d4',
    dataKey: 'hrv_ms',
    gradientId: 'colorHRV',
  },
  rhr: {
    label: 'RHR',
    color: '#f43f5e',
    dataKey: 'resting_hr',
    gradientId: 'colorRHR',
  },
};

export function TrendsClient({ data }: TrendsClientProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedMetrics, setSelectedMetrics] = useState<Metric[]>([
    'recovery',
  ]);

  const dayCount = useMemo(() => {
    switch (timeRange) {
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '90d':
        return 90;
    }
  }, [timeRange]);

  const filteredData = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - dayCount);

    return data
      .filter(
        (item) =>
          new Date(item.date + 'T00:00:00') >= cutoffDate
      )
      .map((item) => ({
        ...item,
        date: new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      }));
  }, [data, dayCount]);

  const toggleMetric = (metric: Metric) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric)
        ? prev.filter((m) => m !== metric)
        : [...prev, metric]
    );
  };

  const calculateStats = (metric: Metric) => {
    const config = metricConfig[metric];
    const values = filteredData
      .map((item) => item[config.dataKey as keyof DailyMetric])
      .filter((v): v is number => typeof v === 'number');

    if (values.length === 0) {
      return { average: 0, min: 0, max: 0, trend: 'stable' as const };
    }

    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg =
      firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    const difference = secondAvg - firstAvg;
    if (difference > firstAvg * 0.05) {
      trend = 'up';
    } else if (difference < -firstAvg * 0.05) {
      trend = 'down';
    }

    return { average: Math.round(average * 10) / 10, min, max, trend };
  };

  const calculateHighlights = (metric: Metric) => {
    const config = metricConfig[metric];
    const itemsWithValue = filteredData.filter(
      (item) => item[config.dataKey as keyof DailyMetric] !== undefined
    );

    if (itemsWithValue.length === 0) {
      return { bestDay: null, worstDay: null, streak: 0 };
    }

    const sortByValue = (ascending: boolean) => {
      return itemsWithValue.sort((a, b) => {
        const aVal = a[config.dataKey as keyof DailyMetric] as number;
        const bVal = b[config.dataKey as keyof DailyMetric] as number;
        return ascending ? aVal - bVal : bVal - aVal;
      });
    };

    const isHigherBetter = ['recovery', 'sleep', 'hrv'].includes(metric);
    const bestDay = sortByValue(!isHigherBetter)[0];
    const worstDay = sortByValue(isHigherBetter)[0];

    const avgValue =
      itemsWithValue.reduce(
        (acc, item) => acc + (item[config.dataKey as keyof DailyMetric] as number),
        0
      ) / itemsWithValue.length;

    let streak = 0;
    let currentStreak = 0;
    for (const item of itemsWithValue) {
      const val = item[config.dataKey as keyof DailyMetric] as number;
      const isAboveAvg = isHigherBetter ? val > avgValue : val < avgValue;
      if (isAboveAvg) {
        currentStreak++;
        streak = Math.max(streak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return { bestDay, worstDay, streak };
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-3 sm:p-6 md:p-8">
      <h1 className="text-2xl sm:text-4xl font-bold mb-6 sm:mb-8">Trends</h1>

      {/* Time Range Selector */}
      <div className="flex gap-2 sm:gap-3 mb-6 sm:mb-8">
        {(['7d', '30d', '90d'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl text-sm sm:text-base font-semibold transition-all ${
              timeRange === range
                ? 'bg-white text-zinc-950'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
          </button>
        ))}
      </div>

      {/* Metric Selector */}
      <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-8">
        {(Object.keys(metricConfig) as Metric[]).map((metric) => (
          <button
            key={metric}
            onClick={() => toggleMetric(metric)}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl text-sm sm:text-base font-semibold transition-all ${
              selectedMetrics.includes(metric)
                ? `bg-[${metricConfig[metric].color}] text-white`
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            style={
              selectedMetrics.includes(metric)
                ? {
                    backgroundColor: metricConfig[metric].color,
                  }
                : undefined
            }
          >
            {metricConfig[metric].label}
          </button>
        ))}
      </div>

      {/* Main Chart */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-3 sm:p-6 mb-8">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={filteredData}>
            <defs>
              {(Object.keys(metricConfig) as Metric[]).map((metric) => {
                const config = metricConfig[metric];
                const rgb = parseInt(config.color.slice(1), 16);
                const r = (rgb >> 16) & 255;
                const g = (rgb >> 8) & 255;
                const b = rgb & 255;

                return (
                  <linearGradient
                    key={config.gradientId}
                    id={config.gradientId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={config.color}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={config.color}
                      stopOpacity={0}
                    />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="date"
              stroke="rgba(255,255,255,0.5)"
              style={{ fontSize: '12px' }}
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
            {selectedMetrics.map((metric) => {
              const config = metricConfig[metric];
              return (
                <Area
                  key={metric}
                  type="monotone"
                  dataKey={config.dataKey}
                  stroke={config.color}
                  fill={`url(#${config.gradientId})`}
                  strokeWidth={2}
                  dot={false}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats and Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {selectedMetrics.map((metric) => {
          const stats = calculateStats(metric);
          const highlights = calculateHighlights(metric);

          return (
            <div
              key={metric}
              className="bg-zinc-900/50 border border-white/10 rounded-3xl p-6"
            >
              <h3
                className="text-xl font-bold mb-4"
                style={{ color: metricConfig[metric].color }}
              >
                {metricConfig[metric].label}
              </h3>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <p className="text-xs text-white/60 mb-1">Average</p>
                  <p className="text-lg font-bold">{stats.average}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60 mb-1">Min</p>
                  <p className="text-lg font-bold">{stats.min}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60 mb-1">Max</p>
                  <p className="text-lg font-bold">{stats.max}</p>
                </div>
              </div>

              {/* Trend */}
              <div className="mb-6 pb-6 border-b border-white/10">
                <p className="text-sm text-white/60 mb-1">Trend</p>
                <p className="text-lg font-semibold">
                  {stats.trend === 'up'
                    ? 'â Improving'
                    : stats.trend === 'down'
                      ? 'â Declining'
                      : 'â Stable'}
                </p>
              </div>

              {/* Highlights */}
              <h4 className="text-sm font-semibold text-white/80 mb-3">
                Highlights
              </h4>
              {highlights.bestDay && (
                <div className="mb-2">
                  <p className="text-xs text-white/60">Best Day</p>
                  <p className="text-sm font-medium">{highlights.bestDay.date}</p>
                </div>
              )}
              {highlights.worstDay && (
                <div className="mb-2">
                  <p className="text-xs text-white/60">Worst Day</p>
                  <p className="text-sm font-medium">{highlights.worstDay.date}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-white/60">Current Streak</p>
                <p className="text-sm font-medium">{highlights.streak} days</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

type TimeRange = '7d' | '30d' | '90d';
type Metric = 'recovery' | 'strain' | 'sleep' | 'hrv' | 'rhr';

interface DailyMetric {
  date: string;
  recovery_score?: number;
  strain_score?: number;
  strain_21?: number;
  sleep_score?: number;
  hrv_ms?: number;
  resting_hr?: number;
  respiratory_rate?: number;
  steps?: number;
  active_calories?: number;
}

interface TrendsClientProps {
  data: DailyMetric[];
}

const metricConfig = {
  recovery: {
    label: 'Recovery',
    color: '#22c55e',
    dataKey: 'recovery_score',
    gradientId: 'colorRecovery',
  },
  strain: {
    label: 'Strain',
    color: '#3b82f6',
    dataKey: 'strain_21',
    gradientId: 'colorStrain',
  },
  sleep: {
    label: 'Sleep',
    color: '#a855f7',
    dataKey: 'sleep_score',
    gradientId: 'colorSleep',
  },
  hrv: {
    label: 'HRV',
    color: '#06b6d4',
    dataKey: 'hrv_ms',
    gradientId: 'colorHRV',
  },
  rhr: {
    label: 'RHR',
    color: '#f43f5e',
    dataKey: 'resting_hr',
    gradientId: 'colorRHR',
  },
};

export function TrendsClient({ data }: TrendsClientProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedMetrics, setSelectedMetrics] = useState<Metric[]>([
    'recovery',
  ]);

  const dayCount = useMemo(() => {
    switch (timeRange) {
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '90d':
        return 90;
    }
  }, [timeRange]);

  const filteredData = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - dayCount);

    return data
      .filter(
        (item) =>
          new Date(item.date + 'T00:00:00') >= cutoffDate
      )
      .map((item) => ({
        ...item,
        date: new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      }));
  }, [data, dayCount]);

  const toggleMetric = (metric: Metric) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric)
        ? prev.filter((m) => m !== metric)
        : [...prev, metric]
    );
  };

  const calculateStats = (metric: Metric) => {
    const config = metricConfig[metric];
    const values = filteredData
      .map((item) => item[config.dataKey as keyof DailyMetric])
      .filter((v): v is number => typeof v === 'number');

    if (values.length === 0) {
      return { average: 0, min: 0, max: 0, trend: 'stable' as const };
    }

    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg =
      firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    const difference = secondAvg - firstAvg;
    if (difference > firstAvg * 0.05) {
      trend = 'up';
    } else if (difference < -firstAvg * 0.05) {
      trend = 'down';
    }

    return { average: Math.round(average * 10) / 10, min, max, trend };
  };

  const calculateHighlights = (metric: Metric) => {
    const config = metricConfig[metric];
    const itemsWithValue = filteredData.filter(
      (item) => item[config.dataKey as keyof DailyMetric] !== undefined
    );

    if (itemsWithValue.length === 0) {
      return { bestDay: null, worstDay: null, streak: 0 };
    }

    const sortByValue = (ascending: boolean) => {
      return itemsWithValue.sort((a, b) => {
        const aVal = a[config.dataKey as keyof DailyMetric] as number;
        const bVal = b[config.dataKey as keyof DailyMetric] as number;
        return ascending ? aVal - bVal : bVal - aVal;
      });
    };

    const isHigherBetter = ['recovery', 'sleep', 'hrv'].includes(metric);
    const bestDay = sortByValue(!isHigherBetter)[0];
    const worstDay = sortByValue(isHigherBetter)[0];

    const avgValue =
      itemsWithValue.reduce(
        (acc, item) => acc + (item[config.dataKey as keyof DailyMetric] as number),
        0
      ) / itemsWithValue.length;

    let streak = 0;
    let currentStreak = 0;
    for (const item of itemsWithValue) {
      const val = item[config.dataKey as keyof DailyMetric] as number;
      const isAboveAvg = isHigherBetter ? val > avgValue : val < avgValue;
      if (isAboveAvg) {
        currentStreak++;
        streak = Math.max(streak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return { bestDay, worstDay, streak };
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-8">
      <h1 className="text-4xl font-bold mb-8">Trends</h1>

      {/* Time Range Selector */}
      <div className="flex gap-3 mb-8">
        {(['7d', '30d', '90d'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-2xl font-semibold transition-all ${
              timeRange === range
                ? 'bg-white text-zinc-950'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
          </button>
        ))}
      </div>

      {/* Metric Selector */}
      <div className="flex flex-wrap gap-3 mb-8">
        {(Object.keys(metricConfig) as Metric[]).map((metric) => (
          <button
            key={metric}
            onClick={() => toggleMetric(metric)}
            className={`px-4 py-2 rounded-2xl font-semibold transition-all ${
              selectedMetrics.includes(metric)
                ? `bg-[${metricConfig[metric].color}] text-white`
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            style={
              selectedMetrics.includes(metric)
                ? {
                    backgroundColor: metricConfig[metric].color,
                  }
                : undefined
            }
          >
            {metricConfig[metric].label}
          </button>
        ))}
      </div>

      {/* Main Chart */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-6 mb-8">
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={filteredData}>
            <defs>
              {(Object.keys(metricConfig) as Metric[]).map((metric) => {
                const config = metricConfig[metric];
                const rgb = parseInt(config.color.slice(1), 16);
                const r = (rgb >> 16) & 255;
                const g = (rgb >> 8) & 255;
                const b = rgb & 255;

                return (
                  <linearGradient
                    key={config.gradientId}
                    id={config.gradientId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={config.color}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={config.color}
                      stopOpacity={0}
                    />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="date"
              stroke="rgba(255,255,255,0.5)"
              style={{ fontSize: '12px' }}
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
            {selectedMetrics.map((metric) => {
              const config = metricConfig[metric];
              return (
                <Area
                  key={metric}
                  type="monotone"
                  dataKey={config.dataKey}
                  stroke={config.color}
                  fill={`url(#${config.gradientId})`}
                  strokeWidth={2}
                  dot={false}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats and Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {selectedMetrics.map((metric) => {
          const stats = calculateStats(metric);
          const highlights = calculateHighlights(metric);

          return (
            <div
              key={metric}
              className="bg-zinc-900/50 border border-white/10 rounded-3xl p-6"
            >
              <h3
                className="text-xl font-bold mb-4"
                style={{ color: metricConfig[metric].color }}
              >
                {metricConfig[metric].label}
              </h3>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <p className="text-xs text-white/60 mb-1">Average</p>
                  <p className="text-lg font-bold">{stats.average}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60 mb-1">Min</p>
                  <p className="text-lg font-bold">{stats.min}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60 mb-1">Max</p>
                  <p className="text-lg font-bold">{stats.max}</p>
                </div>
              </div>

              {/* Trend */}
              <div className="mb-6 pb-6 border-b border-white/10">
                <p className="text-sm text-white/60 mb-1">Trend</p>
                <p className="text-lg font-semibold">
                  {stats.trend === 'up'
                    ? '↑ Improving'
                    : stats.trend === 'down'
                      ? '↓ Declining'
                      : '→ Stable'}
                </p>
              </div>

              {/* Highlights */}
              <h4 className="text-sm font-semibold text-white/80 mb-3">
                Highlights
              </h4>
              {highlights.bestDay && (
                <div className="mb-2">
                  <p className="text-xs text-white/60">Best Day</p>
                  <p className="text-sm font-medium">{highlights.bestDay.date}</p>
                </div>
              )}
              {highlights.worstDay && (
                <div className="mb-2">
                  <p className="text-xs text-white/60">Worst Day</p>
                  <p className="text-sm font-medium">{highlights.worstDay.date}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-white/60">Current Streak</p>
                <p className="text-sm font-medium">{highlights.streak} days</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
