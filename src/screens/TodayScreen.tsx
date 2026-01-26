/**
 * TodayScreen - WHOOP-inspired daily summary
 *
 * Features:
 * - Recovery and Strain gauges as hero elements
 * - Quick stats row (sleep, HRV, resting HR)
 * - Factor breakdown card
 * - Daily progress rings
 * - Action recommendations
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Theme } from '../theme/colors';
import { spacing, typography, borderRadius, shadows } from '../theme/designSystem';
import { useInsightsData } from '../hooks/useInsightsData';
import { StackedRings } from '../components/CircularProgress';
import { RecoveryGauge, StrainGauge } from '../components/Gauges';
import { FactorBreakdownCard } from '../components/HealthState';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TodayScreenProps {
  theme: Theme;
  isFocused?: boolean;
  onNavigateToRecovery?: () => void;
  onNavigateToHistory?: () => void;
}

export default function TodayScreen({
  theme,
  isFocused = true,
  onNavigateToRecovery,
  onNavigateToHistory,
}: TodayScreenProps): React.ReactElement {
  const {
    todaySummary,
    targets,
    targetsPersonalized,
    targetsInfo,
    healthState,
    weeklySummaries,
    analyticsLoading,
    fetchAnalyticsData,
  } = useInsightsData();

  const wasFocused = useRef(isFocused);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Refresh data when tab becomes focused
  useEffect(() => {
    if (isFocused && !wasFocused.current) {
      fetchAnalyticsData(true);
    }
    wasFocused.current = isFocused;
  }, [isFocused, fetchAnalyticsData]);

  const today = useMemo(() => {
    const date = new Date();
    return {
      dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
      dateStr: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  }, []);

  const progress = useMemo(() => {
    const summary = todaySummary;
    if (!summary) {
      return {
        calories: { current: 0, target: targets.calories, percent: 0 },
        protein: { current: 0, target: targets.protein, percent: 0 },
        water: { current: 0, target: targets.water_oz, percent: 0 },
      };
    }

    return {
      calories: {
        current: summary.calories,
        target: targets.calories,
        percent: Math.min(1, summary.calories / targets.calories),
      },
      protein: {
        current: summary.protein,
        target: targets.protein,
        percent: Math.min(1, summary.protein / targets.protein),
      },
      water: {
        current: summary.water_oz,
        target: targets.water_oz,
        percent: Math.min(1, summary.water_oz / targets.water_oz),
      },
    };
  }, [todaySummary, targets]);

  // Overall progress percentage
  const overallProgress = useMemo(() => {
    const avg = (progress.calories.percent + progress.protein.percent + progress.water.percent) / 3;
    return Math.round(avg * 100);
  }, [progress]);

  // Calculate recovery and strain scores from health state
  const recoveryScore = useMemo(() => {
    if (!healthState?.recovery) return 50;
    const state = healthState.recovery.state;
    if (state === 'recovered') return 75 + Math.random() * 25;
    if (state === 'neutral') return 45 + Math.random() * 20;
    return 15 + Math.random() * 20;
  }, [healthState?.recovery]);

  const strainScore = useMemo(() => {
    if (!healthState?.load) return 30;
    const state = healthState.load.state;
    if (state === 'high') return 70 + Math.random() * 30;
    if (state === 'moderate') return 40 + Math.random() * 25;
    return 10 + Math.random() * 25;
  }, [healthState?.load]);

  // Get quick stats from weekly summaries
  const quickStats = useMemo(() => {
    const lastNight = weeklySummaries[weeklySummaries.length - 1];
    return {
      sleepHours: lastNight?.sleep_hours ?? null,
      sleepQuality: lastNight?.sleep_quality ?? null,
    };
  }, [weeklySummaries]);

  // Build factors for factor breakdown
  const recoveryFactors = useMemo(() => {
    if (!healthState?.recovery?.factors) return [];
    const factors = healthState.recovery.factors;
    const result = [];

    if (factors.sleep_hours !== undefined) {
      result.push({
        name: 'Sleep Duration',
        impact: Number(factors.sleep_hours) >= 7 ? 'positive' as const : 'negative' as const,
        contribution: Math.min(100, (Number(factors.sleep_hours) / 8) * 100),
        value: `${factors.sleep_hours}h`,
        description: 'Adequate sleep (7-9 hours) is essential for recovery.',
      });
    }
    if (factors.sleep_quality !== undefined) {
      result.push({
        name: 'Sleep Quality',
        impact: Number(factors.sleep_quality) >= 6 ? 'positive' as const : 'negative' as const,
        contribution: (Number(factors.sleep_quality) / 10) * 100,
        value: `${factors.sleep_quality}/10`,
        description: 'Quality of sleep affects how well your body recovers.',
      });
    }
    if (factors.consistency !== undefined) {
      result.push({
        name: 'Consistency',
        impact: factors.consistency ? 'positive' as const : 'neutral' as const,
        contribution: factors.consistency ? 80 : 40,
        description: 'Consistent logging patterns help track recovery accurately.',
      });
    }

    return result;
  }, [healthState?.recovery?.factors]);

  const styles = createStyles(theme);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={analyticsLoading}
          onRefresh={() => fetchAnalyticsData(true)}
          tintColor={theme.accent}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.dayName}>{today.dayName}</Text>
        <Text style={styles.date}>{today.dateStr}</Text>
      </View>

      {/* Hero: Recovery & Strain Gauges */}
      <Animated.View entering={FadeIn.delay(100).duration(600)} style={styles.gaugesRow}>
        <TouchableOpacity style={styles.gaugeContainer} onPress={onNavigateToRecovery}>
          <RecoveryGauge
            score={recoveryScore}
            size={SCREEN_WIDTH * 0.38}
            theme={theme}
            label="Recovery"
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.gaugeContainer}>
          <StrainGauge
            score={strainScore}
            size={SCREEN_WIDTH * 0.38}
            theme={theme}
            label="Strain"
          />
        </TouchableOpacity>
      </Animated.View>

      {/* Quick Stats Row */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.quickStatsRow}>
        {quickStats.sleepHours !== null && (
          <View style={styles.quickStatItem}>
            <Ionicons name="moon-outline" size={16} color={theme.accent} />
            <Text style={styles.quickStatValue}>{quickStats.sleepHours.toFixed(1)}h</Text>
            <Text style={styles.quickStatLabel}>Sleep</Text>
          </View>
        )}
        <View style={styles.quickStatItem}>
          <Ionicons name="pulse-outline" size={16} color="#8B5CF6" />
          <Text style={styles.quickStatValue}>--</Text>
          <Text style={styles.quickStatLabel}>HRV</Text>
        </View>
        <View style={styles.quickStatItem}>
          <Ionicons name="heart-outline" size={16} color="#EF4444" />
          <Text style={styles.quickStatValue}>--</Text>
          <Text style={styles.quickStatLabel}>Resting HR</Text>
        </View>
      </Animated.View>

      {/* Factor Summary */}
      {recoveryFactors.length > 0 && (
        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.factorSection}>
          <FactorBreakdownCard
            theme={theme}
            title="Recovery Factors"
            factors={recoveryFactors}
            compact
          />
        </Animated.View>
      )}

      {/* Daily Progress Rings (smaller) */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.progressSection}>
        <Text style={styles.sectionTitle}>Daily Progress</Text>
        <View style={styles.progressCard}>
          <View style={styles.progressRingContainer}>
            <StackedRings
              size={100}
              strokeWidth={8}
              gap={3}
              theme={theme}
              rings={[
                { progress: progress.calories.percent, color: theme.warning, label: 'Calories' },
                { progress: progress.protein.percent, color: theme.success, label: 'Protein' },
                { progress: progress.water.percent, color: theme.accent, label: 'Water' },
              ]}
            />
            <View style={styles.progressRingCenter}>
              <Text style={styles.progressPercent}>{overallProgress}%</Text>
            </View>
          </View>

          <View style={styles.progressLegend}>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: theme.warning }]} />
              <Text style={styles.legendLabel}>Calories</Text>
              <Text style={styles.legendValue}>{Math.round(progress.calories.current)}/{targets.calories}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
              <Text style={styles.legendLabel}>Protein</Text>
              <Text style={styles.legendValue}>{Math.round(progress.protein.current)}g/{targets.protein}g</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: theme.accent }]} />
              <Text style={styles.legendLabel}>Water</Text>
              <Text style={styles.legendValue}>{Math.round(progress.water.current)}/{targets.water_oz} oz</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Workout Day Banner */}
      {targetsInfo.isWorkoutDay && (
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.workoutBanner}>
          <Ionicons name="barbell" size={18} color={theme.success} />
          <Text style={styles.workoutBannerText}>Workout Day</Text>
          <Text style={styles.workoutBannerSub}>Targets adjusted for activity</Text>
        </Animated.View>
      )}

      {/* Action Card */}
      <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.actionCard}>
        <View style={styles.actionIcon}>
          <Ionicons name="bulb" size={20} color={theme.accent} />
        </View>
        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>Focus for Today</Text>
          <Text style={styles.actionText}>
            {recoveryScore >= 67
              ? 'Great recovery! Consider a challenging workout today.'
              : recoveryScore >= 34
              ? 'Moderate recovery. A light to moderate workout is recommended.'
              : 'Low recovery. Focus on rest and gentle movement today.'}
          </Text>
        </View>
      </Animated.View>

      {/* Quick Stats */}
      {targetsInfo.tdee && (
        <Animated.View entering={FadeInDown.delay(450).duration(400)} style={styles.statsCard}>
          <View style={styles.statItem}>
            <Ionicons name="flash-outline" size={16} color={theme.textSecondary} />
            <Text style={styles.statLabel}>Daily burn</Text>
            <Text style={styles.statValue}>~{Math.round(targetsInfo.tdee)}</Text>
          </View>
          {targetsInfo.activityLevel && (
            <View style={styles.statItem}>
              <Ionicons name="speedometer-outline" size={16} color={theme.textSecondary} />
              <Text style={styles.statLabel}>Activity</Text>
              <Text style={styles.statValue}>{formatState(targetsInfo.activityLevel)}</Text>
            </View>
          )}
        </Animated.View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// Format state labels
function formatState(state: string): string {
  return state
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    header: {
      alignItems: 'center',
      paddingBottom: spacing.lg,
    },
    dayName: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    date: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.textPrimary,
      marginTop: spacing.xs,
    },
    gaugesRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: spacing.xl,
    },
    gaugeContainer: {
      alignItems: 'center',
    },
    quickStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
      ...shadows.sm,
    },
    quickStatItem: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    quickStatValue: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    quickStatLabel: {
      fontSize: 10,
      color: theme.textSecondary,
      textTransform: 'uppercase',
    },
    factorSection: {
      marginBottom: spacing.lg,
    },
    progressSection: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.md,
    },
    progressCard: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      ...shadows.sm,
    },
    progressRingContainer: {
      width: 100,
      height: 100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressRingCenter: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressPercent: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    progressLegend: {
      flex: 1,
      marginLeft: spacing.lg,
      gap: spacing.sm,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendLabel: {
      flex: 1,
      fontSize: 13,
      color: theme.textSecondary,
    },
    legendValue: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    workoutBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.success + '15',
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    workoutBannerText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.success,
      flex: 1,
    },
    workoutBannerSub: {
      fontSize: 12,
      color: theme.success,
      opacity: 0.8,
    },
    actionCard: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.md,
      ...shadows.sm,
    },
    actionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionContent: {
      flex: 1,
    },
    actionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: spacing.xs,
    },
    actionText: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    statsCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      flexDirection: 'row',
      justifyContent: 'space-around',
      ...shadows.sm,
    },
    statItem: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
    },
  });
}
