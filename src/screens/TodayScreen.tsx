/**
 * TodayScreen - WHOOP-inspired daily summary
 *
 * Features:
 * - Large circular progress rings
 * - Bold metric displays
 * - Clean dark aesthetic
 * - Health state cards
 */

import React, { useEffect, useMemo } from 'react';
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
import { spacing, typography, borderRadius } from '../theme/designSystem';
import { useInsightsData } from '../hooks/useInsightsData';
import { CircularProgress, StackedRings } from '../components/CircularProgress';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TodayScreenProps {
  theme: Theme;
  onNavigateToActivity?: () => void;
  onNavigateToRecovery?: () => void;
  onNavigateToHistory?: () => void;
}

export default function TodayScreen({
  theme,
  onNavigateToActivity,
  onNavigateToRecovery,
  onNavigateToHistory,
}: TodayScreenProps): React.ReactElement {
  const {
    todaySummary,
    targets,
    targetsPersonalized,
    targetsInfo,
    healthState,
    analyticsLoading,
    fetchAnalyticsData,
  } = useInsightsData();

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

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

      {/* Main Progress Ring */}
      <Animated.View entering={FadeIn.delay(100).duration(600)} style={styles.mainRingContainer}>
        <StackedRings
          size={SCREEN_WIDTH * 0.55}
          strokeWidth={14}
          gap={6}
          theme={theme}
          rings={[
            { progress: progress.calories.percent, color: theme.warning, label: 'Calories' },
            { progress: progress.protein.percent, color: theme.success, label: 'Protein' },
            { progress: progress.water.percent, color: theme.accent, label: 'Water' },
          ]}
        />
        <View style={styles.ringCenter}>
          <Text style={styles.ringPercent}>{overallProgress}</Text>
          <Text style={styles.ringPercentSign}>%</Text>
        </View>
        <Text style={styles.ringLabel}>Daily Progress</Text>
      </Animated.View>

      {/* Metric Cards */}
      <View style={styles.metricsRow}>
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.metricCard}>
          <View style={[styles.metricIcon, { backgroundColor: theme.warning + '20' }]}>
            <Ionicons name="flame" size={20} color={theme.warning} />
          </View>
          <Text style={styles.metricValue}>{Math.round(progress.calories.current)}</Text>
          <Text style={styles.metricTarget}>/ {targets.calories} cal</Text>
          <View style={styles.metricBar}>
            <View
              style={[styles.metricBarFill, {
                width: `${progress.calories.percent * 100}%`,
                backgroundColor: theme.warning,
              }]}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.metricCard}>
          <View style={[styles.metricIcon, { backgroundColor: theme.success + '20' }]}>
            <Ionicons name="nutrition" size={20} color={theme.success} />
          </View>
          <Text style={styles.metricValue}>{Math.round(progress.protein.current)}</Text>
          <Text style={styles.metricTarget}>/ {targets.protein}g</Text>
          <View style={styles.metricBar}>
            <View
              style={[styles.metricBarFill, {
                width: `${progress.protein.percent * 100}%`,
                backgroundColor: theme.success,
              }]}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.metricCard}>
          <View style={[styles.metricIcon, { backgroundColor: theme.accent + '20' }]}>
            <Ionicons name="water" size={20} color={theme.accent} />
          </View>
          <Text style={styles.metricValue}>{Math.round(progress.water.current)}</Text>
          <Text style={styles.metricTarget}>/ {targets.water_oz} oz</Text>
          <View style={styles.metricBar}>
            <View
              style={[styles.metricBarFill, {
                width: `${progress.water.percent * 100}%`,
                backgroundColor: theme.accent,
              }]}
            />
          </View>
        </Animated.View>
      </View>

      {/* Workout Day Banner */}
      {targetsInfo.isWorkoutDay && (
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.workoutBanner}>
          <Ionicons name="barbell" size={18} color={theme.success} />
          <Text style={styles.workoutBannerText}>Workout Day</Text>
          <Text style={styles.workoutBannerSub}>Targets adjusted for activity</Text>
        </Animated.View>
      )}

      {/* Health State Section */}
      {healthState?.has_data && (
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusRow}>
            {healthState.recovery && (
              <StatusPill
                theme={theme}
                icon="heart"
                label="Recovery"
                value={formatState(healthState.recovery.state)}
                color={getStateColor(healthState.recovery.state, theme)}
              />
            )}
            {healthState.energy && (
              <StatusPill
                theme={theme}
                icon="flash"
                label="Energy"
                value={formatState(healthState.energy.state)}
                color={getStateColor(healthState.energy.state, theme)}
              />
            )}
            {healthState.load && (
              <StatusPill
                theme={theme}
                icon="barbell"
                label="Load"
                value={formatState(healthState.load.state)}
                color={getLoadColor(healthState.load.state, theme)}
              />
            )}
          </View>
        </Animated.View>
      )}

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

// Status pill component
function StatusPill({
  theme,
  icon,
  label,
  value,
  color,
}: {
  theme: Theme;
  icon: string;
  label: string;
  value: string;
  color: string;
}): React.ReactElement {
  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      alignItems: 'center',
    }}>
      <View style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: color + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
      }}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={{
        fontSize: 11,
        color: theme.textSecondary,
        marginBottom: 2,
      }}>{label}</Text>
      <Text style={{
        fontSize: 14,
        fontWeight: '600',
        color: color,
      }}>{value}</Text>
    </View>
  );
}

// Format state labels
function formatState(state: string): string {
  return state
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Get color for recovery/energy states
function getStateColor(state: string, theme: Theme): string {
  if (state === 'recovered' || state === 'peak' || state === 'high') {
    return theme.success;
  }
  if (state === 'neutral' || state === 'moderate') {
    return theme.warning;
  }
  return theme.error;
}

// Get color for load states (inverted - low is good)
function getLoadColor(state: string, theme: Theme): string {
  if (state === 'low') return theme.success;
  if (state === 'moderate') return theme.warning;
  return theme.error;
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
      paddingBottom: spacing.xl,
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
    mainRingContainer: {
      alignItems: 'center',
      marginBottom: spacing.xxl,
    },
    ringCenter: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -40 }, { translateY: -30 }],
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    ringPercent: {
      fontSize: 48,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    ringPercentSign: {
      fontSize: 24,
      fontWeight: '600',
      color: theme.textSecondary,
      marginLeft: 2,
    },
    ringLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textSecondary,
      marginTop: spacing.md,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    metricCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      alignItems: 'center',
    },
    metricIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    metricValue: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    metricTarget: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    metricBar: {
      width: '100%',
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      marginTop: spacing.sm,
      overflow: 'hidden',
    },
    metricBarFill: {
      height: '100%',
      borderRadius: 2,
    },
    workoutBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.success + '15',
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.xl,
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
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.md,
    },
    statusRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    statsCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      flexDirection: 'row',
      justifyContent: 'space-around',
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
