import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Heart,
  Activity,
  Moon,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Zap,
  Info,
  Play,
  AlertCircle,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAppStore, type DailyMetrics } from '@/lib/state/app-store';
import { useExercises, useSleepData, useCardioLoad, useDailyMetrics } from '@/lib/hooks/usePolarData';
import { ScoreRing } from '@/components/ScoreRing';
import { BodyBatteryCard } from '@/components/BodyBatteryCard';
import { TrainingReadinessCard } from '@/components/TrainingReadinessCard';
import {
  getRecoveryStatus,
  getRecoveryColor,
  getSleepStatus,
  getSleepColor,
  getStrainStatus,
  getStrainColor,
} from '@/lib/utils/scoring';
import { formatDate } from '@/lib/utils/format';

export default function TodayScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const dailyMetrics = useAppStore((s) => s.dailyMetrics);
  const insights = useAppStore((s) => s.insights);
  const syncData = useAppStore((s) => s.syncData);
  const isPolarConnected = useAppStore((s) => s.isPolarConnected);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const loadDemoData = useAppStore((s) => s.loadDemoData);

  // Get today's metrics
  const today = new Date().toISOString().split('T')[0];

  // Only fetch Polar data if connected
  const exercises = isPolarConnected ? useExercises() : { data: null, loading: false, error: null, refetch: async () => {} };
  const sleepData = isPolarConnected ? useSleepData(today) : { data: null, loading: false, error: null, refetch: async () => {} };
  const cardioLoad = isPolarConnected ? useCardioLoad(today) : { data: null, loading: false, error: null, refetch: async () => {} };
  const dailyMetricsData = isPolarConnected ? useDailyMetrics(today, exercises. data || []) : { data: null, loading: false, error: null, refetch: async () => {} };

  // Use Polar data if available, otherwise fallback to store
  const todayMetrics = isPolarConnected && dailyMetricsData.data 
    ? dailyMetricsData.data 
    : dailyMetrics.find((m:  DailyMetrics) => m.date === today);

  // Get yesterday's metrics for comparison
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const yesterdayMetrics = useMemo(
    () => dailyMetrics.find((m: DailyMetrics) => m.date === yesterday),
    [dailyMetrics, yesterday]
  );

  const recoveryScore = todayMetrics?. recoveryScore ??  0;
  const strainScore = todayMetrics?.strainScore ?? 0;
  const sleepScore = todayMetrics?.sleepScore ?? 0;

  // Calculate deltas
  const recoveryDelta = todayMetrics && yesterdayMetrics
    ? recoveryScore - yesterdayMetrics.recoveryScore
    : 0;
  const sleepDelta = todayMetrics && yesterdayMetrics
    ? sleepScore - yesterdayMetrics.sleepScore
    : 0;

  // Today's insights (limit to 3)
  const todayInsights = useMemo(
    () => insights.filter((i) => i.date === today).slice(0, 3),
    [insights, today]
  );

  const hasData = dailyMetrics.length > 0 || (exercises.data && exercises.data.length > 0);
  const isLoading = isPolarConnected && (exercises.loading || sleepData.loading || dailyMetricsData.loading);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Refetch Polar data if connected
      if (isPolarConnected) {
        await Promise.all([exercises.refetch(), sleepData.refetch(), cardioLoad.refetch()]);
      } else {
        // Otherwise sync from store
        await syncData();
      }
    } catch (e) {
      console.error('[TodayScreen] Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const TrendIndicator = ({ delta, inverted = false }: { delta: number; inverted?: boolean }) => {
    const isPositive = inverted ? delta < 0 : delta > 0;

    if (Math.abs(delta) < 2) {
      return (
        <View className="flex-row items-center">
          <Minus size={12} color="#6B7280" />
          <Text className="text-textMuted text-xs ml-0.5">Stable</Text>
        </View>
      );
    }
    return (
      <View className="flex-row items-center">
        {isPositive ? (
          <TrendingUp size={12} color="#00D1A7" />
        ) : (
          <TrendingDown size={12} color="#FF4757" />
        )}
        <Text className={`text-xs ml-0.5 ${isPositive ? 'text-recovery-high' : 'text-recovery-low'}`}>
          {delta > 0 ? '+' : ''}{Math.round(delta)}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00D1A7"
          />
        }
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-2">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-textMuted text-sm">{formatDate(today)}</Text>
              <Text className="text-3xl font-bold text-textPrimary mt-1">Today</Text>
            </View>
            {isDemoMode && (
              <View className="bg-accent/20 px-3 py-1 rounded-full">
                <Text className="text-accent text-xs font-medium">Demo Mode</Text>
              </View>
            )}
            {isPolarConnected && (
              <View className="bg-primary/20 px-3 py-1 rounded-full">
                <Text className="text-primary text-xs font-medium">Live</Text>
              </View>
            )}
          </View>
        </View>

        {/* Error states */}
        {exercises.error && (
          <View className="mx-5 mt-4 bg-red-500/20 rounded-2xl p-4 flex-row items-center">
            <AlertCircle size={16} color="#FF4757" />
            <Text className="text-red-500 text-sm ml-2 flex-1">{exercises.error}</Text>
          </View>
        )}

        {/* Connection Banner - show when not connected and no data */}
        {!isPolarConnected && !hasData && (
          <View className="mx-5 mt-4 space-y-3">
            <Pressable
              onPress={() => router.push('/settings')}
              className="bg-accent/20 rounded-2xl p-4 flex-row items-center active:opacity-80"
            >
              <View className="w-10 h-10 rounded-full bg-accent/30 items-center justify-center">
                <Zap size={20} color="#8B5CF6" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-textPrimary font-semibold">Connect Polar</Text>
                <Text className="text-textSecondary text-sm">
                  Link your device to see live data
                </Text>
              </View>
              <ChevronRight size={20} color="#6B7280" />
            </Pressable>

            <Pressable
              onPress={loadDemoData}
              className="bg-primary/20 rounded-2xl p-4 flex-row items-center active:opacity-80"
            >
              <View className="w-10 h-10 rounded-full bg-primary/30 items-center justify-center">
                <Play size={20} color="#00D1A7" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-textPrimary font-semibold">Try Demo Mode</Text>
                <Text className="text-textSecondary text-sm">
                  See how it works with sample data
                </Text>
              </View>
              <ChevronRight size={20} color="#6B7280" />
            </Pressable>
          </View>
        )}

        {/* Loading state */}
        {isLoading && (
          <View className="mx-5 mt-6 items-center py-8">
            <ActivityIndicator size="large" color="#00D1A7" />
            <Text className="text-textSecondary mt-2">Loading today's data...</Text>
          </View>
        )}

        {/* Main Score Cards */}
        {! isLoading && (
          <View className="px-5 mt-6">
            {/* Recovery Card - Primary */}
            <Pressable
              onPress={() => router.push('/recovery')}
              className="bg-surface rounded-2xl p-5 active:opacity-90"
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Heart size={18} color={getRecoveryColor(recoveryScore)} />
                    <Text className="text-textSecondary text-sm font-medium ml-2">RECOVERY</Text>
                  </View>
                  <View className="flex-row items-baseline mt-2">
                    <Text className="text-5xl font-bold text-textPrimary">{recoveryScore}</Text>
                    <Text className="text-textMuted text-lg ml-1">%</Text>
                  </View>
                  <View className="flex-row items-center mt-2">
                    <View
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: getRecoveryColor(recoveryScore) }}
                    />
                    <Text style={{ color: getRecoveryColor(recoveryScore) }} className="font-medium">
                      {getRecoveryStatus(recoveryScore)}
                    </Text>
                    <View className="mx-2 w-px h-3 bg-border" />
                    <TrendIndicator delta={recoveryDelta} />
                  </View>
                </View>
                <ScoreRing
                  score={recoveryScore}
                  size={100}
                  strokeWidth={8}
                  color={getRecoveryColor(recoveryScore)}
                  showLabel={false}
                />
              </View>

              {/* Key metrics row */}
              <View className="flex-row mt-4 pt-4 border-t border-border">
                <View className="flex-1">
                  <Text className="text-textMuted text-xs">HRV</Text>
                  <Text className="text-textPrimary font-semibold">
                    {todayMetrics?. hrv ?  `${todayMetrics.hrv} ms` : '--'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-textMuted text-xs">Resting HR</Text>
                  <Text className="text-textPrimary font-semibold">
                    {todayMetrics?.rhr ? `${todayMetrics.rhr} bpm` : '--'}
                  </Text>
                </View>
                <ChevronRight size={20} color="#6B7280" />
              </View>
            </Pressable>

            {/* Strain & Sleep Row */}
            <View className="flex-row mt-4 space-x-3">
              {/* Strain Card */}
              <Pressable
                onPress={() => router.push('/fitness')}
                className="flex-1 bg-surface rounded-2xl p-4 active: opacity-90"
              >
                <View className="flex-row items-center">
                  <Activity size={16} color={getStrainColor(strainScore)} />
                  <Text className="text-textSecondary text-xs font-medium ml-1. 5">STRAIN</Text>
                </View>
                <Text className="text-3xl font-bold text-textPrimary mt-2">
                  {strainScore. toFixed(1)}
                </Text>
                <View className="flex-row items-center mt-1">
                  <View
                    className="w-1. 5 h-1.5 rounded-full mr-1.5"
                    style={{ backgroundColor: getStrainColor(strainScore) }}
                  />
                  <Text className="text-textMuted text-xs">{getStrainStatus(strainScore)}</Text>
                </View>
                {/* Strain progress bar */}
                <View className="h-1. 5 bg-surfaceLight rounded-full mt-3 overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (strainScore / 21) * 100)}%`,
                      backgroundColor: getStrainColor(strainScore),
                    }}
                  />
                </View>
                <Text className="text-textMuted text-xs mt-1">of 21 max</Text>
              </Pressable>

              {/* Sleep Card */}
              <Pressable
                onPress={() => router.push('/sleep')}
                className="flex-1 bg-surface rounded-2xl p-4 active:opacity-90"
              >
                <View className="flex-row items-center">
                  <Moon size={16} color={getSleepColor(sleepScore)} />
                  <Text className="text-textSecondary text-xs font-medium ml-1.5">SLEEP</Text>
                </View>
                <Text className="text-3xl font-bold text-textPrimary mt-2">{sleepScore}</Text>
                <View className="flex-row items-center mt-1">
                  <View
                    className="w-1.5 h-1.5 rounded-full mr-1.5"
                    style={{ backgroundColor: getSleepColor(sleepScore) }}
                  />
                  <Text className="text-textMuted text-xs">{getSleepStatus(sleepScore)}</Text>
                </View>
                {/* Delta indicator */}
                <View className="mt-3">
                  <TrendIndicator delta={sleepDelta} />
                </View>
              </Pressable>
            </View>
          </View>
        )}

        {/* Body Battery & Training Readiness Row */}
        {hasData && ! isLoading && (
          <View className="px-5 mt-4">
            <View className="flex-row space-x-3">
              {/* Body Battery */}
              <View className="flex-1">
                <BodyBatteryCard
                  value={todayMetrics?.bodyBattery ??  0}
                  onPress={() => router.push('/recovery')}
                />
              </View>
            </View>

            {/* Training Readiness */}
            <View className="mt-3">
              <TrainingReadinessCard
                score={todayMetrics?.trainingReadiness ?? 0}
                recoveryScore={recoveryScore}
                sleepScore={sleepScore}
                onPress={() => router.push('/fitness')}
              />
            </View>
          </View>
        )}

        {/* Insights Section */}
        {todayInsights. length > 0 && ! isLoading && (
          <View className="mt-6 px-5">
            <View className="flex-row items-center mb-3">
              <Info size={16} color="#9CA3AF" />
              <Text className="text-textSecondary text-sm font-medium ml-2">TODAY'S INSIGHTS</Text>
            </View>
            {todayInsights.map((insight) => (
              <View
                key={insight.id}
                className="bg-surface rounded-xl p-4 mb-2"
              >
                <View className="flex-row items-start">
                  <View
                    className="w-1.5 h-full rounded-full mr-3"
                    style={{
                      backgroundColor: 
                        insight.priority === 'high'
                          ? '#FF4757'
                          :  insight.priority === 'medium'
                          ? '#F5A623'
                          : '#00D1A7',
                    }}
                  />
                  <View className="flex-1">
                    <Text className="text-textPrimary font-medium">{insight.title}</Text>
                    <Text className="text-textSecondary text-sm mt-1">
                      {insight.description}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Quick Stats */}
        {hasData && !isLoading && (
          <View className="mt-6 px-5 mb-8">
            <Text className="text-textSecondary text-sm font-medium mb-3">QUICK STATS</Text>
            <View className="bg-surface rounded-2xl overflow-hidden">
              <StatRow
                label="Sleep Consistency"
                value={todayMetrics?.sleepConsistency ?  `${todayMetrics.sleepConsistency}%` : '--'}
              />
              <StatRow
                label="7-Day Recovery Avg"
                value={calculateAverage(dailyMetrics, 'recoveryScore', 7)}
                isLast
              />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatRow({
  label,
  value,
  isLast = false,
}:  {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      className={`flex-row justify-between items-center px-4 py-3 ${
        ! isLast ? 'border-b border-border' : ''
      }`}
    >
      <Text className="text-textSecondary">{label}</Text>
      <Text className="text-textPrimary font-medium">{value}</Text>
    </View>
  );
}

function calculateAverage(
  metrics: DailyMetrics[],
  field: keyof DailyMetrics,
  days: number
): string {
  const now = new Date();
  const recent = metrics.filter((m) => {
    const date = new Date(m. date);
    const diffDays = (now. getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= days;
  });

  if (recent.length === 0) return '--';

  const sum = recent.reduce((acc, m) => {
    const val = m[field];
    return acc + (typeof val === 'number' ? val : 0);
  }, 0);

  return `${Math.round(sum / recent.length)}%`;
}