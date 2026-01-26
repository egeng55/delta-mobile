/**
 * StrainGauge - WHOOP-style training load visualization
 *
 * Displays training strain/load (0-100) with color zones:
 * - Blue: 0-33 (Low strain)
 * - Cyan: 34-66 (Moderate strain)
 * - Orange: 67-100 (High strain)
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
import { Theme } from '../../theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface StrainGaugeProps {
  /** Strain score from 0-100 */
  score: number;
  /** Size of the gauge in pixels */
  size?: number;
  /** Theme object */
  theme: Theme;
  /** Optional label below score */
  label?: string;
  /** Show state label (Low, Moderate, High) */
  showStateLabel?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
}

const ZONE_COLORS = {
  low: { start: '#3B82F6', end: '#2563EB' },        // Blue
  moderate: { start: '#06B6D4', end: '#0891B2' },   // Cyan
  high: { start: '#F97316', end: '#EA580C' },       // Orange
};

function getZone(score: number): 'low' | 'moderate' | 'high' {
  if (score >= 67) return 'high';
  if (score >= 34) return 'moderate';
  return 'low';
}

function getStateLabel(score: number): string {
  if (score >= 67) return 'High';
  if (score >= 34) return 'Moderate';
  return 'Low';
}

export default function StrainGauge({
  score,
  size = 200,
  theme,
  label,
  showStateLabel = true,
  animationDuration = 800,
}: StrainGaugeProps): React.ReactElement {
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = Math.min(Math.max(score, 0), 100);
  const progress = normalizedScore / 100;

  const zone = getZone(normalizedScore);
  const colors = ZONE_COLORS[zone];

  // Animated progress value
  const animatedProgress = useDerivedValue(() => {
    return withTiming(progress, {
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

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="strainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.start} />
            <Stop offset="100%" stopColor={colors.end} />
          </LinearGradient>
        </Defs>

        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.mode === 'dark' ? '#2a2a2a' : '#e5e7eb'}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#strainGradient)"
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
        <Text style={[styles.scoreValue, { color: colors.start, fontSize: size * 0.22 }]}>
          {Math.round(normalizedScore)}
        </Text>
        {showStateLabel && (
          <Text style={[styles.stateLabel, { color: colors.start, fontSize: size * 0.065 }]}>
            {getStateLabel(normalizedScore)}
          </Text>
        )}
        {label && (
          <Text style={[styles.label, { color: theme.textSecondary, fontSize: size * 0.055 }]}>
            {label}
          </Text>
        )}
      </View>
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
  scoreValue: {
    fontWeight: '700',
    letterSpacing: -1,
  },
  stateLabel: {
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: {
    fontWeight: '500',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
