import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Clock, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withDelay,
} from 'react-native-reanimated';
import { getSleepDebtStatus, getSleepDebtColor } from '@/lib/utils/scoring';
import { formatDuration } from '@/lib/utils/format';

interface SleepDebtCardProps {
  debtMinutes: number;
  sleepGoalMinutes?: number;
  weeklyTrend?: 'improving' | 'stable' | 'worsening';
  onPress?: () => void;
}

export function SleepDebtCard({
  debtMinutes,
  sleepGoalMinutes = 480,
  weeklyTrend = 'stable',
  onPress,
}: SleepDebtCardProps) {
  const status = getSleepDebtStatus(debtMinutes);
  const color = getSleepDebtColor(debtMinutes);
  const maxDebt = 180; // 3 hours max for visualization
  const fillWidth = useSharedValue(0);

  React.useEffect(() => {
    const percentage = Math.min(100, (debtMinutes / maxDebt) * 100);
    fillWidth.value = withDelay(200, withSpring(percentage, { damping: 15 }));
  }, [debtMinutes]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillWidth.value}%`,
  }));

  const TrendIcon = () => {
    if (weeklyTrend === 'improving') {
      return <TrendingDown size={14} color="#00D1A7" />;
    }
    if (weeklyTrend === 'worsening') {
      return <TrendingUp size={14} color="#FF4757" />;
    }
    return null;
  };

  const getTrendText = () => {
    if (weeklyTrend === 'improving') return 'Improving';
    if (weeklyTrend === 'worsening') return 'Increasing';
    return '';
  };

  const hours = Math.floor(debtMinutes / 60);
  const mins = debtMinutes % 60;

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface rounded-2xl p-4 active:opacity-90"
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <Clock size={16} color={color} />
          </View>
          <Text className="text-textSecondary text-xs font-medium ml-2">
            SLEEP DEBT
          </Text>
        </View>
        {weeklyTrend !== 'stable' && (
          <View className="flex-row items-center">
            <TrendIcon />
            <Text
              className={`text-xs ml-1 ${weeklyTrend === 'improving' ? 'text-recovery-high' : 'text-recovery-low'}`}
            >
              {getTrendText()}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row items-baseline">
        <Text className="text-3xl font-bold text-textPrimary">
          {hours > 0 ? `${hours}h ` : ''}{mins}m
        </Text>
        {debtMinutes > 0 && (
          <Text className="text-textMuted text-sm ml-1">owed</Text>
        )}
      </View>

      <View className="flex-row items-center mt-1">
        <View
          className="w-1.5 h-1.5 rounded-full mr-1.5"
          style={{ backgroundColor: color }}
        />
        <Text style={{ color }} className="text-sm font-medium">
          {status}
        </Text>
      </View>

      {/* Debt gauge */}
      <View className="mt-3">
        <View className="h-3 bg-surfaceLight rounded-full overflow-hidden">
          <Animated.View
            className="h-full rounded-full"
            style={[{ backgroundColor: color }, fillStyle]}
          />
        </View>
        <View className="flex-row justify-between mt-1">
          <Text className="text-textMuted text-xs">0h</Text>
          <Text className="text-textMuted text-xs">1h</Text>
          <Text className="text-textMuted text-xs">2h</Text>
          <Text className="text-textMuted text-xs">3h+</Text>
        </View>
      </View>

      {/* Warning if significant debt */}
      {debtMinutes >= 120 && (
        <View className="mt-3 bg-recovery-low/10 rounded-lg p-3 flex-row items-center">
          <AlertTriangle size={16} color="#FF4757" />
          <Text className="text-textSecondary text-xs ml-2 flex-1">
            Consider going to bed {Math.ceil(debtMinutes / 60 / 3)}h earlier this week
          </Text>
        </View>
      )}

      {/* Goal info */}
      <View className="mt-3 flex-row justify-between">
        <Text className="text-textMuted text-xs">
          Sleep goal: {Math.floor(sleepGoalMinutes / 60)}h {sleepGoalMinutes % 60}m
        </Text>
        <Text className="text-textMuted text-xs">
          7-day average
        </Text>
      </View>
    </Pressable>
  );
}
