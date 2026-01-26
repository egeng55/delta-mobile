/**
 * ChainCard - Visual cause-effect display.
 *
 * Shows detected patterns like:
 * - Poor sleep -> Low energy
 * - High stress -> Sleep disruption
 *
 * Includes confidence indicator and narrative explanation.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Theme } from '../../theme/colors';
import { CausalChain } from '../../services/api';

interface ChainCardProps {
  theme: Theme;
  chain: CausalChain;
  index?: number;
}

const EVENT_LABELS: Record<string, string> = {
  sleep_hours: 'Sleep Duration',
  sleep_quality: 'Sleep Quality',
  energy_level: 'Energy',
  stress_level: 'Stress',
  soreness_level: 'Soreness',
  alcohol_drinks: 'Alcohol',
  had_workout: 'Workout',
  cumulative_sleep_debt: 'Sleep Debt',
};

const EVENT_ICONS: Record<string, string> = {
  sleep_hours: 'bed-outline',
  sleep_quality: 'moon-outline',
  energy_level: 'flash-outline',
  stress_level: 'pulse-outline',
  soreness_level: 'fitness-outline',
  alcohol_drinks: 'wine-outline',
  had_workout: 'barbell-outline',
  cumulative_sleep_debt: 'time-outline',
};

const CONFIDENCE_COLORS = {
  high: 'success',
  medium: 'warning',
  low: 'textSecondary',
};

export default function ChainCard({
  theme,
  chain,
  index = 0,
}: ChainCardProps): React.ReactNode {
  const causeLabel = EVENT_LABELS[chain.cause_event] || chain.cause_event;
  const effectLabel = EVENT_LABELS[chain.effect_event] || chain.effect_event;
  const causeIcon = EVENT_ICONS[chain.cause_event] || 'help-outline';
  const effectIcon = EVENT_ICONS[chain.effect_event] || 'help-outline';

  const getConfidenceLevel = (): 'high' | 'medium' | 'low' => {
    if (chain.confidence >= 0.7) return 'high';
    if (chain.confidence >= 0.5) return 'medium';
    return 'low';
  };

  const confidenceLevel = getConfidenceLevel();
  const confidenceColor = theme[CONFIDENCE_COLORS[confidenceLevel] as keyof Theme] as string;

  const styles = createStyles(theme, confidenceColor);

  // Don't show low confidence patterns
  if (chain.confidence < 0.4) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).springify()}
      style={styles.container}
    >
      <View style={styles.chainFlow}>
        {/* Cause */}
        <View style={styles.eventBox}>
          <View style={[styles.eventIcon, { backgroundColor: theme.warning + '20' }]}>
            <Ionicons name={causeIcon as any} size={18} color={theme.warning} />
          </View>
          <Text style={styles.eventLabel} numberOfLines={1}>
            {causeLabel}
          </Text>
        </View>

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <View style={styles.arrowLine} />
          <View style={styles.arrowHead}>
            <Ionicons name="arrow-forward" size={16} color={theme.textSecondary} />
          </View>
          {chain.lag_days > 0 && (
            <Text style={styles.lagText}>
              +{chain.lag_days}d
            </Text>
          )}
        </View>

        {/* Effect */}
        <View style={styles.eventBox}>
          <View style={[styles.eventIcon, { backgroundColor: theme.accent + '20' }]}>
            <Ionicons name={effectIcon as any} size={18} color={theme.accent} />
          </View>
          <Text style={styles.eventLabel} numberOfLines={1}>
            {effectLabel}
          </Text>
        </View>
      </View>

      {/* Narrative */}
      <Text style={styles.narrative}>{chain.narrative}</Text>

      {/* Confidence and occurrences */}
      <View style={styles.metaRow}>
        <View style={styles.confidenceBadge}>
          <View style={[styles.confidenceDot, { backgroundColor: confidenceColor }]} />
          <Text style={[styles.confidenceText, { color: confidenceColor }]}>
            {Math.round(chain.confidence * 100)}% confidence
          </Text>
        </View>
        <Text style={styles.occurrences}>
          Seen {chain.occurrences}x
        </Text>
      </View>
    </Animated.View>
  );
}

function createStyles(theme: Theme, confidenceColor: string) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chainFlow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    eventBox: {
      flex: 1,
      alignItems: 'center',
    },
    eventIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    eventLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.textPrimary,
      textAlign: 'center',
    },
    arrowContainer: {
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    arrowLine: {
      width: 24,
      height: 2,
      backgroundColor: theme.border,
      marginBottom: -1,
    },
    arrowHead: {
      marginTop: -9,
    },
    lagText: {
      fontSize: 10,
      color: theme.textSecondary,
      marginTop: 2,
    },
    narrative: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 18,
      marginBottom: 10,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    confidenceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    confidenceDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 6,
    },
    confidenceText: {
      fontSize: 11,
      fontWeight: '500',
    },
    occurrences: {
      fontSize: 11,
      color: theme.textSecondary,
    },
  });
}
