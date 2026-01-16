import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Moon, Clock, Bed, Sun, ChevronRight } from 'lucide-react-native';
import { useAppStore, type SleepSession, type DailyMetrics, type UserSettings } from '@/lib/state/app-store';
import { useRouter } from 'expo-router';
import { TrendChart } from '@/components/TrendChart';
import { ScoreRing } from '@/components/ScoreRing';
import { SleepDebtCard } from '@/components/SleepDebtCard';
import { formatTime, formatDuration, getDayOfWeek, formatDate } from '@/lib/utils/format';
import { getSleepStatus, getSleepColor } from '@/lib/utils/scoring';

type TimeRange = '7d' | '30d' | '90d';

export default function SleepScreen() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const sleepSessions = useAppStore((s): SleepSession[] => s. sleepSessions);
  const dailyMetrics = useAppStore((s): DailyMetrics[] => s.dailyMetrics);
  const userSettings = useAppStore((s): UserSettings => s.userSettings);

  // Get last night's sleep (sorted by date, most recent first)
  const today = new Date().toISOString().split('T')[0];
  const lastNight = sleepSessions
    .sort((a:  SleepSession, b: SleepSession) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  // ✅ FIXED: Use sleep_score from the sleep object itself
  const sleepScore = lastNight?.sleep_score ?  Math.round(lastNight.sleep_score) : 0;
  const consistencyScore = 0; // Not available from Polar data

  // Sleep need (default 8 hours)
  const sleepNeedMinutes = (userSettings?.sleepGoalHours ??  8) * 60;
  const actualSleepMinutes = lastNight?.totalSleepMinutes ?? 0;
  const sleepDebt = Math.max(0, sleepNeedMinutes - actualSleepMinutes);

  // Get trend data
  const getTrendData = (range: TimeRange, metric: 'duration' | 'score' | 'consistency') => {
    const days = range === '7d' ?  7 : range === '30d' ? 30 : 90;
    const now = new Date();
    return Array.from({ length: days }, (_, i) => {
      const date = new Date(now.getTime() - (days - 1 - i) * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const session = sleepSessions.find((s:  SleepSession) => s.date === dateStr);
      const metrics = dailyMetrics.find((m: DailyMetrics) => m.date === dateStr);

      let value = 0;
      if (metric === 'duration') {
        value = session?.totalSleepMinutes ?  session.totalSleepMinutes / 60 : 0;
      } else if (metric === 'score') {
        value = metrics?.sleepScore || (session?.sleep_score ?  Math.round(session.sleep_score) : 0);
      } else {
        value = metrics?.sleepConsistency || 0;
      }
      return { date:  dateStr, value };
    });
  };

  // Calculate weekly average
  const weeklyAvg = React.useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = sleepSessions.filter((s: SleepSession) => new Date(s.date) >= weekAgo);

    if (thisWeek.length === 0) return 0;
    return thisWeek.reduce((sum:  number, s: SleepSession) => sum + s.totalSleepMinutes, 0) / thisWeek.length;
  }, [sleepSessions]);

  const sleepStatus = getSleepStatus(sleepScore);
  const sleepColor = getSleepColor(sleepScore);

  // Get last 3 sleep sessions
  const lastThreeSleeps = sleepSessions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 pt-4 pb-2">
          <Text className="text-3xl font-bold text-textPrimary">Sleep</Text>
          <Text className="text-textSecondary mt-1">Rest quality & patterns</Text>
        </View>

        {/* Main Sleep Score */}
        {lastNight ?  (
          <View className="mx-5 mt-4 bg-surface rounded-2xl p-6 items-center">
            <ScoreRing
              score={sleepScore}
              size={160}
              strokeWidth={12}
              color={sleepColor}
            />
            <Text className="text-textMuted text-sm mt-4">LAST NIGHT'S SLEEP</Text>
            <View className="flex-row items-center mt-1">
              <View
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: sleepColor }}
              />
              <Text className="text-textPrimary text-lg font-semibold">{sleepStatus}</Text>
            </View>
            <Text className="text-textMuted text-xs mt-2">{formatDate(lastNight.date)}</Text>
          </View>
        ) : (
          <View className="mx-5 mt-4 bg-surface rounded-2xl p-6 items-center">
            <Moon size={48} color="#6B7280" />
            <Text className="text-textMuted text-sm mt-4">No sleep data</Text>
          </View>
        )}

        {/* Sleep Details */}
        {lastNight && (
          <View className="mx-5 mt-4 bg-surface rounded-2xl p-5">
            <Text className="text-textSecondary text-sm font-medium mb-4">SLEEP DETAILS</Text>

            <View className="flex-row justify-between items-center py-3 border-b border-border">
              <View className="flex-row items-center">
                <Bed size={18} color="#6B7280" />
                <Text className="text-textSecondary ml-3">Bedtime</Text>
              </View>
              <Text className="text-textPrimary font-medium">
                {lastNight.sleepStart ?  formatTime(lastNight.sleepStart) : '--'}
              </Text>
            </View>

            <View className="flex-row justify-between items-center py-3 border-b border-border">
              <View className="flex-row items-center">
                <Sun size={18} color="#6B7280" />
                <Text className="text-textSecondary ml-3">Wake time</Text>
              </View>
              <Text className="text-textPrimary font-medium">
                {lastNight.sleepEnd ? formatTime(lastNight. sleepEnd) : '--'}
              </Text>
            </View>

            {/* ✅ FIXED: totalSleepMinutes now displays correctly */}
            <View className="flex-row justify-between items-center py-3 border-b border-border">
              <View className="flex-row items-center">
                <Clock size={18} color="#6B7280" />
                <Text className="text-textSecondary ml-3">Total sleep</Text>
              </View>
              <Text className="text-textPrimary font-medium">
                {lastNight.totalSleepMinutes > 0 ? formatDuration(lastNight.totalSleepMinutes) : '--'}
              </Text>
            </View>

            {/* Sleep stages if available */}
            {lastNight. stages && Object.values(lastNight.stages).some(v => v > 0) ? (
              <View className="mt-4 pt-4 border-t border-border">
                <Text className="text-textMuted text-xs mb-3">SLEEP STAGES</Text>
                <View className="flex-row h-3 rounded-full overflow-hidden">
                  <View
                    style={{ flex: lastNight.stages.awake || 1, backgroundColor: '#FF4757' }}
                  />
                  <View
                    style={{ flex: lastNight.stages.light || 1, backgroundColor: '#3B82F6' }}
                  />
                  <View
                    style={{ flex: lastNight.stages.deep || 1, backgroundColor: '#00D1A7' }}
                  />
                  <View
                    style={{ flex: lastNight.stages.rem || 1, backgroundColor: '#8B5CF6' }}
                  />
                </View>
                <View className="flex-row justify-between mt-2">
                  <StageLabel color="#FF4757" label="Awake" value={lastNight.stages.awake} />
                  <StageLabel color="#3B82F6" label="Light" value={lastNight.stages.light} />
                  <StageLabel color="#00D1A7" label="Deep" value={lastNight.stages.deep} />
                  <StageLabel color="#8B5CF6" label="REM" value={lastNight.stages.rem} />
                </View>
              </View>
            ) : (
              <View className="mt-4 pt-4 border-t border-border">
                <Text className="text-textMuted text-xs text-center">
                  Sleep stages not available from Polar API
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Key Metrics */}
        <View className="flex-row mx-5 mt-4 space-x-3">
          {/* Sleep Score Card */}
          <View className="flex-1 bg-surface rounded-2xl p-4">
            <Text className="text-textMuted text-xs font-medium">SLEEP SCORE</Text>
            <Text className="text-textPrimary text-2xl font-bold mt-2">
              {sleepScore > 0 ? sleepScore : '--'}
            </Text>
            <Text className="text-textMuted text-xs mt-1">Quality rating</Text>
          </View>

          {/* Sleep Debt Quick View */}
          <View className="flex-1 bg-surface rounded-2xl p-4">
            <Text className="text-textMuted text-xs font-medium">SLEEP DEBT</Text>
            <Text className={`text-2xl font-bold mt-2 ${sleepDebt > 60 ? 'text-recovery-low' : sleepDebt > 30 ?  'text-warning' : 'text-recovery-high'}`}>
              {sleepDebt > 0 ? formatDuration(sleepDebt) : '0h'}
            </Text>
            <Text className="text-textMuted text-xs mt-1">7-day average</Text>
          </View>
        </View>

        {/* Detailed Sleep Debt Card */}
        <View className="mx-5 mt-4">
          <SleepDebtCard
            debtMinutes={sleepDebt}
            sleepGoalMinutes={sleepNeedMinutes}
          />
        </View>

        {/* Weekly Average */}
        <View className="mx-5 mt-4 bg-surface rounded-2xl p-4">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-textMuted text-xs font-medium">7-DAY AVERAGE</Text>
              <Text className="text-textPrimary text-xl font-bold mt-1">
                {weeklyAvg > 0 ? formatDuration(Math.round(weeklyAvg)) : '--'}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-textMuted text-xs">Goal</Text>
              <Text className="text-textSecondary text-sm">
                {userSettings?.sleepGoalHours ?? 8}h
              </Text>
            </View>
          </View>
          {/* Progress bar */}
          <View className="h-2 bg-surfaceLight rounded-full mt-3 overflow-hidden">
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (weeklyAvg / sleepNeedMinutes) * 100)}%` }}
            />
          </View>
        </View>

        {/* Sleep Duration Trend */}
        <View className="mx-5 mt-4 bg-surface rounded-2xl p-5">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-textPrimary text-lg font-semibold">Duration Trend</Text>
            <View className="flex-row bg-surfaceLight rounded-lg p-1">
              {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
                <Pressable
                  key={range}
                  onPress={() => setTimeRange(range)}
                  className={`px-3 py-1.5 rounded-md ${timeRange === range ? 'bg-primary' : ''}`}
                >
                  <Text className={`text-xs font-semibold ${timeRange === range ?  'text-background' : 'text-textMuted'}`}>
                    {range}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <TrendChart
            data={getTrendData(timeRange, 'duration')}
            color="#8B5CF6"
            height={120}
            showLabels
            unit="h"
            showBaseline
            baseline={userSettings?.sleepGoalHours ?? 8}
          />
        </View>

        {/* Recent Sleep Sessions */}
        {lastThreeSleeps.length > 0 && (
          <View className="mx-5 mt-6 mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-textPrimary text-lg font-semibold">Recent Sleep</Text>
              {lastThreeSleeps.length > 0 && (
                <Text className="text-textMuted text-xs">{lastThreeSleeps. length} nights</Text>
              )}
            </View>

            <View className="bg-surface rounded-2xl overflow-hidden">
              {lastThreeSleeps.map((sleep, index) => (
                <Pressable
                  key={sleep.id}
                  onPress={() => router.push(`/sleep/${sleep.id}`)}
                  className={`p-4 flex-row items-center justify-between ${
                    index !== lastThreeSleeps.length - 1 ? 'border-b border-border' : ''
                  } active:bg-surfaceLight`}
                >
                  {/* Left side:  Duration and date */}
                  <View className="flex-1">
                    <View className="flex-row items-baseline">
                      <Text className="text-textPrimary font-semibold">
                        {formatDuration(Math.round(sleep.totalSleepMinutes))}
                      </Text>
                      <Text className="text-textMuted text-sm ml-2">
                        {getDayOfWeek(sleep.date)}
                      </Text>
                    </View>
                    <View className="flex-row items-center mt-1">
                      <Moon size={12} color="#6B7280" />
                      <Text className="text-textMuted text-xs ml-2">
                        {sleep.sleepStart ? formatTime(sleep.sleepStart) : '--'} - {sleep.sleepEnd ? formatTime(sleep.sleepEnd) : '--'}
                      </Text>
                    </View>
                  </View>

                  {/* Right side: Sleep Score */}
                  <View className="items-end ml-4">
                    <View
                      className={`w-12 h-12 rounded-full items-center justify-center ${
                        sleep.sleep_score
                          ? sleep.sleep_score >= 80
                            ? 'bg-recovery-high/20'
                            : sleep. sleep_score >= 60
                            ? 'bg-warning/20'
                            : 'bg-recovery-low/20'
                          : 'bg-surfaceLight'
                      }`}
                    >
                      {sleep.sleep_score ?  (
                        <Text
                          className={`font-bold text-sm ${
                            sleep.sleep_score >= 80
                              ?  'text-recovery-high'
                              : sleep.sleep_score >= 60
                              ?  'text-warning'
                              : 'text-recovery-low'
                          }`}
                        >
                          {Math.round(sleep.sleep_score)}
                        </Text>
                      ) : (
                        <Text className="text-textMuted text-xs">--</Text>
                      )}
                    </View>
                    <Text className="text-textMuted text-xs mt-1">score</Text>
                  </View>

                  <ChevronRight size={16} color="#6B7280" className="ml-3" />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

function StageLabel({ color, label, value }: { color: string; label:  string; value: number }) {
  return (
    <View className="items-center">
      <View className="flex-row items-center">
        <View className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: color }} />
        <Text className="text-textMuted text-xs">{label}</Text>
      </View>
      <Text className="text-textSecondary text-xs mt-0.5">{Math.round(value)}m</Text>
    </View>
  );
}