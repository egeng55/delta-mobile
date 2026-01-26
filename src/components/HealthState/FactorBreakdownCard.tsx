/**
 * FactorBreakdownCard - Shows what contributes to recovery/energy scores
 *
 * Features:
 * - List of factors with contribution bars
 * - Positive/negative impact indicators
 * - Tap to expand for explanation
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Theme } from '../../theme/colors';
import { spacing, borderRadius, shadows } from '../../theme/designSystem';

interface Factor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  contribution: number; // 0-100 representing relative contribution
  description?: string;
  value?: string;
}

interface FactorBreakdownCardProps {
  theme: Theme;
  title: string;
  factors: Factor[];
  compact?: boolean;
}

const IMPACT_COLORS = {
  positive: '#22C55E',
  negative: '#EF4444',
  neutral: '#6B7280',
};

const IMPACT_ICONS = {
  positive: 'arrow-up',
  negative: 'arrow-down',
  neutral: 'remove',
};

export default function FactorBreakdownCard({
  theme,
  title,
  factors,
  compact = false,
}: FactorBreakdownCardProps): React.ReactElement {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const styles = createStyles(theme, compact);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {factors.map((factor, index) => {
        const isExpanded = expandedIndex === index;
        const color = IMPACT_COLORS[factor.impact];
        const icon = IMPACT_ICONS[factor.impact];

        return (
          <Animated.View
            key={factor.name}
            entering={FadeInDown.delay(index * 50).duration(300)}
          >
            <TouchableOpacity
              style={styles.factorItem}
              onPress={() => factor.description && toggleExpand(index)}
              activeOpacity={factor.description ? 0.7 : 1}
            >
              <View style={styles.factorHeader}>
                <View style={[styles.impactIndicator, { backgroundColor: color + '20' }]}>
                  <Ionicons name={icon as any} size={14} color={color} />
                </View>
                <Text style={styles.factorName}>{factor.name}</Text>
                {factor.value && (
                  <Text style={[styles.factorValue, { color }]}>{factor.value}</Text>
                )}
                {factor.description && (
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.textSecondary}
                  />
                )}
              </View>

              {/* Contribution bar */}
              <View style={styles.contributionBar}>
                <View
                  style={[
                    styles.contributionFill,
                    {
                      width: `${factor.contribution}%`,
                      backgroundColor: color,
                    },
                  ]}
                />
              </View>

              {/* Expanded description */}
              {isExpanded && factor.description && (
                <Animated.View entering={FadeInUp.duration(200)} style={styles.descriptionContainer}>
                  <Text style={styles.description}>{factor.description}</Text>
                </Animated.View>
              )}
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

function createStyles(theme: Theme, compact: boolean) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: compact ? spacing.md : spacing.lg,
      ...shadows.sm,
    },
    title: {
      fontSize: compact ? 12 : 14,
      fontWeight: '600',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.md,
    },
    factorItem: {
      marginBottom: spacing.md,
    },
    factorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    impactIndicator: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    factorName: {
      flex: 1,
      fontSize: compact ? 13 : 14,
      color: theme.textPrimary,
      fontWeight: '500',
    },
    factorValue: {
      fontSize: compact ? 12 : 13,
      fontWeight: '600',
    },
    contributionBar: {
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      marginLeft: 32,
      overflow: 'hidden',
    },
    contributionFill: {
      height: '100%',
      borderRadius: 2,
    },
    descriptionContainer: {
      marginTop: spacing.sm,
      marginLeft: 32,
      padding: spacing.sm,
      backgroundColor: theme.surfaceSecondary,
      borderRadius: borderRadius.sm,
    },
    description: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 18,
    },
  });
}
