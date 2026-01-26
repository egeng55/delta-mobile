/**
 * CircularProgress - WHOOP-style circular progress ring
 *
 * Features:
 * - Smooth animated progress
 * - Gradient support
 * - Customizable size and stroke
 * - Optional center content
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Theme } from '../theme/colors';
import { typography } from '../theme/designSystem';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressProps {
  /** Progress value from 0 to 1 */
  progress: number;
  /** Size of the ring in pixels */
  size: number;
  /** Stroke width of the ring */
  strokeWidth?: number;
  /** Primary color of the progress ring */
  color: string;
  /** Optional secondary color for gradient */
  gradientColor?: string;
  /** Background ring color */
  backgroundColor?: string;
  /** Theme object */
  theme: Theme;
  /** Large number to display in center */
  value?: number | string;
  /** Small label below the value */
  label?: string;
  /** Unit to display after value */
  unit?: string;
  /** Show percentage instead of value */
  showPercent?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
}

export function CircularProgress({
  progress,
  size,
  strokeWidth = 12,
  color,
  gradientColor,
  backgroundColor,
  theme,
  value,
  label,
  unit,
  showPercent = false,
  animationDuration = 800,
}: CircularProgressProps): React.ReactElement {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const bgColor = backgroundColor ?? (theme.mode === 'dark' ? '#2a2a2a' : '#e5e7eb');

  // Animated progress value
  const animatedProgress = useDerivedValue(() => {
    return withTiming(Math.min(Math.max(progress, 0), 1), {
      duration: animationDuration,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [progress]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference * (1 - animatedProgress.value);
    return {
      strokeDashoffset,
    };
  });

  const displayValue = showPercent
    ? `${Math.round(progress * 100)}`
    : typeof value === 'number'
    ? Math.round(value).toLocaleString()
    : value ?? '';

  const hasGradient = gradientColor !== undefined;
  const gradientId = `gradient-${color.replace('#', '')}`;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {hasGradient && (
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={color} />
              <Stop offset="100%" stopColor={gradientColor} />
            </LinearGradient>
          </Defs>
        )}

        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={hasGradient ? `url(#${gradientId})` : color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {/* Center content */}
      <View style={styles.centerContent}>
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color: theme.textPrimary }]}>
            {displayValue}
          </Text>
          {unit && !showPercent && (
            <Text style={[styles.unit, { color: theme.textSecondary }]}>{unit}</Text>
          )}
          {showPercent && (
            <Text style={[styles.percent, { color: theme.textSecondary }]}>%</Text>
          )}
        </View>
        {label && (
          <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
        )}
      </View>
    </View>
  );
}

/**
 * Mini version of CircularProgress for compact displays
 */
export function CircularProgressMini({
  progress,
  size = 48,
  strokeWidth = 4,
  color,
  theme,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  theme: Theme;
}): React.ReactElement {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const bgColor = theme.mode === 'dark' ? '#2a2a2a' : '#e5e7eb';
  const strokeDashoffset = circumference * (1 - Math.min(Math.max(progress, 0), 1));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[styles.miniValue, { color: theme.textPrimary }]}>
        {Math.round(progress * 100)}
      </Text>
    </View>
  );
}

/**
 * Stacked rings component for multiple metrics
 */
export function StackedRings({
  rings,
  size,
  strokeWidth = 10,
  gap = 4,
  theme,
}: {
  rings: Array<{ progress: number; color: string; label: string }>;
  size: number;
  strokeWidth?: number;
  gap?: number;
  theme: Theme;
}): React.ReactElement {
  const bgColor = theme.mode === 'dark' ? '#2a2a2a' : '#e5e7eb';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        {rings.map((ring, index) => {
          const ringRadius = (size - strokeWidth) / 2 - index * (strokeWidth + gap);
          const ringCircumference = 2 * Math.PI * ringRadius;
          const strokeDashoffset = ringCircumference * (1 - Math.min(Math.max(ring.progress, 0), 1));

          return (
            <React.Fragment key={index}>
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={ringRadius}
                stroke={bgColor}
                strokeWidth={strokeWidth}
                fill="none"
              />
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={ringRadius}
                stroke={ring.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={ringCircumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
  },
  unit: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 2,
  },
  percent: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  miniValue: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default CircularProgress;
