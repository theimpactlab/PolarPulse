import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Target, ChevronRight } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withDelay,
} from 'react-native-reanimated';
import { ScoreRing } from './ScoreRing';
import { getTrainingReadinessStatus, getTrainingReadinessColor } from '@/lib/utils/scoring';

interface TrainingReadinessCardProps {
  score: number;
  recoveryScore?: number;
  sleepScore?: number;
  hrvStatus?: 'above' | 'normal' | 'below';
  onPress?: () => void;
}

export function TrainingReadinessCard({
  score,
  recoveryScore,
  sleepScore,
  hrvStatus = 'normal',
  onPress,
}: TrainingReadinessCardProps) {
  const status = getTrainingReadinessStatus(score);
  const color = getTrainingReadinessColor(score);

  const getRecommendation = () => {
    if (score >= 80) return 'Great day for high-intensity training';
    if (score >= 60) return 'Moderate training recommended';
    if (score >= 40) return 'Light activity or active recovery';
    return 'Consider rest or very light activity';
  };

  const ContributorBar = ({
    label,
    value,
    maxValue = 100
  }: {
    label: string;
    value: number;
    maxValue?: number;
  }) => {
    const barWidth = useSharedValue(0);

    React.useEffect(() => {
      barWidth.value = withDelay(200, withSpring((value / maxValue) * 100, { damping: 15 }));
    }, [value]);

    const barStyle = useAnimatedStyle(() => ({
      width: `${barWidth.value}%`,
    }));

    const barColor = value >= 70 ? '#00D1A7' : value >= 50 ? '#F5A623' : '#FF4757';

    return (
      <View className="mb-2">
        <View className="flex-row justify-between mb-1">
          <Text className="text-textMuted text-xs">{label}</Text>
          <Text className="text-textSecondary text-xs font-medium">{value}%</Text>
        </View>
        <View className="h-1.5 bg-surfaceLight rounded-full overflow-hidden">
          <Animated.View
            className="h-full rounded-full"
            style={[{ backgroundColor: barColor }, barStyle]}
          />
        </View>
      </View>
    );
  };

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface rounded-2xl p-4 active:opacity-90"
    >
      <View className="flex-row items-center mb-3">
        <View
          className="w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Target size={16} color={color} />
        </View>
        <Text className="text-textSecondary text-xs font-medium ml-2">
          TRAINING READINESS
        </Text>
      </View>

      <View className="flex-row items-center">
        <ScoreRing
          score={score}
          size={80}
          strokeWidth={6}
          color={color}
        />
        <View className="flex-1 ml-4">
          <View className="flex-row items-center">
            <View
              className="w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: color }}
            />
            <Text style={{ color }} className="text-lg font-bold">
              {status}
            </Text>
          </View>
          <Text className="text-textMuted text-xs mt-1">
            {getRecommendation()}
          </Text>
        </View>
      </View>

      {/* Contributors */}
      {(recoveryScore !== undefined || sleepScore !== undefined) && (
        <View className="mt-4 pt-3 border-t border-border">
          <Text className="text-textMuted text-xs mb-2">CONTRIBUTING FACTORS</Text>
          {recoveryScore !== undefined && (
            <ContributorBar label="Recovery" value={recoveryScore} />
          )}
          {sleepScore !== undefined && (
            <ContributorBar label="Sleep" value={sleepScore} />
          )}
        </View>
      )}

      {onPress && (
        <View className="flex-row items-center justify-end mt-2">
          <Text className="text-textMuted text-xs mr-1">View details</Text>
          <ChevronRight size={14} color="#6B7280" />
        </View>
      )}
    </Pressable>
  );
}
