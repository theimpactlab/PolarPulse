import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Moon, Clock, Bed, Sun, ChevronRight } from 'lucide-react-native';
import { useAppStore, type SleepSession, type DailyMetrics, type UserSettings } from '@/lib/state/app-store';
import { TrendChart } from '@/components/TrendChart';
import { ScoreRing } from '@/components/ScoreRing';
import { SleepDebtCard } from '@/components/SleepDebtCard';
import { formatTime, formatDuration, formatDate, getDayOfWeek } from '@/lib/utils/format';
import { getSleepStatus, getSleepColor } from '@/lib/utils/scoring';
import Animated, { FadeInDown } from 'react-native-reanimated';

type TimeRange = '7d' | '30d' | '90d';

export default function SleepScreen() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const sleepSessions = useAppStore((s): SleepSession[] => s. sleepSessions);
  const dailyMetrics = useAppStore((s): DailyMetrics[] => s.dailyMetrics);
  const userSettings = useAppStore((s): UserSettings => s.userSettings);

  // Get last night's sleep
  const today = new Date().toISOString().split('T')[0];
  const lastNight = sleepSessions
    .filter((s: SleepSession) => s.date <= today)
    .sort((a:  SleepSession, b: SleepSession) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  const todayMetrics = dailyMetrics.find((m: DailyMetrics) => m.date === today);
  const sleepScore = todayMetrics?.sleepScore ??  (lastNight?.sleep_score ?  Math.round(lastNight.sleep_score) : 0);

  // Sleep need (default 8 hours)
  const sleepNeedMinutes = (userSettings?.sleepGoalHours ??  8) * 60;
  const actualSleepMinutes = lastNight?.totalSleepMinutes ?? 0;
  const sleepDebt = Math.max(0, sleepNeedMinutes - actualSleepMinutes);

  // Get trend data
  const getTrendData = (range: TimeRange, metric: 'duration' | 'score' | 'consistency') => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
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
        value = metrics?.sleepScore || 0;
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
    const totalMinutes = thisWeek.reduce((sum: number, s: SleepSession) => sum + s.totalSleepMinutes, 0);
    return totalMinutes / thisWeek.length;
  }, [sleepSessions]);

  // Get last 3 sleep sessions
  const lastThreeSleeps = sleepSessions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown} className="px-5 pt-4 pb-2">
          <Text className="text-textMuted text-sm">Recovery</Text>
          <Text className="text-3xl font-bold text-textPrimary mt-1">Sleep</Text>
        </Animated.View>

        {/* Last Night Card */}
        {lastNight ?  (
          <Animated.View entering={FadeInDown. delay(100)} className="mx-5 mt-4">
            <Pressable className="bg-surface rounded-2xl p-5 active:opacity-90">
              <View className="flex-row justify-between items-start mb-4">
                <View>
                  <Text className="text-textMuted text-xs font-semibold mb-1">LAST NIGHT</Text>
                  <View className="flex-row items-baseline">
                    <Text className="text-4xl font-bold text-textPrimary">
                      {Math.floor(actualSleepMinutes / 60)}
                    </Text>
                    <Text className="text-textMuted text-lg ml-1">h</Text>
                    <Text className="text-2xl font-bold text-textPrimary ml-2">
                      {actualSleepMinutes % 60}
                    </Text>
                    <Text className="text-textMuted text-sm ml-1">m</Text>
                  </View>
                </View>
                <ScoreRing score={sleepScore} size={60} />
              </View>

              {/* Sleep time details */}
              <View className="border-t border-border pt-3 mt-3">
                <View className="flex-row items-center">
                  <Bed size={14} color="#6B7280" />
                  <Text className="text-textMuted text-xs ml-2">
                    {lastNight.sleepStart ?  formatTime(lastNight.sleepStart) : '--'} - {lastNight.sleepEnd ? formatTime(lastNight.sleepEnd) : '--'}
                  </Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Sleep Stages */}
        {lastNight && (
          <Animated.View entering={FadeInDown.delay(150)} className="mx-5 mt-4">
            <View className="bg-surface rounded-2xl p-5">
              <Text className="text-textPrimary font-semibold text-lg mb-4">Sleep Stages</Text>

              {lastNight.stages && Object.values(lastNight.stages).some(v => v > 0) ? (
                <View className="space-y-3">
                  {[
                    { label: 'Deep', value: lastNight.stages.deep, color: '#6366F1', icon: '◆' },
                    { label:  'Light', value: lastNight.stages.light, color: '#60A5FA', icon: '◐' },
                    { label:  'REM', value: lastNight. stages.rem, color: '#00D1A7', icon: '◉' },
                    { label: 'Awake', value: lastNight.stages.awake, color: '#EF4444', icon:  '○' },
                  ].map((stage) => {
                    const percent = actualSleepMinutes > 0 ? (stage.value / actualSleepMinutes) * 100 : 0;
                    return (
                      <View key={stage. label}>
                        <View className="flex-row items-center justify-between mb-2">
                          <View className="flex-row items-center">
                            <Text style={{ color: stage.color }} className="text-lg mr-2">{stage.icon}</Text>
                            <Text className="text-textPrimary text-sm font-medium">{stage.label}</Text>
                          </View>
                          <Text className="text-textMuted text-xs">
                            {Math.round(stage.value)}m ({Math.round(percent)}%)
                          </Text>
                        </View>
                        <View className="h-2 bg-surfaceLight rounded-full overflow-hidden">
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${percent}%`,
                              backgroundColor: stage.color,
                            }}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View className="h-20 items-center justify-center">
                  <Text className="text-textMuted text-xs text-center">
                    Sleep stages not available from Polar API
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Key Metrics */}
        <View className="flex-row mx-5 mt-4 space-x-3">
          {/* Sleep Score */}
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
            <Text
              className={`text-2xl font-bold mt-2 ${
                sleepDebt > 60
                  ? 'text-recovery-low'
                  : sleepDebt > 30
                  ?  'text-warning'
                  : 'text-recovery-high'
              }`}
            >
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
              {(['7d', '30d', '90d'] as const).map((range) => (
                <Pressable
                  key={range}
                  onPress={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded ${timeRange === range ? 'bg-primary' : ''}`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      timeRange === range ? 'text-background' : 'text-textMuted'
                    }`}
                  >
                    {range === '7d' ? '1w' : range === '30d' ? '1m' : '3m'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <TrendChart
            data={getTrendData(timeRange, 'duration')}
            height={200}
            color="#8B5CF6"
            goalLine={sleepNeedMinutes / 60}
          />
        </View>

        {/* Recent Sleep Sessions */}
        {lastThreeSleeps.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200)} className="mx-5 mt-6 mb-6">
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
                  className={`p-4 flex-row items-center justify-between ${
                    index !== lastThreeSleeps.length - 1 ? 'border-b border-border' : ''
                  } active:bg-surfaceLight`}
                >
                  {/* Left side:  Date and time */}
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
                            : sleep.sleep_score >= 60
                            ? 'bg-warning/20'
                            : 'bg-recovery-low/20'
                          :  'bg-surfaceLight'
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
          </Animated. View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}