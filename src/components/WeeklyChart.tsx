"use client";

import React, { useMemo } from "react";

interface DataPoint {
  date: string;
  value: number | null;
}

interface WeeklyChartProps {
  data: Array<DataPoint>;
  label: string;
  color?: string;
  height?: number;
}

export const WeeklyChart: React.FC<WeeklyChartProps> = ({
  data,
  label,
  color = "#60a5fa",
  height = 60,
}) => {
  const chartData = useMemo(() => {
    // Take last 7 data points
    const lastSevenDays = data.slice(-7);

    // Find min and max values for scaling
    const validValues = lastSevenDays
      .map((d) => d.value)
      .filter((v) => v !== null && v !== undefined) as number[];

    if (validValues.length === 0) {
      return { points: [], min: 0, max: 1, currentValue: null, range: 0 };
    }

    const min = Math.min(...validValues);
    const max = Math.max(...validValues);
    const range = max - min || 1;

    // Calculate SVG points
    const width = 300; // Default SVG width
    const padding = 10;
    const usableWidth = width - padding * 2;
    const pointSpacing = usableWidth / Math.max(lastSevenDays.length - 1, 1);

    const points = lastSevenDays.map((d, idx) => {
      if (d.value === null || d.value === undefined) {
        return { x: padding + idx * pointSpacing, y: null, value: null };
      }
      const normalizedValue = (d.value - min) / range;
      const y = height - normalizedValue * (height - padding * 2) - padding;
      return { x: padding + idx * pointSpacing, y, value: d.value };
    });

    const currentValue = lastSevenDays[lastSevenDays.length - 1]?.value || null;

    return { points, min, max, currentValue, range };
  }, [data, height]);

  const polylinePoints = chartData.points
    .filter((p) => p.y !== null)
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  const currentPoint = chartData.points[chartData.points.length - 1];

  // Format current value
  const formatValue = (val: number | null) => {
    if (val === null) return "--";
    if (val >= 100) return Math.round(val).toString();
    return val.toFixed(1);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
      {/* Header with label and current value */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-400">{label}</p>
        {chartData.currentValue !== null && (
          <p className="text-lg font-bold text-white">
            {formatValue(chartData.currentValue)}
          </p>
        )}
      </div>

      {/* Chart */}
      <div className="relative">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 300 ${height}`}
          className="w-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1="10"
            y1={height / 2}
            x2="290"
            y2={height / 2}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />

          {/* Area under curve */}
          {polylinePoints && (
            <polygon
              points={`10,${height - 10} ${polylinePoints} 290,${height - 10}`}
              fill={`url(#gradient-${label})`}
            />
          )}

          {/* Line chart */}
          {polylinePoints && (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data points as circles */}
          {chartData.points.map((point, idx) => {
            if (point.y === null) return null;
            const isLast = idx === chartData.points.length - 1;
            return (
              <g key={idx}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isLast ? "3.5" : "2"}
                  fill={color}
                  opacity={isLast ? "1" : "0.6"}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Min/Max labels */}
      {chartData.range > 0 && (
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>{formatValue(chartData.min)}</span>
          <span>{formatValue(chartData.max)}</span>
        </div>
      )}

      {/* Day labels (simplified) */}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
        <span>7d ago</span>
        <span>Today</span>
      </div>
    </div>
  );
};
