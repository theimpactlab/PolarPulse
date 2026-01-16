import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ChevronLeft,
  Moon,
  Clock,
  Sun,
  Bed,
  Calendar,
} from 'lucide-react-native';
import { useAppStore, type SleepSession } from '@/lib/state/app-store';
import { formatDuration, formatDate, getDayOfWeek, formatTime } from '@/lib/utils/format';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function SleepDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const sleepSessions = useAppStore((s) => s.sleepSessions);

  const sleep = sleepSessions. find((s:  SleepSession) => s.id === id);

  if (!sleep) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-textMuted">Sleep data not found</Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 px-6 py-3 bg-primary rounded-xl"
        >
          <Text className="text-background font-semibold">Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const totalStages = Object.values(sleep.stages || {}).reduce((a, b) => a + b, 0);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="px-5 pt-2 pb-4">
            <Pressable
              onPress={() => router.back()}
              className="flex-row items-center mb-4"
            >
              <ChevronLeft size={24} color="#9CA3AF" />
              <Text className="text-textSecondary ml-1">Back</Text>
            </Pressable>

            <Animated.View entering={FadeInDown. delay(100)}>
              <View className="flex-row items-center">
                <View className="w-14 h-14 rounded-2xl bg-primary/20 items-center justify-center mr-4">
                  <Moon size={28} color="#00D1A7" />
                </View>
                <View className="flex-1">
                  <Text className="text-3xl font-bold text-textPrimary">
                    Sleep
                  </Text>
                  <View className="flex-row items-center mt-1">
                    <Calendar size={14} color="#6B7280" />
                    <Text className="text-textMuted ml-1">
                      {getDayOfWeek(sleep.date)} • {formatDate(sleep.date)}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          </View>

          {/* Main Metrics */}
          <Animated.View entering={FadeInDown.delay(150)} className="mx-5 mt-4 bg-surface rounded-2xl p-5">
            <View className="space-y-4">
              {/* Duration */}
              <View className="flex-row items-center justify-between py-3 border-b border-border">
                <View className="flex-row items-center">
                  <Moon size={18} color="#00D1A7" />
                  <Text className="text-textSecondary ml-3">Total Sleep</Text>
                </View>
                <Text className="text-textPrimary font-bold text-lg">
                  {formatDuration(sleep.totalSleepMinutes)}
                </Text>
              </View>

              {/* Bedtime */}
              <View className="flex-row items-center justify-between py-3 border-b border-border">
                <View className="flex-row items-center">
                  <Bed size={18} color="#6B7280" />
                  <Text className="text-textSecondary ml-3">Bedtime</Text>
                </View>
                <Text className="text-textPrimary font-medium">
                  {sleep.sleepStart ? formatTime(sleep.sleepStart) : '--'}
                </Text>
              </View>

              {/* Wake Time */}
              <View className="flex-row items-center justify-between py-3 border-b border-border">
                <View className="flex-row items-center">
                  <Sun size={18} color="#6B7280" />
                  <Text className="text-textSecondary ml-3">Wake Time</Text>
                </View>
                <Text className="text-textPrimary font-medium">
                  {sleep.sleepEnd ? formatTime(sleep.sleepEnd) : '--'}
                </Text>
              </View>

              {/* Sleep Score */}
              <View className="flex-row items-center justify-between py-3">
                <View className="flex-row items-center">
                  <View
                    className="w-5 h-5 rounded-full"
                    style={{
                      backgroundColor: 
                        sleep.sleep_score && sleep.sleep_score >= 80
                          ? '#00D1A7'
                          : sleep.sleep_score && sleep.sleep_score >= 60
                          ? '#FFC107'
                          : '#FF4757',
                    }}
                  />
                  <Text className="text-textSecondary ml-3">Sleep Score</Text>
                </View>
                <Text className="text-textPrimary font-bold text-lg">
                  {sleep.sleep_score ? Math.round(sleep.sleep_score) : '--'}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Sleep Stages Breakdown */}
          {sleep.stages && totalStages > 0 && (
            <Animated.View entering={FadeInDown.delay(200)} className="mx-5 mt-4 bg-surface rounded-2xl p-5">
              <Text className="text-textPrimary font-semibold mb-4">Sleep Stages</Text>

              {/* Visual bar */}
              <View className="flex-row h-4 rounded-full overflow-hidden mb-4">
                {[
                  { value: sleep.stages.deep, color: '#00D1A7' },
                  { value: sleep.stages.rem, color: '#8B5CF6' },
                  { value: sleep.stages. light, color: '#60A5FA' },
                  { value: sleep.stages.awake, color: '#EF4444' },
                ].map((stage, i) => (
                  <View
                    key={i}
                    style={{
                      flex: stage.value,
                      backgroundColor: stage.color,
                    }}
                  />
                ))}
              </View>

              {/* Stage details */}
              <View className="space-y-3">
                {[
                  { label: 'Deep Sleep', value: sleep.stages.deep, color: '#00D1A7', icon: '◆' },
                  { label:  'REM Sleep', value: sleep.stages.rem, color: '#8B5CF6', icon: '◉' },
                  { label:   'Light Sleep', value: sleep. stages.light, color: '#60A5FA', icon: '◐' },
                  { label:  'Awake', value:  sleep.stages.awake, color: '#EF4444', icon: '○' },
                ].map((stage) => {
                  const percent = totalStages > 0 ? (stage.value / totalStages) * 100 : 0;
                  return (
                    <View key={stage.label}>
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center">
                          <Text style={{ color: stage.color }} className="text-lg mr-2">{stage.icon}</Text>
                          <Text className="text-textPrimary text-sm font-medium">{stage.label}</Text>
                        </View>
                        <Text className="text-textSecondary text-sm">
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
            </Animated. View>
          )}

          {/* Raw Data */}
          {sleep.raw_data && (
            <Animated.View entering={FadeInDown.delay(250)} className="mx-5 mt-4 bg-surface rounded-2xl p-5 mb-6">
              <Text className="text-textPrimary font-semibold mb-3">Additional Metrics</Text>

              <View className="space-y-3">
                {sleep.raw_data.continuity && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-textSecondary text-sm">Sleep Continuity</Text>
                    <Text className="text-textPrimary font-medium">{sleep.raw_data. continuity}</Text>
                  </View>
                )}
                {sleep.raw_data. sleep_cycles && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-textSecondary text-sm">Sleep Cycles</Text>
                    <Text className="text-textPrimary font-medium">{sleep. raw_data.sleep_cycles}</Text>
                  </View>
                )}
                {sleep. raw_data.sleep_rating && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-textSecondary text-sm">Sleep Rating</Text>
                    <Text className="text-textPrimary font-medium">{sleep.raw_data.sleep_rating}/5</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}