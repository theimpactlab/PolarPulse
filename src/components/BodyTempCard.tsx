import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Thermometer, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { getBodyTempStatus, getBodyTempColor } from '@/lib/utils/scoring';

interface BodyTempCardProps {
  deviation: number;
  baseline?: number;
  history?: { date: string; value: number }[];
  onPress?: () => void;
}

export function BodyTempCard({
  deviation,
  baseline = 36.6,
  history,
  onPress,
}: BodyTempCardProps) {
  const status = getBodyTempStatus(deviation);
  const color = getBodyTempColor(deviation);
  const currentTemp = baseline + deviation;

  const TrendIcon = () => {
    if (Math.abs(deviation) <= 0.1) {
      return <Minus size={14} color="#6B7280" />;
    }
    if (deviation > 0) {
      return <TrendingUp size={14} color={color} />;
    }
    return <TrendingDown size={14} color={color} />;
  };

  // Simple trend visualization
  const renderTrendLine = () => {
    if (!history || history.length < 2) return null;

    const recentHistory = history.slice(-7);
    const maxDev = Math.max(...recentHistory.map(h => Math.abs(h.value)), 0.5);

    return (
      <View className="flex-row items-end h-8 mt-2">
        {recentHistory.map((point, index) => {
          const normalizedHeight = Math.abs(point.value) / maxDev;
          const barColor = getBodyTempColor(point.value);

          return (
            <View
              key={index}
              className="flex-1 mx-0.5 rounded-t"
              style={{
                height: Math.max(4, normalizedHeight * 32),
                backgroundColor: barColor,
                opacity: 0.3 + (index / recentHistory.length) * 0.7,
              }}
            />
          );
        })}
      </View>
    );
  };

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
            <Thermometer size={16} color={color} />
          </View>
          <Text className="text-textSecondary text-xs font-medium ml-2">
            BODY TEMP
          </Text>
        </View>
        <View className="flex-row items-center">
          <TrendIcon />
          <Text className="text-textSecondary text-xs ml-1">
            {deviation >= 0 ? '+' : ''}{deviation.toFixed(2)}°C
          </Text>
        </View>
      </View>

      <View className="flex-row items-baseline">
        <Text className="text-3xl font-bold text-textPrimary">
          {currentTemp.toFixed(1)}
        </Text>
        <Text className="text-textMuted text-sm ml-1">°C</Text>
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

      {/* Deviation indicator */}
      <View className="mt-3">
        <View className="h-2 bg-surfaceLight rounded-full overflow-hidden relative">
          {/* Center marker (baseline) */}
          <View
            className="absolute w-0.5 h-full bg-textMuted"
            style={{ left: '50%' }}
          />
          {/* Deviation marker */}
          <View
            className="absolute w-3 h-3 rounded-full -top-0.5"
            style={{
              left: `${50 + (deviation / 1) * 50}%`,
              backgroundColor: color,
              marginLeft: -6,
            }}
          />
        </View>
        <View className="flex-row justify-between mt-1">
          <Text className="text-textMuted text-xs">-1.0°</Text>
          <Text className="text-textMuted text-xs">Baseline</Text>
          <Text className="text-textMuted text-xs">+1.0°</Text>
        </View>
      </View>

      {/* 7-day trend if available */}
      {history && history.length >= 3 && (
        <View className="mt-3 pt-3 border-t border-border">
          <Text className="text-textMuted text-xs mb-1">7-Day Trend</Text>
          {renderTrendLine()}
        </View>
      )}

      {/* Info about what deviations mean */}
      <View className="mt-3 bg-surfaceLight rounded-lg p-2">
        <Text className="text-textMuted text-xs">
          {status === 'Normal'
            ? 'Your body temperature is within normal range'
            : deviation > 0
              ? 'Elevated temp may indicate stress, illness, or intense training'
              : 'Lower temp can indicate good recovery or rest'}
        </Text>
      </View>
    </Pressable>
  );
}
