/**
 * SleepPerformanceCard - Rich sleep visualization
 *
 * Features:
 * - Horizontal bar chart for sleep stages (deep/REM/core)
 * - Efficiency percentage prominent
 * - Bed/wake times
 * - vs target comparison
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Theme } from '../../theme/colors';
import { spacing, borderRadius, shadows, typography } from '../../theme/designSystem';

interface SleepData {
  totalHours: number;
  targetHours?: number;
  efficiency?: number;
  deepHours?: number;
  remHours?: number;
  coreHours?: number;
  bedTime?: string;
  wakeTime?: string;
}

interface SleepPerformanceCardProps {
  theme: Theme;
  data: SleepData;
  showStages?: boolean;
}

const STAGE_COLORS = {
  deep: '#6366F1',   // Indigo
  rem: '#8B5CF6',    // Purple
  core: '#A78BFA',   // Light purple
};

function formatHours(hours: number): string {
  const wholeHours = Math.floor(hours);
  const mins = Math.round((hours - wholeHours) * 60);
  return `${wholeHours}h ${mins}m`;
}

function formatTime(timeString: string | undefined): string {
  if (!timeString) return '--:--';
  try {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return timeString;
  }
}

export default function SleepPerformanceCard({
  theme,
  data,
  showStages = true,
}: SleepPerformanceCardProps): React.ReactElement {
  const {
    totalHours,
    targetHours = 8,
    efficiency,
    deepHours = 0,
    remHours = 0,
    coreHours = 0,
    bedTime,
    wakeTime,
  } = data;

  const progressPercent = Math.min((totalHours / targetHours) * 100, 100);
  const hasStages = deepHours > 0 || remHours > 0 || coreHours > 0;

  const styles = createStyles(theme);

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconContainer, { backgroundColor: theme.accent + '20' }]}>
            <Ionicons name="moon" size={24} color={theme.accent} />
          </View>
          <View>
            <Text style={styles.title}>Sleep</Text>
            <Text style={styles.subtitle}>Last night</Text>
          </View>
        </View>

        {efficiency !== undefined && efficiency > 0 && (
          <View style={[styles.efficiencyBadge, { backgroundColor: theme.accentLight }]}>
            <Text style={[styles.efficiencyValue, { color: theme.accent }]}>
              {Math.round(efficiency)}%
            </Text>
            <Text style={[styles.efficiencyLabel, { color: theme.accent }]}>Efficiency</Text>
          </View>
        )}
      </View>

      {/* Main Sleep Duration */}
      <View style={styles.durationSection}>
        <Text style={styles.durationValue}>{formatHours(totalHours)}</Text>
        <View style={styles.targetRow}>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPercent}%`, backgroundColor: theme.accent },
                ]}
              />
            </View>
          </View>
          <Text style={styles.targetText}>
            {progressPercent >= 100 ? 'Goal reached' : `${Math.round(progressPercent)}% of ${targetHours}h goal`}
          </Text>
        </View>
      </View>

      {/* Sleep Stages Bar */}
      {showStages && hasStages && (
        <View style={styles.stagesSection}>
          <Text style={styles.sectionLabel}>Sleep Stages</Text>
          <View style={styles.stagesBar}>
            {deepHours > 0 && (
              <View
                style={[
                  styles.stageFill,
                  {
                    flex: deepHours,
                    backgroundColor: STAGE_COLORS.deep,
                    borderTopLeftRadius: 4,
                    borderBottomLeftRadius: 4,
                  },
                ]}
              />
            )}
            {remHours > 0 && (
              <View
                style={[
                  styles.stageFill,
                  { flex: remHours, backgroundColor: STAGE_COLORS.rem },
                ]}
              />
            )}
            {coreHours > 0 && (
              <View
                style={[
                  styles.stageFill,
                  {
                    flex: coreHours,
                    backgroundColor: STAGE_COLORS.core,
                    borderTopRightRadius: 4,
                    borderBottomRightRadius: 4,
                  },
                ]}
              />
            )}
          </View>

          {/* Stage Legend */}
          <View style={styles.stageLegend}>
            {deepHours > 0 && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STAGE_COLORS.deep }]} />
                <Text style={styles.legendLabel}>Deep</Text>
                <Text style={styles.legendValue}>{formatHours(deepHours)}</Text>
              </View>
            )}
            {remHours > 0 && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STAGE_COLORS.rem }]} />
                <Text style={styles.legendLabel}>REM</Text>
                <Text style={styles.legendValue}>{formatHours(remHours)}</Text>
              </View>
            )}
            {coreHours > 0 && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STAGE_COLORS.core }]} />
                <Text style={styles.legendLabel}>Core</Text>
                <Text style={styles.legendValue}>{formatHours(coreHours)}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Bed/Wake Times */}
      {(bedTime || wakeTime) && (
        <View style={styles.timesSection}>
          <View style={styles.timeItem}>
            <Ionicons name="bed-outline" size={16} color={theme.textSecondary} />
            <Text style={styles.timeLabel}>Bedtime</Text>
            <Text style={styles.timeValue}>{formatTime(bedTime)}</Text>
          </View>
          <View style={styles.timeDivider} />
          <View style={styles.timeItem}>
            <Ionicons name="sunny-outline" size={16} color={theme.textSecondary} />
            <Text style={styles.timeLabel}>Wake</Text>
            <Text style={styles.timeValue}>{formatTime(wakeTime)}</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      ...shadows.sm,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    subtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    efficiencyBadge: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    efficiencyValue: {
      fontSize: 20,
      fontWeight: '700',
    },
    efficiencyLabel: {
      fontSize: 10,
      fontWeight: '500',
      marginTop: 2,
      textTransform: 'uppercase',
    },
    durationSection: {
      marginBottom: spacing.lg,
    },
    durationValue: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: spacing.sm,
    },
    targetRow: {
      gap: spacing.sm,
    },
    progressBarContainer: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      backgroundColor: theme.border,
      borderRadius: 4,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    targetText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    stagesSection: {
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      marginBottom: spacing.md,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.textSecondary,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    stagesBar: {
      flexDirection: 'row',
      height: 12,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    stageFill: {
      height: '100%',
    },
    stageLegend: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    legendItem: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendLabel: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    legendValue: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    timesSection: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    timeItem: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    timeLabel: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    timeValue: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    timeDivider: {
      width: 1,
      height: 40,
      backgroundColor: theme.border,
    },
  });
}
