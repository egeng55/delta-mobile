/**
 * RecoveryGauge - WHOOP-style recovery score visualization
 *
 * Large circular gauge (0-100) with color zones:
 * - Green: 67-100 (recovered)
 * - Yellow: 34-66 (moderate)
 * - Red: 0-33 (under-recovered)
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
import { typography, spacing } from '../../theme/designSystem';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RecoveryGaugeProps {
  /** Recovery score from 0-100 */
  score: number;
  /** Size of the gauge in pixels */
  size?: number;
  /** Theme object */
  theme: Theme;
  /** Optional label below score */
  label?: string;
  /** Show state label (Recovered, Moderate, etc.) */
  showStateLabel?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
}

const ZONE_COLORS = {
  recovered: { start: '#22C55E', end: '#16A34A' },  // Green
  moderate: { start: '#EAB308', end: '#CA8A04' },   // Yellow
  underRecovered: { start: '#EF4444', end: '#DC2626' }, // Red
};

function getZone(score: number): 'recovered' | 'moderate' | 'underRecovered' {
  if (score >= 67) return 'recovered';
  if (score >= 34) return 'moderate';
  return 'underRecovered';
}

function getStateLabel(score: number): string {
  if (score >= 67) return 'Recovered';
  if (score >= 34) return 'Moderate';
  return 'Under-recovered';
}

export default function RecoveryGauge({
  score,
  size = 200,
  theme,
  label,
  showStateLabel = true,
  animationDuration = 800,
}: RecoveryGaugeProps): React.ReactElement {
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
          <LinearGradient id="recoveryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
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
          stroke="url(#recoveryGradient)"
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
