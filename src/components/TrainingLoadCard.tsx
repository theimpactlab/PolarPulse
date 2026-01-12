import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Activity, Info } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withDelay,
} from 'react-native-reanimated';
import { getTrainingLoadStatusInfo } from '@/lib/utils/scoring';
import type { TrainingLoadHistory } from '@/lib/state/app-store';

interface TrainingLoadCardProps {
  acuteLoad: number;
  chronicLoad: number;
  status: string;
  history?: TrainingLoadHistory[];
  onPress?: () => void;
}

export function TrainingLoadCard({
  acuteLoad,
  chronicLoad,
  status,
  history,
  onPress,
}: TrainingLoadCardProps) {
  const statusInfo = getTrainingLoadStatusInfo(status);
  const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : 1;
  const acuteWidth = useSharedValue(0);
  const chronicWidth = useSharedValue(0);

  React.useEffect(() => {
    const maxLoad = Math.max(acuteLoad, chronicLoad, 100);
    acuteWidth.value = withDelay(200, withSpring((acuteLoad / maxLoad) * 100, { damping: 15 }));
    chronicWidth.value = withDelay(300, withSpring((chronicLoad / maxLoad) * 100, { damping: 15 }));
  }, [acuteLoad, chronicLoad]);

  const acuteStyle = useAnimatedStyle(() => ({
    width: `${acuteWidth.value}%`,
  }));

  const chronicStyle = useAnimatedStyle(() => ({
    width: `${chronicWidth.value}%`,
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
            style={{ backgroundColor: `${statusInfo.color}20` }}
          >
            <Activity size={16} color={statusInfo.color} />
          </View>
          <Text className="text-textSecondary text-xs font-medium ml-2">
            TRAINING LOAD
          </Text>
        </View>
        <View
          className="px-2 py-1 rounded-full"
          style={{ backgroundColor: `${statusInfo.color}20` }}
        >
          <Text style={{ color: statusInfo.color }} className="text-xs font-semibold">
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {/* Acute vs Chronic comparison */}
      <View className="space-y-3">
        <View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-textSecondary text-xs">7-Day (Acute)</Text>
            <Text className="text-textPrimary font-semibold">{acuteLoad}</Text>
          </View>
          <View className="h-3 bg-surfaceLight rounded-full overflow-hidden">
            <Animated.View
              className="h-full rounded-full bg-accent"
              style={acuteStyle}
            />
          </View>
        </View>

        <View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-textSecondary text-xs">28-Day (Chronic)</Text>
            <Text className="text-textPrimary font-semibold">{chronicLoad}</Text>
          </View>
          <View className="h-3 bg-surfaceLight rounded-full overflow-hidden">
            <Animated.View
              className="h-full rounded-full bg-primary"
              style={chronicStyle}
            />
          </View>
        </View>
      </View>

      {/* Ratio indicator */}
      <View className="mt-4 bg-surfaceLight rounded-lg p-3">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <Text className="text-textMuted text-xs">Load Ratio</Text>
            <Info size={12} color="#6B7280" className="ml-1" />
          </View>
          <Text className="text-textPrimary font-bold">{ratio.toFixed(2)}</Text>
        </View>
        <Text className="text-textMuted text-xs mt-1">{statusInfo.description}</Text>

        {/* Ratio scale */}
        <View className="mt-2 h-2 bg-border rounded-full overflow-hidden relative">
          {/* Optimal zone highlight */}
          <View
            className="absolute h-full opacity-30"
            style={{
              left: '35%',
              width: '30%',
              backgroundColor: '#00D1A7',
            }}
          />
          {/* Ratio marker */}
          <View
            className="absolute w-3 h-3 rounded-full -top-0.5"
            style={{
              left: `${Math.min(100, Math.max(0, (ratio / 2) * 100))}%`,
              backgroundColor: statusInfo.color,
              marginLeft: -6,
            }}
          />
        </View>
        <View className="flex-row justify-between mt-1">
          <Text className="text-textMuted text-xs">0.8</Text>
          <Text className="text-textMuted text-xs">1.0</Text>
          <Text className="text-textMuted text-xs">1.5</Text>
        </View>
      </View>
    </Pressable>
  );
}
