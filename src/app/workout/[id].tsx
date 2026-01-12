import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ChevronLeft,
  Activity,
  Clock,
  Flame,
  Heart,
  TrendingUp,
  Zap,
  Calendar,
} from 'lucide-react-native';
import { useAppStore, type Workout, type HRZone } from '@/lib/state/app-store';
import { formatDuration, formatDate, getDayOfWeek } from '@/lib/utils/format';
import Animated, { FadeInDown } from 'react-native-reanimated';

const ZONE_NAMES = ['Recovery', 'Fat Burn', 'Cardio', 'Hard', 'Peak'];
const ZONE_COLORS = ['#3B82F6', '#00D1A7', '#F5A623', '#FF6B35', '#FF4757'];
const ZONE_HR_RANGES = ['50-60%', '60-70%', '70-80%', '80-90%', '90-100%'];

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const workouts = useAppStore((s) => s.workouts);

  const workout = workouts.find((w: Workout) => w.id === id);

  if (!workout) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-textMuted">Workout not found</Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 px-6 py-3 bg-primary rounded-xl"
        >
          <Text className="text-background font-semibold">Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const totalZoneMinutes = workout.hrZones?.reduce((sum, z) => sum + z.minutes, 0) || 0;

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

            <Animated.View entering={FadeInDown.delay(100)}>
              <View className="flex-row items-center">
                <View className="w-14 h-14 rounded-2xl bg-accent/20 items-center justify-center mr-4">
                  <Activity size={28} color="#8B5CF6" />
                </View>
                <View className="flex-1">
                  <Text className="text-3xl font-bold text-textPrimary">
                    {workout.type}
                  </Text>
                  <View className="flex-row items-center mt-1">
                    <Calendar size={14} color="#6B7280" />
                    <Text className="text-textMuted ml-1">
                      {getDayOfWeek(workout.date)} • {formatDate(workout.date)}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          </View>

          {/* Strain Score Card */}
          {workout.strainScore !== undefined && (
            <Animated.View
              entering={FadeInDown.delay(150)}
              className="mx-5 mb-4 bg-accent/10 border border-accent/30 rounded-2xl p-5"
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-textMuted text-sm">Strain Score</Text>
                  <Text className="text-accent text-4xl font-bold mt-1">
                    {workout.strainScore.toFixed(1)}
                  </Text>
                  <Text className="text-textMuted text-sm mt-1">out of 21</Text>
                </View>
                <View className="w-20 h-20 rounded-full border-4 border-accent items-center justify-center">
                  <Zap size={32} color="#8B5CF6" />
                </View>
              </View>
            </Animated.View>
          )}

          {/* Stats Grid */}
          <Animated.View
            entering={FadeInDown.delay(200)}
            className="mx-5 mb-4"
          >
            <View className="flex-row gap-3">
              {/* Duration */}
              <View className="flex-1 bg-surface rounded-2xl p-4">
                <View className="flex-row items-center mb-2">
                  <Clock size={16} color="#00D1A7" />
                  <Text className="text-textMuted text-xs ml-1">Duration</Text>
                </View>
                <Text className="text-textPrimary text-xl font-bold">
                  {formatDuration(workout.durationMinutes)}
                </Text>
              </View>

              {/* Calories */}
              <View className="flex-1 bg-surface rounded-2xl p-4">
                <View className="flex-row items-center mb-2">
                  <Flame size={16} color="#FF6B35" />
                  <Text className="text-textMuted text-xs ml-1">Calories</Text>
                </View>
                <Text className="text-textPrimary text-xl font-bold">
                  {workout.calories.toLocaleString()}
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3 mt-3">
              {/* Avg HR */}
              <View className="flex-1 bg-surface rounded-2xl p-4">
                <View className="flex-row items-center mb-2">
                  <Heart size={16} color="#FF4757" />
                  <Text className="text-textMuted text-xs ml-1">Avg HR</Text>
                </View>
                <Text className="text-textPrimary text-xl font-bold">
                  {workout.avgHR} <Text className="text-sm font-normal text-textMuted">bpm</Text>
                </Text>
              </View>

              {/* Max HR */}
              <View className="flex-1 bg-surface rounded-2xl p-4">
                <View className="flex-row items-center mb-2">
                  <TrendingUp size={16} color="#FF4757" />
                  <Text className="text-textMuted text-xs ml-1">Max HR</Text>
                </View>
                <Text className="text-textPrimary text-xl font-bold">
                  {workout.maxHR} <Text className="text-sm font-normal text-textMuted">bpm</Text>
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Heart Rate Zones */}
          {workout.hrZones && workout.hrZones.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(250)}
              className="mx-5 mb-4 bg-surface rounded-2xl p-5"
            >
              <Text className="text-textPrimary font-semibold text-lg mb-4">
                Heart Rate Zones
              </Text>

              {/* Zone Bar */}
              <View className="flex-row h-6 rounded-full overflow-hidden mb-6">
                {workout.hrZones.map((zone: HRZone, index: number) => (
                  <View
                    key={index}
                    style={{
                      flex: zone.minutes,
                      backgroundColor: ZONE_COLORS[zone.zone - 1] || '#6B7280',
                    }}
                  />
                ))}
              </View>

              {/* Zone Details */}
              {workout.hrZones.map((zone: HRZone, index: number) => {
                const percentage = totalZoneMinutes > 0
                  ? Math.round((zone.minutes / totalZoneMinutes) * 100)
                  : 0;

                return (
                  <View
                    key={index}
                    className="flex-row items-center py-3 border-b border-border last:border-b-0"
                  >
                    <View
                      className="w-3 h-3 rounded-full mr-3"
                      style={{ backgroundColor: ZONE_COLORS[zone.zone - 1] }}
                    />
                    <View className="flex-1">
                      <Text className="text-textPrimary font-medium">
                        Zone {zone.zone}: {ZONE_NAMES[zone.zone - 1]}
                      </Text>
                      <Text className="text-textMuted text-sm">
                        {ZONE_HR_RANGES[zone.zone - 1]} max HR
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-textPrimary font-semibold">
                        {Math.floor(zone.minutes)}:{String(Math.round((zone.minutes % 1) * 60)).padStart(2, '0')}
                      </Text>
                      <Text className="text-textMuted text-sm">{percentage}%</Text>
                    </View>
                  </View>
                );
              })}
            </Animated.View>
          )}

          {/* Source Badge */}
          <Animated.View
            entering={FadeInDown.delay(300)}
            className="mx-5 mb-8"
          >
            <View className="bg-surface rounded-2xl p-4 flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-surfaceLight items-center justify-center mr-3">
                {workout.source === 'polar' ? (
                  <Text className="text-primary font-bold text-sm">P</Text>
                ) : workout.source === 'apple_health' ? (
                  <Heart size={18} color="#FF3B30" />
                ) : (
                  <Activity size={18} color="#6B7280" />
                )}
              </View>
              <View>
                <Text className="text-textPrimary font-medium">
                  {workout.source === 'polar'
                    ? 'Polar Flow'
                    : workout.source === 'apple_health'
                      ? 'Apple Health'
                      : workout.source === 'demo'
                        ? 'Demo Data'
                        : 'Manual Entry'}
                </Text>
                <Text className="text-textMuted text-sm">Data source</Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
