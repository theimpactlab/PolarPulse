import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Activity, Flame, Clock, Heart, ChevronRight, AlertCircle } from 'lucide-react-native';
import { useAppStore, type Workout, type DailyMetrics, type TrainingLoadHistory } from '@/lib/state/app-store';
import { useExercises, useCardioLoad } from '@/lib/hooks/usePolarData';
import { formatDuration, formatDate, getDayOfWeek } from '@/lib/utils/format';
import { TrendChart } from '@/components/TrendChart';
import { TrainingLoadCard } from '@/components/TrainingLoadCard';
import { VO2MaxCard } from '@/components/VO2MaxCard';
import { useRouter } from 'expo-router';

type TimeRange = '7d' | '30d' | '90d';

export default function FitnessScreen() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const workouts = useAppStore((s): Workout[] => s.workouts);
  const dailyMetrics = useAppStore((s): DailyMetrics[] => s.dailyMetrics);
  const trainingLoadHistory = useAppStore((s): TrainingLoadHistory[] => s.trainingLoadHistory);
  const isPolarConnected = useAppStore((s) => s.isPolarConnected);

  // Fetch real Polar data
  const exercises = useExercises();
  const cardioLoadData = useCardioLoad();

  // Use Polar data if available, fallback to store
  const allWorkouts = isPolarConnected && exercises.data ?  exercises.data : workouts;
  const todayCardioLoad = cardioLoadData.data;

  const today = new Date().toISOString().split('T')[0];
  const todayMetrics = dailyMetrics. find((m:  DailyMetrics) => m.date === today);
  const todayLoadHistory = trainingLoadHistory.find((t) => t.date === today);

  // Show all workouts sorted by date
  const recentWorkouts = useMemo(
    () => [...allWorkouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [allWorkouts]
  );

  // Calculate weekly stats
  const weeklyStats = React.useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now. getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = recentWorkouts.filter((w:  Workout) => new Date(w.date) >= weekAgo);

    return {
      totalMinutes: thisWeek.reduce((sum:  number, w: Workout) => sum + (w. durationMinutes || 0), 0),
      totalCalories: thisWeek.reduce((sum: number, w: Workout) => sum + (w.calories || 0), 0),
      sessionCount: thisWeek.length,
      avgStrain: thisWeek.length > 0
        ? thisWeek.reduce((sum: number, w: Workout) => sum + (w.strainScore || 0), 0) / thisWeek.length
        : 0,
    };
  }, [recentWorkouts]);

  // Get trend data based on time range
  const getTrendData = (range: TimeRange) => {
    const days = range === '7d' ?  7 : range === '30d' ? 30 : 90;
    const now = new Date();
    return Array.from({ length: days }, (_, i) => {
      const date = new Date(now.getTime() - (days - 1 - i) * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const metrics = dailyMetrics.find((m:  DailyMetrics) => m.date === dateStr);

      // Calculate strain from workouts for this date if metrics don't have it
      let strainValue = metrics?.strainScore || 0;
      if (!strainValue) {
        const dayWorkouts = recentWorkouts.filter((w: Workout) => w.date === dateStr);
        strainValue = dayWorkouts.reduce((sum, w) => sum + (w.strainScore || 0), 0);
      }

      return {
        date:  dateStr,
        value: strainValue,
      };
    });
  };

  const isLoading = isPolarConnected && exercises.loading;
  const hasError = exercises.error || cardioLoadData. error;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 pt-4 pb-2">
          <Text className="text-3xl font-bold text-textPrimary">Fitness</Text>
          <Text className="text-textSecondary mt-1">Training load & activity</Text>
          {isPolarConnected && (
            <View className="bg-primary/20 px-2 py-1 rounded-full mt-2 self-start">
              <Text className="text-primary text-xs font-medium">Live Data</Text>
            </View>
          )}
        </View>

        {/* Error states */}
        {hasError && (
          <View className="mx-5 mt-4 bg-red-500/20 rounded-2xl p-4 flex-row items-center">
            <AlertCircle size={16} color="#FF4757" />
            <Text className="text-red-500 text-sm ml-2 flex-1">{exercises.error || cardioLoadData.error}</Text>
          </View>
        )}

        {/* Loading state */}
        {isLoading && (
          <View className="mx-5 mt-6 items-center py-8">
            <ActivityIndicator size="large" color="#00D1A7" />
            <Text className="text-textSecondary mt-2">Loading fitness data...</Text>
          </View>
        )}

        {! isLoading && (
          <>
            {/* Weekly Summary Card */}
            <View className="mx-5 mt-4 bg-surface rounded-2xl p-5">
              <Text className="text-textSecondary text-sm font-medium mb-4">THIS WEEK</Text>
              <View className="flex-row justify-between">
                <View className="items-center flex-1">
                  <View className="flex-row items-center mb-1">
                    <Clock size={16} color="#9CA3AF" />
                    <Text className="text-textMuted text-xs ml-1">Time</Text>
                  </View>
                  <Text className="text-textPrimary text-xl font-bold">
                    {weeklyStats.totalMinutes > 0
                      ? `${Math.floor(weeklyStats.totalMinutes / 60)}h ${weeklyStats.totalMinutes % 60}m`
                      : '0h 0m'}
                  </Text>
                </View>
                <View className="w-px bg-border" />
                <View className="items-center flex-1">
                  <View className="flex-row items-center mb-1">
                    <Flame size={16} color="#9CA3AF" />
                    <Text className="text-textMuted text-xs ml-1">Calories</Text>
                  </View>
                  <Text className="text-textPrimary text-xl font-bold">
                    {weeklyStats.totalCalories. toLocaleString()}
                  </Text>
                </View>
                <View className="w-px bg-border" />
                <View className="items-center flex-1">
                  <View className="flex-row items-center mb-1">
                    <Activity size={16} color="#9CA3AF" />
                    <Text className="text-textMuted text-xs ml-1">Sessions</Text>
                  </View>
                  <Text className="text-textPrimary text-xl font-bold">{weeklyStats.sessionCount}</Text>
                </View>
              </View>
            </View>

            {/* Training Load & VO2 Max Cards */}
            {(todayLoadHistory || todayCardioLoad) && (
              <View className="mx-5 mt-4 space-y-3">
                {/* Training Load Card */}
                <TrainingLoadCard
                  acuteLoad={todayLoadHistory?.acuteLoad ?? todayCardioLoad?.acute_load ??  0}
                  chronicLoad={todayLoadHistory?.chronicLoad ?? todayCardioLoad?. chronic_load ?? 0}
                  status={todayLoadHistory?.status ??  todayCardioLoad?.status ??  'maintaining'}
                  history={trainingLoadHistory}
                />

                {/* VO2 Max Card */}
                <VO2MaxCard value={todayMetrics?.vo2Max ?? 0} />
              </View>
            )}

            {/* Strain Trend */}
            {getTrendData(timeRange).some((d) => d.value > 0) && (
              <View className="mx-5 mt-4 bg-surface rounded-2xl p-5">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-textPrimary text-lg font-semibold">Strain Trend</Text>
                  <View className="flex-row bg-surfaceLight rounded-lg p-1">
                    {(['7d', '30d', '90d'] as TimeRange[]).map((range) => {
                      const isSelected = timeRange === range;
                      return (
                        <Pressable
                          key={range}
                          onPress={() => setTimeRange(range)}
                          className={`px-3 py-1.5 rounded-md ${isSelected ? 'bg-primary' : ''}`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              isSelected ? 'text-background' : 'text-textMuted'
                            }`}
                          >
                            {range}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <TrendChart
                  data={getTrendData(timeRange)}
                  color="#8B5CF6"
                  height={120}
                  showLabels
                />
              </View>
            )}

            {/* Recent Activities */}
            <View className="mt-6 px-5">
              <Text className="text-textPrimary text-lg font-semibold mb-3">Recent Activities</Text>
            </View>

            {recentWorkouts.length === 0 ?  (
              <View className="mx-5 bg-surface rounded-2xl p-8 items-center">
                <Activity size={48} color="#6B7280" />
                <Text className="text-textSecondary mt-4 text-center">
                  No workouts yet. Connect your Polar device to sync your training data.
                </Text>
              </View>
            ) : (
              <View className="px-5 mb-8">
                {recentWorkouts.map((workout:  Workout) => (
                  <Pressable
                    key={workout.id}
                    onPress={() => router.push(`/workout/${workout.id}`)}
                    className="bg-surface rounded-2xl p-4 mb-3 active:opacity-80"
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <View className="w-10 h-10 rounded-full bg-accent/20 items-center justify-center mr-3">
                            <Activity size={20} color="#8B5CF6" />
                          </View>
                          <View>
                            <Text className="text-textPrimary font-semibold text-base">
                              {workout.type}
                            </Text>
                            <Text className="text-textMuted text-sm">
                              {getDayOfWeek(workout.date)} • {formatDate(workout.date)}
                            </Text>
                          </View>
                        </View>

                        {/* Stats row */}
                        <View className="flex-row mt-3 pt-3 border-t border-border">
                          <View className="flex-row items-center mr-4">
                            <Clock size={14} color="#6B7280" />
                            <Text className="text-textSecondary text-sm ml-1">
                              {workout. durationMinutes > 0
                                ? formatDuration(workout.durationMinutes)
                                : '0m'}
                            </Text>
                          </View>
                          <View className="flex-row items-center mr-4">
                            <Flame size={14} color="#6B7280" />
                            <Text className="text-textSecondary text-sm ml-1">
                              {workout.calories || 0} cal
                            </Text>
                          </View>
                          <View className="flex-row items-center">
                            <Heart size={14} color="#6B7280" />
                            <Text className="text-textSecondary text-sm ml-1">
                              {workout.avgHR || 0} bpm
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View className="items-end">
                        {workout.strainScore !== undefined && workout.strainScore > 0 && (
                          <View className="bg-accent/20 px-2 py-1 rounded-lg">
                            <Text className="text-accent text-sm font-bold">
                              {workout.strainScore.toFixed(1)}
                            </Text>
                          </View>
                        )}
                        <ChevronRight size={20} color="#6B7280" className="mt-2" />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}