import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

interface DataPoint {
  date: string;
  value: number;
}

interface TrendChartProps {
  data: DataPoint[];
  color: string;
  height?: number;
  showLabels?: boolean;
  showBaseline?: boolean;
  baseline?: number;
  unit?: string;
}

export function TrendChart({
  data,
  color,
  height = 100,
  showLabels = false,
  showBaseline = false,
  baseline,
  unit = '',
}: TrendChartProps) {
  if (data.length === 0) {
    return (
      <View style={{ height }} className="items-center justify-center">
        <Text className="text-textMuted text-sm">No data available</Text>
      </View>
    );
  }

  const width = 300; // Will be scaled by viewBox
  const padding = { top: 10, right: 10, bottom: showLabels ? 25 : 10, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Filter out zero values for min/max calculation but keep them in data
  const nonZeroValues = data.filter(d => d.value > 0).map(d => d.value);
  const maxValue = nonZeroValues.length > 0 ? Math.max(...nonZeroValues) : 100;
  const minValue = nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : 0;

  // Add some padding to the range
  const range = maxValue - minValue || 1;
  const yMin = Math.max(0, minValue - range * 0.1);
  const yMax = maxValue + range * 0.1;

  // Scale functions
  const xScale = (index: number): number =>
    padding.left + (index / (data.length - 1)) * chartWidth;

  const yScale = (value: number): number => {
    if (yMax === yMin) return padding.top + chartHeight / 2;
    return padding.top + chartHeight - ((value - yMin) / (yMax - yMin)) * chartHeight;
  };

  // Generate path for the line
  const linePath = data
    .map((point, i) => {
      const x = xScale(i);
      const y = yScale(point.value);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Generate path for the area fill
  const areaPath = `${linePath} L ${xScale(data.length - 1)} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

  // Calculate baseline position
  const baselineY = baseline !== undefined ? yScale(baseline) : null;

  // Get current and previous values for comparison
  const currentValue = data[data.length - 1]?.value ?? 0;
  const avgValue = nonZeroValues.length > 0
    ? nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length
    : 0;

  // X-axis labels (first, middle, last)
  const labelIndices = [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Area fill */}
        <Path d={areaPath} fill={`url(#gradient-${color})`} />

        {/* Baseline */}
        {showBaseline && baselineY !== null && (
          <Line
            x1={padding.left}
            y1={baselineY}
            x2={width - padding.right}
            y2={baselineY}
            stroke="#6B7280"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}

        {/* Line */}
        <Path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* End point dot */}
        <Circle
          cx={xScale(data.length - 1)}
          cy={yScale(currentValue)}
          r={4}
          fill={color}
        />

        {/* X-axis labels */}
        {showLabels && labelIndices.map((index) => {
          const point = data[index];
          if (!point) return null;
          const date = new Date(point.date);
          const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return (
            <View key={index}>
              {/* Using SVG text is tricky in RN, so we'll overlay React Native Text */}
            </View>
          );
        })}
      </Svg>

      {/* Labels below chart */}
      {showLabels && (
        <View className="flex-row justify-between px-2 mt-1">
          {labelIndices.map((index) => {
            const point = data[index];
            if (!point) return <View key={index} />;
            const date = new Date(point.date);
            const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <Text key={index} className="text-textMuted text-xs">
                {label}
              </Text>
            );
          })}
        </View>
      )}

      {/* Stats row */}
      <View className="flex-row justify-between mt-3">
        <View>
          <Text className="text-textMuted text-xs">Current</Text>
          <Text className="text-textPrimary text-sm font-semibold">
            {currentValue > 0 ? `${currentValue.toFixed(unit === 'h' ? 1 : 0)}${unit}` : '--'}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-textMuted text-xs">Average</Text>
          <Text className="text-textSecondary text-sm">
            {avgValue > 0 ? `${avgValue.toFixed(unit === 'h' ? 1 : 0)}${unit}` : '--'}
          </Text>
        </View>
      </View>
    </View>
  );
}
