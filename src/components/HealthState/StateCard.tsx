/**
 * StateCard - Displays health state (recovery/load/energy).
 *
 * Color-coded:
 * - Green: Good state
 * - Yellow: Neutral/moderate
 * - Orange: Attention needed
 *
 * Shows confidence level and expandable factors.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Theme } from '../../theme/colors';

type StateType = 'recovery' | 'load' | 'energy';

export interface StateCardProps {
  theme: Theme;
  type: StateType;
  state: string;
  confidence: number;
  factors?: Record<string, string | boolean | number>;
  cumulative?: number; // For load state
  index?: number;
  compact?: boolean; // Smaller version for dashboard
}

const STATE_CONFIGS: Record<StateType, {
  icon: string;
  title: string;
  stateColors: Record<string, 'success' | 'warning' | 'error' | 'accent'>;
  stateLabels: Record<string, string>;
}> = {
  recovery: {
    icon: 'heart-outline',
    title: 'Recovery',
    stateColors: {
      recovered: 'success',
      neutral: 'warning',
      under_recovered: 'error',
    },
    stateLabels: {
      recovered: 'Recovered',
      neutral: 'Neutral',
      under_recovered: 'Under-recovered',
    },
  },
  load: {
    icon: 'barbell-outline',
    title: 'Training Load',
    stateColors: {
      low: 'success',
      moderate: 'warning',
      high: 'error',
    },
    stateLabels: {
      low: 'Low',
      moderate: 'Moderate',
      high: 'High',
    },
  },
  energy: {
    icon: 'flash-outline',
    title: 'Energy',
    stateColors: {
      peak: 'success',
      high: 'success',
      moderate: 'warning',
      low: 'error',
      depleted: 'error',
    },
    stateLabels: {
      peak: 'Peak',
      high: 'High',
      moderate: 'Moderate',
      low: 'Low',
      depleted: 'Depleted',
    },
  },
};

const CONFIDENCE_LABELS = [
  { min: 0, max: 0.3, label: 'Early pattern', style: 'dotted' },
  { min: 0.3, max: 0.6, label: 'Emerging trend', style: 'dashed' },
  { min: 0.6, max: 0.8, label: 'Likely pattern', style: 'solid' },
  { min: 0.8, max: 1.0, label: 'Strong pattern', style: 'solid' },
];

// Helper to format labels (snake_case -> Title Case)
function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Helper to format values cleanly
function formatValue(value: string | boolean | number): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  // Clean up snake_case and add proper capitalization
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default function StateCard({
  theme,
  type,
  state,
  confidence,
  factors,
  cumulative,
  index = 0,
  compact = false,
}: StateCardProps): React.ReactNode {
  const [expanded, setExpanded] = useState<boolean>(false);

  const config = STATE_CONFIGS[type];
  const colorKey = config.stateColors[state] || 'accent';
  const stateLabel = config.stateLabels[state] || state;
  const stateColor = theme[colorKey];

  const confidenceInfo = CONFIDENCE_LABELS.find(
    (c) => confidence >= c.min && confidence < c.max
  ) || CONFIDENCE_LABELS[0];

  const hasFacts = factors !== undefined && Object.keys(factors).length > 0;

  const styles = createStyles(theme, stateColor, confidenceInfo.style, compact);

  // Compact rendering
  if (compact) {
    return (
      <Animated.View
        entering={FadeInDown.delay(index * 100).springify()}
        style={styles.compactContainer}
      >
        <View style={[styles.compactIcon, { backgroundColor: stateColor + '20' }]}>
          <Ionicons name={config.icon as any} size={16} color={stateColor} />
        </View>
        <Text style={styles.compactTitle}>{config.title}</Text>
        <Text style={[styles.compactState, { color: stateColor }]}>{stateLabel}</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).springify()}
      style={styles.container}
    >
      <TouchableOpacity
        style={styles.header}
        onPress={() => hasFacts && setExpanded(!expanded)}
        activeOpacity={hasFacts ? 0.7 : 1}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={config.icon as any} size={20} color={stateColor} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{config.title}</Text>
          <View style={styles.stateRow}>
            <Text style={[styles.stateText, { color: stateColor }]}>
              {stateLabel}
            </Text>
            {cumulative !== undefined && (
              <Text style={styles.cumulativeText}>
                ({cumulative.toFixed(0)} load units)
              </Text>
            )}
          </View>
        </View>

        <View style={styles.rightSection}>
          <View style={[styles.confidenceBadge, { borderColor: stateColor }]}>
            <Text style={[styles.confidenceText, { color: stateColor }]}>
              {Math.round(confidence * 100)}%
            </Text>
          </View>
          {hasFacts && (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={theme.textSecondary}
            />
          )}
        </View>
      </TouchableOpacity>

      {expanded && hasFacts && (
        <Animated.View entering={FadeInUp.duration(200)} style={styles.factorsContainer}>
          {Object.entries(factors!).map(([key, value]) => (
            <View key={key} style={styles.factorRow}>
              <Text style={styles.factorKey}>
                {formatLabel(key)}
              </Text>
              <Text style={styles.factorValue}>
                {formatValue(value)}
              </Text>
            </View>
          ))}
          <Text style={styles.confidenceNote}>
            {confidenceInfo.label} - {confidence < 0.4 ? 'Keep logging to improve accuracy' : 'Based on your patterns'}
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

function createStyles(theme: Theme, stateColor: string, borderStyle: string, compact: boolean) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 8,
      overflow: 'hidden',
    },
    // Compact styles
    compactContainer: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
      minWidth: 90,
    },
    compactIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    compactTitle: {
      fontSize: 11,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    compactState: {
      fontSize: 13,
      fontWeight: '600',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: stateColor + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    stateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
    },
    stateText: {
      fontSize: 15,
      fontWeight: '700',
    },
    cumulativeText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginLeft: 6,
    },
    rightSection: {
      alignItems: 'center',
    },
    confidenceBadge: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginBottom: 4,
    },
    confidenceText: {
      fontSize: 11,
      fontWeight: '600',
    },
    factorsContainer: {
      paddingHorizontal: 14,
      paddingBottom: 14,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 10,
    },
    factorRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    factorKey: {
      fontSize: 13,
      color: theme.textSecondary,
      textTransform: 'capitalize',
    },
    factorValue: {
      fontSize: 13,
      color: theme.textPrimary,
      fontWeight: '500',
      textTransform: 'capitalize',
    },
    confidenceNote: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 8,
      fontStyle: 'italic',
    },
  });
}
