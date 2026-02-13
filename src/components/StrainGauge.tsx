'use client';

import React from 'react';

interface StrainGaugeProps {
  value: number | null;
  targetLow?: number;
  targetHigh?: number;
}

const StrainGauge: React.FC<StrainGaugeProps> = ({
  value,
  targetLow,
  targetHigh,
}) => {
  const size = 280;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 90;

  // Get zone info
  const getZoneInfo = (val: number): { label: string; color: string } => {
    if (val < 10) return { label: 'Light', color: '#38bdf8' }; // Light blue
    if (val < 14) return { label: 'Moderate', color: '#3b82f6' }; // Blue
    if (val < 18) return { label: 'High', color: '#a855f7' }; // Purple
    return { label: 'All Out', color: '#ec4899' }; // Pink
  };

  const clampedValue = value !== null ? Math.min(Math.max(value, 0), 21) : 0;
  const zoneInfo = value !== null ? getZoneInfo(clampedValue) : { label: 'No Data', color: '#6b7280' };

  // Calculate angle for value (0-21 maps to 0-180 degrees for semi-circle)
  const valueAngle = (clampedValue / 21) * 180;
  const valueRadians = (valueAngle * Math.PI) / 180;

  // Convert polar to cartesian
  const valueX = centerX + radius * Math.cos(valueRadians - Math.PI / 2);
  const valueY = centerY + radius * Math.sin(valueRadians - Math.PI / 2);

  // Create gradient for the arc
  const gradientId = `strain-gradient-${Math.random().toString(36).substr(2, 9)}`;

  // Generate arc path for the gauge
  const generateArcPath = (startAngle: number, endAngle: number, r: number): string => {
    const start = (startAngle * Math.PI) / 180;
    const end = (endAngle * Math.PI) / 180;

    const x1 = centerX + r * Math.cos(start - Math.PI / 2);
    const y1 = centerY + r * Math.sin(start - Math.PI / 2);
    const x2 = centerX + r * Math.cos(end - Math.PI / 2);
    const y2 = centerY + r * Math.sin(end - Math.PI / 2);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <svg
        width={size}
        height={size * 0.6}
        viewBox={`0 0 ${size} ${size * 0.6}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="25%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {/* Background arc */}
        <path
          d={generateArcPath(0, 180, radius)}
          fill="none"
          stroke="#27272a"
          strokeWidth="16"
          opacity="0.5"
          strokeLinecap="round"
        />

        {/* Colored arc for filled value */}
        {value !== null && (
          <path
            d={generateArcPath(0, valueAngle, radius)}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="16"
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)',
              filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.3))',
            }}
          />
        )}

        {/* Needle indicator */}
        {value !== null && (
          <>
            {/* Needle line */}
            <line
              x1={centerX}
              y1={centerY}
              x2={valueX}
              y2={valueY}
              stroke={zoneInfo.color}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.8"
            />
            {/* Needle dot */}
            <circle
              cx={valueX}
              cy={valueY}
              r="6"
              fill={zoneInfo.color}
              stroke="#ffffff"
              strokeWidth="2"
            />
          </>
        )}

        {/* Center circle for needle */}
        <circle
          cx={centerX}
          cy={centerY}
          r="8"
          fill={zoneInfo.color}
          stroke="#ffffff"
          strokeWidth="2"
        />

        {/* Zone labels at the bottom */}
        <text
          x="20"
          y={centerY * 1.35}
          fontSize="12"
          fill="#9ca3af"
          textAnchor="start"
          className="font-medium"
        >
          Light 0-9
        </text>
        <text
          x="80"
          y={centerY * 1.35}
          fontSize="12"
          fill="#9ca3af"
          textAnchor="middle"
          className="font-medium"
        >
          Moderate 10-13
        </text>
        <text
          x="165"
          y={centerY * 1.35}
          fontSize="12"
          fill="#9ca3af"
          textAnchor="middle"
          className="font-medium"
        >
          High 14-17
        </text>
        <text
          x="260"
          y={centerY * 1.35}
          fontSize="12"
          fill="#9ca3af"
          textAnchor="end"
          className="font-medium"
        >
          All Out 18-21
        </text>
      </svg>

      {/* Center display */}
      <div className="mt-4 text-center">
        {value !== null ? (
          <>
            <div className="text-5xl font-bold text-white mb-2">
              {Math.round(clampedValue)}
            </div>
            <div
              className="text-lg font-semibold transition-colors duration-300"
              style={{ color: zoneInfo.color }}
            >
              {zoneInfo.label}
            </div>
          </>
        ) : (
          <>
            <div className="text-5xl font-bold text-gray-500 mb-2">--</div>
            <div className="text-lg font-semibold text-gray-500">
              No Data
            </div>
          </>
        )}

        {/* Target range display */}
        {targetLow !== undefined && targetHigh !== undefined && (
          <div className="mt-4 text-xs text-gray-400 flex justify-center gap-4">
            <span>
              Target: <span className="text-gray-300 font-semibold">{targetLow}-{targetHigh}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StrainGauge;
