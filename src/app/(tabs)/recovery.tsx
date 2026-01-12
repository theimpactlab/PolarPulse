import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react-native';
import { useAppStore, type DailyMetrics, type Baselines } from '@/lib/state/app-store';
import { TrendChart } from '@/components/TrendChart';
import { ScoreRing } from '@/components/ScoreRing';
import { BodyBatteryCard } from '@/components/BodyBatteryCard';
import { BodyTempCard } from '@/components/BodyTempCard';
import { getRecoveryStatus, getRecoveryColor } from '@/lib/utils/scoring';

type TimeRange = '7d' | '30d' | '90d';
type MetricType = 'hrv' | 'rhr' | 'recovery';

export default function RecoveryScreen() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('recovery');

  const dailyMetrics = useAppStore((s): DailyMetrics[] => s.dailyMetrics);
  const baselines = useAppStore((s): Baselines | undefined => s.baselines);

  // Get today's metrics
  const today = new Date().toISOString().split('T')[0];
  const todayMetrics = dailyMetrics.find((m: DailyMetrics) => m.date === today);
  const recoveryScore = todayMetrics?.recoveryScore ?? 0;
  const hrv = todayMetrics?.hrv ?? 0;
  const rhr = todayMetrics?.rhr ?? 0;

  // Calculate deltas from baseline
  const hrvDelta = hrv - (baselines?.hrvBaseline ?? hrv);
  const rhrDelta = rhr - (baselines?.rhrBaseline ?? rhr);

  // Get trend data
  const getTrendData = (range: TimeRange, metric: MetricType) => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const now = new Date();
    return Array.from({ length: days }, (_, i) => {
      const date = new Date(now.getTime() - (days - 1 - i) * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const metrics = dailyMetrics.find((m: DailyMetrics) => m.date === dateStr);
      let value = 0;
      if (metric === 'hrv') value = metrics?.hrv || 0;
      else if (metric === 'rhr') value = metrics?.rhr || 0;
      else value = metrics?.recoveryScore || 0;
      return { date: dateStr, value };
    });
  };

  const TrendIcon = ({ delta, inverted = false }: { delta: number; inverted?: boolean }) => {
    const isPositive = inverted ? delta < 0 : delta > 0;
    const isNegative = inverted ? delta > 0 : delta < 0;

    if (Math.abs(delta) < 0.5) {
      return <Minus size={14} color="#6B7280" />;
    }
    if (isPositive) {
      return <TrendingUp size={14} color="#00D1A7" />;
    }
    return <TrendingDown size={14} color="#FF4757" />;
  };

  const recoveryStatus = getRecoveryStatus(recoveryScore);
  const recoveryColor = getRecoveryColor(recoveryScore);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 pt-4 pb-2">
          <Text className="text-3xl font-bold text-textPrimary">Recovery</Text>
          <Text className="text-textSecondary mt-1">Readiness & physiological state</Text>
        </View>

        {/* Main Recovery Score */}
        <View className="mx-5 mt-4 bg-surface rounded-2xl p-6 items-center">
          <ScoreRing
            score={recoveryScore}
            size={160}
            strokeWidth={12}
            color={recoveryColor}
          />
          <Text className="text-textMuted text-sm mt-4">TODAY'S RECOVERY</Text>
          <View className="flex-row items-center mt-1">
            <View
              className="w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: recoveryColor }}
            />
            <Text className="text-textPrimary text-lg font-semibold">{recoveryStatus}</Text>
          </View>
        </View>

        {/* Key Metrics */}
        <View className="flex-row mx-5 mt-4 space-x-3">
          {/* HRV Card */}
          <View className="flex-1 bg-surface rounded-2xl p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-textMuted text-xs font-medium">HRV</Text>
              <Info size={14} color="#6B7280" />
            </View>
            <Text className="text-textPrimary text-2xl font-bold mt-2">
              {hrv > 0 ? `${hrv} ms` : '--'}
            </Text>
            <View className="flex-row items-center mt-2">
              <TrendIcon delta={hrvDelta} />
              <Text className={`text-xs ml-1 ${hrvDelta >= 0 ? 'text-recovery-high' : 'text-recovery-low'}`}>
                {hrvDelta >= 0 ? '+' : ''}{hrvDelta.toFixed(0)} vs baseline
              </Text>
            </View>
          </View>

          {/* RHR Card */}
          <View className="flex-1 bg-surface rounded-2xl p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-textMuted text-xs font-medium">RESTING HR</Text>
              <Info size={14} color="#6B7280" />
            </View>
            <Text className="text-textPrimary text-2xl font-bold mt-2">
              {rhr > 0 ? `${rhr} bpm` : '--'}
            </Text>
            <View className="flex-row items-center mt-2">
              <TrendIcon delta={rhrDelta} inverted />
              <Text className={`text-xs ml-1 ${rhrDelta <= 0 ? 'text-recovery-high' : 'text-recovery-low'}`}>
                {rhrDelta >= 0 ? '+' : ''}{rhrDelta.toFixed(0)} vs baseline
              </Text>
            </View>
          </View>
        </View>

        {/* Body Battery & Body Temp Cards */}
        <View className="mx-5 mt-4 space-y-3">
          <BodyBatteryCard value={todayMetrics?.bodyBattery ?? 0} />
          <BodyTempCard
            deviation={todayMetrics?.bodyTempDeviation ?? 0}
            baseline={baselines?.bodyTempBaseline}
          />
        </View>

        {/* Contributors */}
        <View className="mx-5 mt-4 bg-surface rounded-2xl p-5">
          <Text className="text-textSecondary text-sm font-medium mb-4">RECOVERY CONTRIBUTORS</Text>

          <View className="space-y-3">
            <ContributorRow
              label="HRV"
              weight="40%"
              value={hrv > 0 ? `${hrv} ms` : 'No data'}
              status={hrvDelta >= 0 ? 'positive' : 'negative'}
            />
            <ContributorRow
              label="Resting HR"
              weight="20%"
              value={rhr > 0 ? `${rhr} bpm` : 'No data'}
              status={rhrDelta <= 0 ? 'positive' : 'negative'}
            />
            <ContributorRow
              label="Sleep Performance"
              weight="30%"
              value={todayMetrics?.sleepScore ? `${todayMetrics.sleepScore}%` : 'No data'}
              status={todayMetrics?.sleepScore && todayMetrics.sleepScore >= 70 ? 'positive' : 'neutral'}
            />
            <ContributorRow
              label="Prior Day Strain"
              weight="10%"
              value={todayMetrics?.strainScore ? todayMetrics.strainScore.toFixed(1) : 'No data'}
              status="neutral"
            />
          </View>
        </View>

        {/* Trend Selection */}
        <View className="mx-5 mt-4">
          <View className="flex-row bg-surface rounded-xl p-1">
            {(['recovery', 'hrv', 'rhr'] as MetricType[]).map((metric) => (
              <Pressable
                key={metric}
                onPress={() => setSelectedMetric(metric)}
                className={`flex-1 py-2 rounded-lg ${selectedMetric === metric ? 'bg-surfaceLight' : ''}`}
              >
                <Text className={`text-center text-sm font-medium ${selectedMetric === metric ? 'text-textPrimary' : 'text-textMuted'}`}>
                  {metric === 'recovery' ? 'Recovery' : metric === 'hrv' ? 'HRV' : 'RHR'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Trend Chart */}
        <View className="mx-5 mt-4 bg-surface rounded-2xl p-5">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-textPrimary text-lg font-semibold">
              {selectedMetric === 'recovery' ? 'Recovery' : selectedMetric === 'hrv' ? 'HRV' : 'Resting HR'} Trend
            </Text>
            <View className="flex-row bg-surfaceLight rounded-lg p-1">
              {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
                <Pressable
                  key={range}
                  onPress={() => setTimeRange(range)}
                  className={`px-3 py-1.5 rounded-md ${timeRange === range ? 'bg-primary' : ''}`}
                >
                  <Text className={`text-xs font-semibold ${timeRange === range ? 'text-background' : 'text-textMuted'}`}>
                    {range}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <TrendChart
            data={getTrendData(timeRange, selectedMetric)}
            color={selectedMetric === 'recovery' ? '#00D1A7' : selectedMetric === 'hrv' ? '#3B82F6' : '#FF6B35'}
            height={140}
            showLabels
            showBaseline={selectedMetric !== 'recovery'}
            baseline={
              selectedMetric === 'hrv'
                ? baselines?.hrvBaseline
                : selectedMetric === 'rhr'
                  ? baselines?.rhrBaseline
                  : undefined
            }
          />
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

function ContributorRow({
  label,
  weight,
  value,
  status
}: {
  label: string;
  weight: string;
  value: string;
  status: 'positive' | 'negative' | 'neutral';
}) {
  const statusColor = status === 'positive' ? '#00D1A7' : status === 'negative' ? '#FF4757' : '#6B7280';

  return (
    <View className="flex-row items-center justify-between py-2 border-b border-border">
      <View className="flex-row items-center">
        <View
          className="w-1.5 h-8 rounded-full mr-3"
          style={{ backgroundColor: statusColor }}
        />
        <View>
          <Text className="text-textPrimary text-sm font-medium">{label}</Text>
          <Text className="text-textMuted text-xs">{weight} weight</Text>
        </View>
      </View>
      <Text className="text-textSecondary text-sm">{value}</Text>
    </View>
  );
}
