import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Moon, Clock, Bed, Zap, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAppStore, type SleepSession, type DailyMetrics, type UserSettings } from '@/lib/state/app-store';
import { TrendChart } from '@/components/TrendChart';
import { ScoreRing } from '@/components/ScoreRing';
import { SleepDebtCard } from '@/components/SleepDebtCard';
import { formatTime, formatDuration, formatDate } from '@/lib/utils/format';

type TimeRange = '7d' | '30d' | '90d';

export default function SleepScreen() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const sleepSessions = useAppStore((s) => s.sleepSessions);
  const userSettings = useAppStore((s) => s.userSettings);

  // Get last night's sleep
  const today = new Date().toISOString().split('T')[0];
  const lastNight = sleepSessions
    .filter((s) => s.date <= today)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  const sleepNeedMinutes = (userSettings?.sleepGoalHours ?? 8) * 60;
  const actualSleepMinutes = lastNight?.totalSleepMinutes ?? 0;
  const sleepDebt = Math.max(0, sleepNeedMinutes - actualSleepMinutes);
  const sleepScore = lastNight ?  Math.round((actualSleepMinutes / sleepNeedMinutes) * 100) : 0;

  // Calculate metrics
  const getTrendData = (range: TimeRange) => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const now = new Date();
    return Array.from({ length: days }, (_, i) => {
      const date = new Date(now.getTime() - (days - 1 - i) * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const session = sleepSessions.find((s) => s.date === dateStr);
      return {
        date: dateStr,
        value: session ?  session.totalSleepMinutes / 60 : 0,
      };
    });
  };

  const trendData = getTrendData(timeRange);

  // Calculate averages
  const getDays = () => timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
  const avgSleep = sleepSessions
    .slice(-getDays())
    .reduce((sum, s) => sum + s.totalSleepMinutes, 0) / Math.max(1, Math.min(getDays(), sleepSessions.length));

  const avgScore = lastNight ? Math.round((avgSleep / sleepNeedMinutes) * 100) : 0;

  // Sleep pattern analysis
  const getPattern = () => {
    if (avgSleep >= sleepNeedMinutes) return { text: 'Good', color: '#00D1A7', icon: '✓' };
    if (avgSleep >= sleepNeedMinutes * 0.85) return { text: 'Fair', color: '#FFC107', icon: '◐' };
    return { text:  'Poor', color: '#FF4757', icon: '✗' };
  };

  const pattern = getPattern();

  const sleepStages = lastNight?.stages || { deep: 0, light: 0, rem: 0, awake: 0 };
  const totalStages = Object.values(sleepStages).reduce((a, b) => a + b, 0);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeInDown} className="px-5 pt-4 pb-2">
          <Text className="text-textMuted text-sm">Tonight</Text>
          <Text className="text-3xl font-bold text-textPrimary mt-1">Sleep</Text>
        </Animated.View>

        {/* Last Night Card */}
        {lastNight ?  (
          <Animated.View entering={FadeInDown. delay(100)} className="mx-5 mt-4">
            <View className="bg-surface rounded-2xl p-5">
              {/* Main Sleep Duration */}
              <View className="flex-row items-end justify-between mb-4">
                <View>
                  <Text className="text-textMuted text-xs font-medium mb-2">LAST NIGHT</Text>
                  <View className="flex-row items-baseline">
                    <Text className="text-4xl font-bold text-textPrimary">
                      {Math.floor(actualSleepMinutes / 60)}
                    </Text>
                    <Text className="text-textSecondary text-xl ml-1">h</Text>
                    <Text className="text-2xl font-bold text-textPrimary ml-2">
                      {actualSleepMinutes % 60}
                    </Text>
                    <Text className="text-textSecondary text-lg ml-1">m</Text>
                  </View>
                </View>
                <View className="items-end">
                  <View className="w-16 h-16 rounded-full bg-primary/20 items-center justify-center">
                    <Text className="text-2xl font-bold text-primary">{sleepScore}%</Text>
                  </View>
                  <Text className="text-textMuted text-xs mt-2">of goal</Text>
                </View>
              </View>

              {/* Time range */}
              <View className="border-t border-border pt-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <Moon size={14} color="#6B7280" />
                    <Text className="text-textMuted text-xs ml-2">
                      {formatTime(lastNight.sleepStart || '')} - {formatTime(lastNight.sleepEnd || '')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(100)} className="mx-5 mt-4">
            <View className="bg-surface rounded-2xl p-5 items-center justify-center py-8">
              <Moon size={32} color="#6B7280" />
              <Text className="text-textMuted text-sm mt-3">No sleep data yet</Text>
            </View>
          </Animated.View>
        )}

        {/* Sleep Stages */}
        {lastNight && totalStages > 0 && (
          <Animated.View entering={FadeInDown.delay(150)} className="mx-5 mt-4">
            <View className="bg-surface rounded-2xl p-5">
              <Text className="text-textPrimary font-semibold mb-4">Sleep Stages</Text>

              {/* Stage breakdown */}
              <View className="space-y-3">
                {[
                  { label: 'Deep Sleep', value: sleepStages.deep, color: '#5B4E9E', icon: '◆' },
                  { label:  'REM Sleep', value: sleepStages.rem, color: '#00D1A7', icon: '◉' },
                  { label:  'Light Sleep', value: sleepStages.light, color: '#60A5FA', icon: '◐' },
                  { label:  'Awake', value:  sleepStages.awake, color: '#EF4444', icon: '○' },
                ].map((stage) => (
                  <View key={stage.label}>
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center">
                        <Text style={{ color: stage.color }} className="text-lg mr-2">{stage.icon}</Text>
                        <Text className="text-textPrimary text-sm font-medium">{stage.label}</Text>
                      </View>
                      <Text className="text-textSecondary font-semibold">
                        {Math.round(stage.value / 60)}m
                      </Text>
                    </View>
                    <View className="h-2 bg-surfaceLight rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${(stage.value / actualSleepMinutes) * 100}%`,
                          backgroundColor: stage.color,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>

              {/* Sleep quality indicator */}
              <View className="mt-4 pt-4 border-t border-border">
                <View className="flex-row items-center">
                  <View
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: pattern.color }}
                  />
                  <Text className="text-textPrimary text-sm">
                    Sleep Quality: <Text className="font-semibold" style={{ color: pattern.color }}>{pattern.text}</Text>
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Sleep Debt Card */}
        <Animated. View entering={FadeInDown. delay(200)} className="mx-5 mt-4">
          <SleepDebtCard
            debtMinutes={sleepDebt}
            sleepGoalMinutes={sleepNeedMinutes}
          />
        </Animated.View>

        {/* Insights */}
        {lastNight && sleepScore < 80 && (
          <Animated.View entering={FadeInDown.delay(250)} className="mx-5 mt-4">
            <View className="bg-recovery-low/10 border border-recovery-low/30 rounded-2xl p-4 flex-row">
              <View className="w-10 h-10 rounded-full bg-recovery-low/20 items-center justify-center mr-3">
                <AlertCircle size={18} color="#FF4757" />
              </View>
              <View className="flex-1">
                <Text className="text-recovery-low font-semibold text-sm">Sleep Below Goal</Text>
                <Text className="text-textMuted text-xs mt-1">
                  You got {Math.round((sleepScore - 100) * -1)}% less sleep than recommended.  Prioritize rest today.
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Trend Chart */}
        <Animated.View entering={FadeInDown.delay(300)} className="mx-5 mt-4">
          <View className="bg-surface rounded-2xl p-5">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-textPrimary font-semibold">Sleep Trend</Text>
              <View className="flex-row bg-surfaceLight rounded-lg p-1">
                {(['7d', '30d', '90d'] as const).map((range) => (
                  <Pressable
                    key={range}
                    onPress={() => setTimeRange(range)}
                    className={`px-3 py-1 rounded ${timeRange === range ? 'bg-primary' : ''}`}
                  >
                    <Text className={`text-xs font-medium ${timeRange === range ?  'text-background' : 'text-textMuted'}`}>
                      {range === '7d' ? '1w' : range === '30d' ? '1m' : '3m'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {trendData.some((d) => d.value > 0) ? (
              <>
                <TrendChart data={trendData} height={200} goalLine={sleepNeedMinutes / 60} color="#00D1A7" />
                <View className="mt-4 pt-4 border-t border-border">
                  <View className="flex-row justify-between">
                    <View>
                      <Text className="text-textMuted text-xs">Average</Text>
                      <Text className="text-textPrimary font-bold mt-1">
                        {formatDuration(Math.round(avgSleep))}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-textMuted text-xs">Goal</Text>
                      <Text className="text-textPrimary font-bold mt-1">
                        {formatDuration(sleepNeedMinutes)}
                      </Text>
                    </View>
                    <View items-end>
                      <Text className="text-textMuted text-xs">Target %</Text>
                      <Text className={`font-bold mt-1 ${avgScore >= 100 ? 'text-recovery-high' : avgScore >= 85 ? 'text-warning' : 'text-recovery-low'}`}>
                        {avgScore}%
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View className="h-32 items-center justify-center">
                <Text className="text-textMuted text-sm">No data available for this period</Text>
              </View>
            )}
          </View>
        </Animated. View>

        {/* Sleep Tips */}
        <Animated. View entering={FadeInDown. delay(350)} className="mx-5 mt-4 mb-6">
          <View className="bg-surface rounded-2xl p-5">
            <Text className="text-textPrimary font-semibold mb-3">Sleep Tips</Text>
            <View className="space-y-2">
              {[
                { icon: '🌙', text: 'Maintain consistent bedtime and wake time' },
                { icon: '📵', text: 'Avoid screens 1 hour before bed' },
                { icon: '🌡️', text: 'Keep bedroom cool (around 65-68°F)' },
                { icon: '☕', text: 'Limit caffeine after 2 PM' },
              ].map((tip, i) => (
                <View key={i} className="flex-row items-center">
                  <Text className="text-lg mr-3">{tip.icon}</Text>
                  <Text className="text-textSecondary text-sm flex-1">{tip.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}