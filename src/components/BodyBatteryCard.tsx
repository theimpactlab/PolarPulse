import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Battery, Zap } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSpring,
  useSharedValue,
  withDelay,
} from 'react-native-reanimated';
import { getBodyBatteryStatus, getBodyBatteryColor } from '@/lib/utils/scoring';

interface BodyBatteryCardProps {
  value: number;
  onPress?: () => void;
}

export function BodyBatteryCard({ value, onPress }: BodyBatteryCardProps) {
  const status = getBodyBatteryStatus(value);
  const color = getBodyBatteryColor(value);
  const fillWidth = useSharedValue(0);

  React.useEffect(() => {
    fillWidth.value = withDelay(200, withSpring(value, { damping: 15 }));
  }, [value]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillWidth.value}%`,
  }));

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
            <Zap size={16} color={color} />
          </View>
          <Text className="text-textSecondary text-xs font-medium ml-2">
            BODY BATTERY
          </Text>
        </View>
      </View>

      <View className="flex-row items-baseline">
        <Text className="text-3xl font-bold text-textPrimary">{value}</Text>
        <Text className="text-textMuted text-sm ml-1">/ 100</Text>
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

      {/* Battery gauge */}
      <View className="mt-3 h-4 bg-surfaceLight rounded-full overflow-hidden flex-row">
        <Animated.View
          className="h-full rounded-full"
          style={[{ backgroundColor: color }, fillStyle]}
        />
      </View>

      {/* Scale markers */}
      <View className="flex-row justify-between mt-1">
        <Text className="text-textMuted text-xs">0</Text>
        <Text className="text-textMuted text-xs">25</Text>
        <Text className="text-textMuted text-xs">50</Text>
        <Text className="text-textMuted text-xs">75</Text>
        <Text className="text-textMuted text-xs">100</Text>
      </View>
    </Pressable>
  );
}
