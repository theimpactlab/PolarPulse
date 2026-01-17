import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react-native';
import { useAppStore, type DailyMetrics } from '@/lib/state/app-store';
import { TrendChart } from '@/components/TrendChart';
import { ScoreRing } from '@/components/ScoreRing';
import { getRecoveryStatus, getRecoveryColor } from '@/lib/utils/scoring';

type TimeRange = '7d' | '30d' | '90d';
type MetricType = 'recovery' | 'hrv' | 'rhr';

export default function RecoveryScreen() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('recovery');

  const dailyMetrics = useAppStore((s): DailyMetrics[] => s.dailyMetrics);

  // In recovery.tsx, verify you're reading from the correct data
  const todayMetrics = dailyMetrics.find((m: DailyMetrics) => m.date === today);
  const recoveryScore = todayMetrics?.recoveryScore ?? 0;  
  const hrv = todayMetrics?.hrv ?? 0;  
  const rhr = todayMetrics?.rhr ?? 0;  
  const sleepScore = todayMetrics?. sleepScore ?? 0;  
  const bodyBattery = todayMetrics?.bodyBattery ?? 0;


  // Calculate deltas from 7-day average
  const getLast7Days = () => {
    const last7 = dailyMetrics.slice(-7);
    return last7;
  };

  const last7Days = getLast7Days();
  const avgHRV = last7Days.length > 0 ? last7Days.reduce((sum, m) => sum + (m.hrv || 0), 0) / last7Days.length : hrv;
  const avgRHR = last7Days.length > 0 ? last7Days. reduce((sum, m) => sum + (m.rhr || 0), 0) / last7Days.length : rhr;

  const hrvDelta = hrv - avgHRV;
  const rhrDelta = rhr - avgRHR;

  // Get trend data
  const getTrendData = (range: TimeRange, metric: MetricType) => {
    const days = range === '7d' ?  7 : range === '30d' ? 30 : 90;
    return dailyMetrics
      .slice(-days)
      .map((m: DailyMetrics) => {
        if (metric === 'recovery') {
          return { date: m.date, value: m.recoveryScore ??  0 };
        } else if (metric === 'hrv') {
          return { date:  m.date, value: m. hrv ?? 0 };
        } else {
          return { date: m. date, value: m.rhr ?? 0 };
        }
      });
  };

  const TrendIcon = ({ delta, inverted = false }: { delta:  number; inverted?: boolean }) => {
    const isPositive = inverted ? delta < 0 : delta > 0;
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

        {/* Key Metrics Row */}
        <View className="flex-row mx-5 mt-4 space-x-3">
          {/* HRV Card */}
          <View className="flex-1 bg-surface rounded-2xl p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-textMuted text-xs font-medium">HRV</Text>
              <Info size={14} color="#6B7280" />
            </View>
            <Text className="text-textPrimary text-2xl font-bold mt-2">
              {hrv > 0 ? `${Math.round(hrv)} ms` : '--'}
            </Text>
            <View className="flex-row items-center mt-2">
              <TrendIcon delta={hrvDelta} />
              <Text className={`text-xs ml-1 ${hrvDelta >= 0 ? 'text-recovery-high' : 'text-recovery-low'}`}>
                {hrvDelta >= 0 ? '+' : ''}{hrvDelta.toFixed(0)} vs avg
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
                {rhrDelta >= 0 ? '+' : ''}{rhrDelta.toFixed(0)} vs avg
              </Text>
            </View>
          </View>

          {/* Sleep Score Card */}
          <View className="flex-1 bg-surface rounded-2xl p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-textMuted text-xs font-medium">SLEEP</Text>
              <Info size={14} color="#6B7280" />
            </View>
            <Text className="text-textPrimary text-2xl font-bold mt-2">
              {sleepScore > 0 ? `${Math.round(sleepScore)}%` : '--'}
            </Text>
            <Text className="text-xs text-textMuted mt-2">score</Text>
          </View>
        </View>

        {/* Trend Selection */}
        <View className="mx-5 mt-6">
          <Text className="text-textPrimary text-lg font-semibold mb-3">Trends</Text>

          {/* Time Range Selector */}
          <View className="flex-row bg-surface rounded-xl p-1 mb-4">
            {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
              <Pressable
                key={range}
                onPress={() => setTimeRange(range)}
                className={`flex-1 py-2 rounded-lg ${timeRange === range ? 'bg-surfaceLight' : ''}`}
              >
                <Text className={`text-center text-sm font-medium ${timeRange === range ? 'text-textPrimary' : 'text-textMuted'}`}>
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Metric Selector */}
          <View className="flex-row bg-surface rounded-xl p-1 mb-4">
            {(['recovery', 'hrv', 'rhr'] as MetricType[]).map((metric) => (
              <Pressable
                key={metric}
                onPress={() => setSelectedMetric(metric)}
                className={`flex-1 py-2 rounded-lg ${selectedMetric === metric ?  'bg-surfaceLight' : ''}`}
              >
                <Text className={`text-center text-sm font-medium ${selectedMetric === metric ? 'text-textPrimary' :  'text-textMuted'}`}>
                  {metric === 'recovery' ? 'Recovery' : metric === 'hrv' ? 'HRV' : 'RHR'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Trend Chart */}
        {getTrendData(timeRange, selectedMetric).length > 0 && (
          <View className="mx-5 mt-4 bg-surface rounded-2xl p-5">
            <TrendChart
              data={getTrendData(timeRange, selectedMetric)}
              color={selectedMetric === 'recovery' ?  '#00D1A7' : selectedMetric === 'hrv' ?  '#3B82F6' : '#FF6B35'}
              height={140}
              showLabels
            />
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}