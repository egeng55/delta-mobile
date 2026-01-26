/**
 * MetricComparisonCard - "vs yesterday" and "vs 7-day average" displays
 *
 * Features:
 * - Large current value
 * - Delta indicator (arrow + percentage)
 * - Comparison basis label
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Theme } from '../../theme/colors';
import { spacing, borderRadius, shadows } from '../../theme/designSystem';

type ComparisonBasis = 'yesterday' | '7-day average' | 'last week' | 'custom';

interface MetricComparisonCardProps {
  theme: Theme;
  label: string;
  currentValue: number;
  unit?: string;
  comparisonValue: number;
  comparisonBasis: ComparisonBasis | string;
  icon?: string;
  iconColor?: string;
  /** Whether higher is better (affects color coding) */
  higherIsBetter?: boolean;
  /** Number of decimal places to show */
  decimals?: number;
  compact?: boolean;
}

export default function MetricComparisonCard({
  theme,
  label,
  currentValue,
  unit = '',
  comparisonValue,
  comparisonBasis,
  icon,
  iconColor,
  higherIsBetter = true,
  decimals = 0,
  compact = false,
}: MetricComparisonCardProps): React.ReactElement {
  // Calculate delta
  const delta = currentValue - comparisonValue;
  const percentChange = comparisonValue !== 0
    ? ((delta / comparisonValue) * 100)
    : 0;

  // Determine if change is good or bad
  const isPositiveChange = delta > 0;
  const isGoodChange = higherIsBetter ? isPositiveChange : !isPositiveChange;
  const isNoChange = Math.abs(delta) < 0.01;

  // Colors based on change
  const changeColor = isNoChange
    ? theme.textSecondary
    : isGoodChange
    ? '#22C55E'
    : '#EF4444';

  // Arrow icon
  const arrowIcon = isNoChange
    ? 'remove'
    : isPositiveChange
    ? 'arrow-up'
    : 'arrow-down';

  // Format values
  const formattedValue = decimals > 0
    ? currentValue.toFixed(decimals)
    : Math.round(currentValue).toLocaleString();
  const formattedDelta = decimals > 0
    ? Math.abs(delta).toFixed(decimals)
    : Math.abs(Math.round(delta)).toLocaleString();
  const formattedPercent = Math.abs(percentChange).toFixed(1);

  const styles = createStyles(theme, compact);

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.container}>
      {/* Header with icon */}
      {icon && (
        <View style={[styles.iconContainer, { backgroundColor: (iconColor ?? theme.accent) + '20' }]}>
          <Ionicons name={icon as any} size={compact ? 16 : 20} color={iconColor ?? theme.accent} />
        </View>
      )}

      {/* Label */}
      <Text style={styles.label}>{label}</Text>

      {/* Current Value */}
      <View style={styles.valueRow}>
        <Text style={styles.value}>{formattedValue}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>

      {/* Delta indicator */}
      <View style={styles.deltaRow}>
        <View style={[styles.deltaIndicator, { backgroundColor: changeColor + '20' }]}>
          <Ionicons name={arrowIcon as any} size={12} color={changeColor} />
          {!isNoChange && (
            <Text style={[styles.deltaText, { color: changeColor }]}>
              {formattedDelta}{unit} ({formattedPercent}%)
            </Text>
          )}
          {isNoChange && (
            <Text style={[styles.deltaText, { color: changeColor }]}>No change</Text>
          )}
        </View>
      </View>

      {/* Comparison basis */}
      <Text style={styles.comparisonBasis}>vs {comparisonBasis}</Text>
    </Animated.View>
  );
}

function createStyles(theme: Theme, compact: boolean) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: compact ? spacing.md : spacing.lg,
      alignItems: 'center',
      ...shadows.sm,
    },
    iconContainer: {
      width: compact ? 32 : 40,
      height: compact ? 32 : 40,
      borderRadius: compact ? 16 : 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    label: {
      fontSize: compact ? 11 : 12,
      fontWeight: '500',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: spacing.xs,
    },
    value: {
      fontSize: compact ? 24 : 32,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    unit: {
      fontSize: compact ? 12 : 14,
      fontWeight: '500',
      color: theme.textSecondary,
      marginLeft: 2,
    },
    deltaRow: {
      marginBottom: spacing.xs,
    },
    deltaIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
      borderRadius: borderRadius.sm,
      gap: 4,
    },
    deltaText: {
      fontSize: compact ? 10 : 11,
      fontWeight: '600',
    },
    comparisonBasis: {
      fontSize: compact ? 9 : 10,
      color: theme.textSecondary,
      textTransform: 'lowercase',
    },
  });
}
