import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Wind, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { getVO2MaxStatus, getVO2MaxColor } from '@/lib/utils/scoring';

interface VO2MaxCardProps {
  value: number;
  baseline?: number;
  onPress?: () => void;
}

export function VO2MaxCard({ value, baseline, onPress }: VO2MaxCardProps) {
  const status = getVO2MaxStatus(value);
  const color = getVO2MaxColor(value);
  const delta = baseline ? value - baseline : 0;

  const TrendIcon = () => {
    if (Math.abs(delta) < 0.5) {
      return <Minus size={12} color="#6B7280" />;
    }
    if (delta > 0) {
      return <TrendingUp size={12} color="#00D1A7" />;
    }
    return <TrendingDown size={12} color="#FF4757" />;
  };

  // Calculate fitness percentile (simplified)
  const getPercentile = (vo2: number) => {
    if (vo2 >= 55) return 95;
    if (vo2 >= 50) return 85;
    if (vo2 >= 45) return 70;
    if (vo2 >= 40) return 50;
    if (vo2 >= 35) return 30;
    return 15;
  };

  const percentile = getPercentile(value);

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface rounded-2xl p-4 active:opacity-90"
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <Wind size={16} color={color} />
          </View>
          <Text className="text-textSecondary text-xs font-medium ml-2">
            VO2 MAX
          </Text>
        </View>
        {baseline && Math.abs(delta) >= 0.1 && (
          <View className="flex-row items-center bg-surfaceLight px-2 py-1 rounded-lg">
            <TrendIcon />
            <Text
              className={`text-xs ml-1 ${delta >= 0 ? 'text-recovery-high' : 'text-recovery-low'}`}
            >
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row items-baseline">
        <Text className="text-3xl font-bold text-textPrimary">
          {value.toFixed(1)}
        </Text>
        <Text className="text-textMuted text-sm ml-1">ml/kg/min</Text>
      </View>

      <View className="flex-row items-center mt-1 mb-3">
        <View
          className="w-1.5 h-1.5 rounded-full mr-1.5"
          style={{ backgroundColor: color }}
        />
        <Text style={{ color }} className="text-sm font-medium">
          {status}
        </Text>
      </View>

      {/* Fitness level indicator */}
      <View className="bg-surfaceLight rounded-lg p-3">
        <View className="flex-row justify-between items-center">
          <Text className="text-textMuted text-xs">Fitness Percentile</Text>
          <Text className="text-textPrimary font-semibold">Top {100 - percentile}%</Text>
        </View>
        <View className="h-2 bg-border rounded-full mt-2 overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{ width: `${percentile}%`, backgroundColor: color }}
          />
        </View>
      </View>
    </Pressable>
  );
}
