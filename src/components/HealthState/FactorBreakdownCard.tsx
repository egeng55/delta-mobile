/**
 * FactorBreakdownCard - Shows what contributes to recovery/energy scores
 *
 * Features:
 * - List of factors with visual progress indicators
 * - Positive/negative impact with colored badges
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

const IMPACT_CONFIG = {
  positive: {
    color: '#22C55E',
    bgColor: '#22C55E15',
    icon: 'trending-up' as const,
    label: 'Helping',
  },
  negative: {
    color: '#EF4444',
    bgColor: '#EF444415',
    icon: 'trending-down' as const,
    label: 'Hurting',
  },
  neutral: {
    color: '#6B7280',
    bgColor: '#6B728015',
    icon: 'remove' as const,
    label: 'Neutral',
  },
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

  // Sort factors by impact: positive first, then neutral, then negative
  const sortedFactors = [...factors].sort((a, b) => {
    const order = { positive: 0, neutral: 1, negative: 2 };
    return order[a.impact] - order[b.impact];
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {sortedFactors.map((factor, index) => {
        const isExpanded = expandedIndex === index;
        const config = IMPACT_CONFIG[factor.impact];

        return (
          <Animated.View
            key={factor.name}
            entering={FadeInDown.delay(index * 50).duration(300)}
          >
            <TouchableOpacity
              style={[styles.factorItem, { borderLeftColor: config.color }]}
              onPress={() => factor.description && toggleExpand(index)}
              activeOpacity={factor.description ? 0.7 : 1}
            >
              <View style={styles.factorContent}>
                {/* Left side: Icon + Name */}
                <View style={styles.factorMain}>
                  <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
                    <Ionicons name={config.icon} size={18} color={config.color} />
                  </View>
                  <View style={styles.factorInfo}>
                    <Text style={styles.factorName}>{factor.name}</Text>
                    {factor.value && (
                      <Text style={[styles.factorValueSmall, { color: config.color }]}>
                        {factor.value}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Right side: Impact Badge */}
                <View style={[styles.impactBadge, { backgroundColor: config.bgColor }]}>
                  <Text style={[styles.impactBadgeText, { color: config.color }]}>
                    {config.label}
                  </Text>
                </View>

                {factor.description && (
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.textSecondary}
                    style={styles.chevron}
                  />
                )}
              </View>

              {/* Visual strength indicator */}
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBackground}>
                  <Animated.View
                    style={[
                      styles.strengthFill,
                      {
                        width: `${Math.min(factor.contribution, 100)}%`,
                        backgroundColor: config.color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.strengthLabel}>
                  {Math.round(factor.contribution)}% impact
                </Text>
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

      {/* Legend */}
      <View style={styles.legend}>
        {(['positive', 'neutral', 'negative'] as const).map((impact) => {
          const config = IMPACT_CONFIG[impact];
          return (
            <View key={impact} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: config.color }]} />
              <Text style={styles.legendText}>{config.label}</Text>
            </View>
          );
        })}
      </View>
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
      marginBottom: spacing.lg,
    },
    factorItem: {
      backgroundColor: theme.background,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderLeftWidth: 3,
    },
    factorContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    factorMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    factorInfo: {
      flex: 1,
    },
    factorName: {
      fontSize: compact ? 13 : 14,
      color: theme.textPrimary,
      fontWeight: '600',
    },
    factorValueSmall: {
      fontSize: 11,
      fontWeight: '500',
      marginTop: 2,
    },
    impactBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
    },
    impactBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    chevron: {
      marginLeft: spacing.sm,
    },
    strengthContainer: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    strengthBackground: {
      flex: 1,
      height: 6,
      backgroundColor: theme.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    strengthFill: {
      height: '100%',
      borderRadius: 3,
    },
    strengthLabel: {
      fontSize: 10,
      color: theme.textSecondary,
      fontWeight: '500',
      minWidth: 55,
      textAlign: 'right',
    },
    descriptionContainer: {
      marginTop: spacing.md,
      padding: spacing.sm,
      backgroundColor: theme.surfaceSecondary ?? theme.surface,
      borderRadius: borderRadius.sm,
    },
    description: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.lg,
      paddingTop: spacing.md,
      marginTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 11,
      color: theme.textSecondary,
    },
  });
}
