/**
 * LineChart - Simple SVG-based line chart for trend visualization.
 * Uses react-native-svg for rendering.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

export interface DataPoint {
  label: string;
  value: number | null;
}

interface LineChartProps {
  data: DataPoint[];
  width: number;
  height: number;
  color: string;
  backgroundColor: string;
  textColor: string;
  secondaryTextColor: string;
  showLabels?: boolean;
  showDots?: boolean;
  showGradient?: boolean;
  target?: number;
  targetColor?: string;
  minValue?: number;
  maxValue?: number;
}

export default function LineChart({
  data,
  width,
  height,
  color,
  backgroundColor,
  textColor,
  secondaryTextColor,
  showLabels = true,
  showDots = true,
  showGradient = true,
  target,
  targetColor,
  minValue,
  maxValue,
}: LineChartProps): React.ReactNode {
  const padding = { top: 16, right: 16, bottom: showLabels ? 28 : 16, left: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Filter out null values for calculations
  const validData = data.filter(d => d.value !== null) as { label: string; value: number }[];

  const { min, max, path, gradientPath, points } = useMemo(() => {
    if (validData.length === 0) {
      return { min: 0, max: 100, path: '', gradientPath: '', points: [] };
    }

    const values = validData.map(d => d.value);
    let calcMin = minValue ?? Math.min(...values);
    let calcMax = maxValue ?? Math.max(...values);

    // Include target in range if provided
    if (target !== undefined) {
      calcMin = Math.min(calcMin, target);
      calcMax = Math.max(calcMax, target);
    }

    // Add padding to range
    const range = calcMax - calcMin;
    if (range === 0) {
      calcMin -= 1;
      calcMax += 1;
    } else {
      calcMin -= range * 0.1;
      calcMax += range * 0.1;
    }

    // Calculate points
    const calcPoints = data.map((d, i) => {
      const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
      const y = d.value !== null
        ? padding.top + (1 - (d.value - calcMin) / (calcMax - calcMin)) * chartHeight
        : null;
      return { x, y, value: d.value, label: d.label };
    });

    // Create path for line
    const validPoints = calcPoints.filter(p => p.y !== null);
    let pathD = '';
    let gradientD = '';

    if (validPoints.length > 0) {
      pathD = validPoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
        .join(' ');

      // Gradient fill path (closes the path at the bottom)
      gradientD = pathD;
      const lastPoint = validPoints[validPoints.length - 1];
      const firstPoint = validPoints[0];
      gradientD += ` L ${lastPoint.x} ${padding.top + chartHeight}`;
      gradientD += ` L ${firstPoint.x} ${padding.top + chartHeight}`;
      gradientD += ' Z';
    }

    return { min: calcMin, max: calcMax, path: pathD, gradientPath: gradientD, points: calcPoints };
  }, [data, validData, chartWidth, chartHeight, padding, target, minValue, maxValue]);

  // Calculate target line Y position
  const targetY = target !== undefined
    ? padding.top + (1 - (target - min) / (max - min)) * chartHeight
    : null;

  if (data.length === 0) {
    return (
      <View style={[styles.container, { width, height, backgroundColor }]}>
        <Text style={[styles.noDataText, { color: secondaryTextColor }]}>
          No data available
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.05} />
          </LinearGradient>
        </Defs>

        {/* Background */}
        <Rect x={0} y={0} width={width} height={height} fill={backgroundColor} rx={12} />

        {/* Target line */}
        {targetY !== null && (
          <Line
            x1={padding.left}
            y1={targetY}
            x2={width - padding.right}
            y2={targetY}
            stroke={targetColor ?? color}
            strokeWidth={1}
            strokeDasharray="4,4"
            opacity={0.5}
          />
        )}

        {/* Gradient fill */}
        {showGradient && gradientPath.length > 0 && (
          <Path d={gradientPath} fill="url(#gradient)" />
        )}

        {/* Line */}
        {path.length > 0 && (
          <Path
            d={path}
            stroke={color}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Dots */}
        {showDots && points.map((point, i) => (
          point.y !== null && (
            <Circle
              key={i}
              cx={point.x}
              cy={point.y}
              r={4}
              fill={color}
              stroke={backgroundColor}
              strokeWidth={2}
            />
          )
        ))}
      </Svg>

      {/* Labels */}
      {showLabels && (
        <View style={[styles.labelsContainer, { width: chartWidth, marginLeft: padding.left }]}>
          {data.map((d, i) => (
            <Text
              key={i}
              style={[
                styles.label,
                { color: secondaryTextColor },
                data.length <= 7 ? styles.labelSpread : styles.labelCompact,
              ]}
              numberOfLines={1}
            >
              {data.length <= 7 ? d.label : (i === 0 || i === data.length - 1 ? d.label : '')}
            </Text>
          ))}
        </View>
      )}

      {/* Target label */}
      {target !== undefined && (
        <View style={[styles.targetLabel, { top: targetY !== null ? targetY - 8 : 0, right: padding.right + 4 }]}>
          <Text style={[styles.targetText, { color: targetColor ?? color }]}>
            Target: {target}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  noDataText: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 40,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    bottom: 4,
    left: 0,
  },
  label: {
    fontSize: 10,
    textAlign: 'center',
  },
  labelSpread: {
    flex: 1,
  },
  labelCompact: {
    width: 30,
  },
  targetLabel: {
    position: 'absolute',
  },
  targetText: {
    fontSize: 9,
    fontWeight: '500',
  },
});
