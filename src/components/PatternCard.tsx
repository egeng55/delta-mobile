/**
 * PatternCard - Causal chain display for the You screen.
 *
 * Shows discovered cause-effect relationships:
 *   Sleep <6.5h -> Energy -1.2 | Next day | 73% | 8/9 times
 *
 * Tap to expand: prediction history, belief evolution, Delta's explanation.
 * Uses frosted glass aesthetic for AI-generated content.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Theme } from '../theme/colors';
import { LearnedChain } from '../services/api';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface PatternCardProps {
  theme: Theme;
  chain: LearnedChain;
  index?: number;
}

const EVENT_LABELS: Record<string, string> = {
  sleep_hours: 'Sleep',
  sleep_quality: 'Sleep Quality',
  energy_level: 'Energy',
  stress_level: 'Stress',
  soreness_level: 'Soreness',
  alcohol_drinks: 'Alcohol',
  had_workout: 'Workout',
  cumulative_sleep_debt: 'Sleep Debt',
  calories_total: 'Calories',
  protein_grams: 'Protein',
  hydration_liters: 'Hydration',
};

export default function PatternCard({
  theme,
  chain,
  index = 0,
}: PatternCardProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const causeLabel = EVENT_LABELS[chain.cause] || chain.cause;
  const effectLabel = EVENT_LABELS[chain.effect] || chain.effect;
  const lagText = chain.lag_days === 0 ? 'Same day' : chain.lag_days === 1 ? 'Next day' : `+${chain.lag_days} days`;
  const confidencePct = Math.round(chain.confidence * 100);

  // Confidence color
  const confidenceColor = chain.confidence >= 0.7
    ? theme.success
    : chain.confidence >= 0.5
    ? theme.warning
    : theme.textSecondary;

  // Trend indicator from belief history
  const trend = useMemo(() => {
    const bh = chain.belief_history;
    if (!bh || bh.length < 2) return null;
    const last = bh[bh.length - 1].confidence;
    const prev = bh[bh.length - 2].confidence;
    if (last > prev + 0.02) return 'up' as const;
    if (last < prev - 0.02) return 'down' as const;
    return null;
  }, [chain.belief_history]);

  const handlePress = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(!expanded);
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <Pressable
        style={styles.container}
        onPress={handlePress}
      >
        {/* Compact pattern summary */}
        <View style={styles.summaryRow}>
          <Text style={styles.causeText}>{causeLabel}</Text>
          <View style={styles.arrowContainer}>
            <Ionicons name="arrow-forward" size={14} color={theme.textSecondary} />
          </View>
          <Text style={styles.effectText}>{effectLabel}</Text>
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
            <Text style={styles.metaText}>{lagText}</Text>
          </View>
          <View style={styles.metaItem}>
            <View style={[styles.confidenceDot, { backgroundColor: confidenceColor }]} />
            <Text style={[styles.metaText, { color: confidenceColor }]}>{confidencePct}%</Text>
            {trend && (
              <Ionicons
                name={trend === 'up' ? 'arrow-up' : 'arrow-down'}
                size={10}
                color={trend === 'up' ? theme.success : theme.warning}
              />
            )}
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="checkmark-circle-outline" size={12} color={theme.textSecondary} />
            <Text style={styles.metaText}>
              {chain.times_verified}/{chain.total_occurrences}
            </Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.textSecondary}
          />
        </View>

        {/* Expanded content */}
        {expanded && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.expandedContent}>
            {/* Narrative */}
            <Text style={styles.narrative}>{chain.narrative}</Text>

            {/* Why this happens */}
            {chain.why && (
              <View style={styles.explanationBox}>
                <Text style={styles.explanationLabel}>Why this happens</Text>
                <Text style={styles.explanationText}>{chain.why}</Text>
              </View>
            )}

            {/* Advice */}
            {chain.advice && (
              <View style={styles.adviceBox}>
                <Ionicons name="bulb-outline" size={14} color={theme.accent} />
                <Text style={styles.adviceText}>{chain.advice}</Text>
              </View>
            )}

            {/* Confidence bar */}
            <View style={styles.confidenceBar}>
              <View style={styles.confidenceTrack}>
                <View
                  style={[
                    styles.confidenceFill,
                    {
                      width: `${confidencePct}%`,
                      backgroundColor: confidenceColor,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.confidenceLabel, { color: confidenceColor }]}>
                {confidencePct}% confidence
              </Text>
            </View>

            {/* Belief history if available */}
            {chain.belief_history && chain.belief_history.length > 1 && (
              <View style={styles.beliefHistory}>
                <Text style={styles.beliefTitle}>Confidence over time</Text>
                <View style={styles.beliefBars}>
                  {chain.belief_history.slice(-8).map((entry, i) => (
                    <View key={i} style={styles.beliefBarWrapper}>
                      <View
                        style={[
                          styles.beliefBar,
                          {
                            height: Math.max(entry.confidence * 40, 2),
                            backgroundColor: theme.accent,
                            opacity: 0.4 + (i / chain.belief_history!.length) * 0.6,
                          },
                        ]}
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    causeText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    arrowContainer: {
      marginHorizontal: 8,
    },
    effectText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    confidenceDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    expandedContent: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    narrative: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 18,
      marginBottom: 12,
    },
    explanationBox: {
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 10,
      marginBottom: 10,
    },
    explanationLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    explanationText: {
      fontSize: 13,
      color: theme.textPrimary,
      lineHeight: 18,
    },
    adviceBox: {
      flexDirection: 'row',
      backgroundColor: theme.accent + '10',
      borderRadius: 8,
      padding: 10,
      marginBottom: 10,
      gap: 8,
    },
    adviceText: {
      flex: 1,
      fontSize: 13,
      color: theme.accent,
      lineHeight: 18,
    },
    confidenceBar: {
      marginBottom: 8,
    },
    confidenceTrack: {
      height: 4,
      backgroundColor: theme.background,
      borderRadius: 2,
      marginBottom: 4,
    },
    confidenceFill: {
      height: 4,
      borderRadius: 2,
    },
    confidenceLabel: {
      fontSize: 11,
      fontWeight: '500',
    },
    beliefHistory: {
      marginTop: 8,
    },
    beliefTitle: {
      fontSize: 11,
      color: theme.textSecondary,
      marginBottom: 6,
      fontWeight: '500',
    },
    beliefBars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 40,
      gap: 3,
    },
    beliefBarWrapper: {
      flex: 1,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    beliefBar: {
      width: '70%',
      borderRadius: 2,
      minHeight: 2,
    },
  });
}
