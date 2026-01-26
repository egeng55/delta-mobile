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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Theme } from '../theme/colors';
import { spacing, typography, borderRadius, shadows } from '../theme/designSystem';
import { useInsightsData } from '../hooks/useInsightsData';
import { useUnits } from '../context/UnitsContext';
import { useHealthKit } from '../context/HealthKitContext';
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

  const { isMetric, volumeUnit } = useUnits();

  // Use centralized HealthKit context for Apple Watch data
  const { hasWatchData, healthData, refreshHealthData } = useHealthKit();

  const wasFocused = useRef(isFocused);

  // Date navigation state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calendar helpers
  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay();
  };

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleCalendarDateSelect = (date: Date) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

  const isToday = useMemo(() => {
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    return selected.getTime() === today.getTime();
  }, [selectedDate, today]);

  const canGoForward = useMemo(() => {
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    return selected.getTime() < today.getTime();
  }, [selectedDate, today]);

  const canGoBack = useMemo(() => {
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - 6);
    minDate.setHours(0, 0, 0, 0);
    return selected.getTime() > minDate.getTime();
  }, [selectedDate, today]);

  const goToPreviousDay = () => {
    if (canGoBack) {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() - 1);
      setSelectedDate(newDate);
    }
  };

  const goToNextDay = () => {
    if (canGoForward) {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + 1);
      setSelectedDate(newDate);
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Refresh data when tab becomes focused
  useEffect(() => {
    if (isFocused && !wasFocused.current) {
      fetchAnalyticsData(true);
      if (hasWatchData) {
        refreshHealthData();
      }
    }
    wasFocused.current = isFocused;
  }, [isFocused, fetchAnalyticsData, hasWatchData, refreshHealthData]);

  // Format selected date for display
  const dateDisplay = useMemo(() => {
    return {
      dayName: selectedDate.toLocaleDateString('en-US', { weekday: 'long' }),
      dateStr: selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  }, [selectedDate]);

  // Get summary for selected date
  const selectedSummary = useMemo(() => {
    if (isToday) {
      return todaySummary;
    }
    // Find summary for selected date in weeklySummaries
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    const historicalSummary = weeklySummaries.find(s => s.date === selectedDateStr);
    if (historicalSummary) {
      return {
        calories: historicalSummary.calories ?? 0,
        protein: historicalSummary.protein ?? 0,
        water_oz: historicalSummary.water_oz ?? 0,
      };
    }
    return null;
  }, [isToday, todaySummary, selectedDate, weeklySummaries]);

  const progress = useMemo(() => {
    const summary = selectedSummary;
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
  }, [selectedSummary, targets]);

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

  // Get quick stats for selected date
  const quickStats = useMemo(() => {
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    const daySummary = weeklySummaries.find(s => s.date === selectedDateStr);
    return {
      sleepHours: daySummary?.sleep_hours ?? null,
      sleepQuality: daySummary?.sleep_quality ?? null,
    };
  }, [weeklySummaries, selectedDate]);

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
      // Handle both numeric and string quality values
      const qualityValue = factors.sleep_quality;
      let numericQuality: number;
      let displayValue: string;

      if (typeof qualityValue === 'number') {
        numericQuality = qualityValue;
        displayValue = `${qualityValue}/10`;
      } else if (typeof qualityValue === 'string') {
        // Map string values to numbers
        const qualityMap: Record<string, number> = {
          'excellent': 9, 'great': 8, 'good': 7, 'fair': 5, 'poor': 3, 'bad': 2
        };
        numericQuality = qualityMap[qualityValue.toLowerCase()] ?? 5;
        displayValue = qualityValue.charAt(0).toUpperCase() + qualityValue.slice(1);
      } else {
        numericQuality = 5;
        displayValue = 'Unknown';
      }

      result.push({
        name: 'Sleep Quality',
        impact: numericQuality >= 6 ? 'positive' as const : 'negative' as const,
        contribution: Math.max(0, Math.min(100, (numericQuality / 10) * 100)),
        value: displayValue,
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
    <>
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
      {/* Header with Date Navigation */}
      <View style={styles.header}>
        <View style={styles.dateNavRow}>
          <TouchableOpacity
            style={[styles.dateArrow, !canGoBack && styles.dateArrowDisabled]}
            onPress={goToPreviousDay}
            disabled={!canGoBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={canGoBack ? theme.textPrimary : theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowCalendar(true)} style={styles.dateCenter}>
            <Text style={styles.dayName}>{dateDisplay.dayName}</Text>
            <View style={styles.dateRow}>
              <Text style={styles.date}>{dateDisplay.dateStr}</Text>
              <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateArrow, !canGoForward && styles.dateArrowDisabled]}
            onPress={goToNextDay}
            disabled={!canGoForward}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={canGoForward ? theme.textPrimary : theme.textSecondary}
            />
          </TouchableOpacity>
        </View>
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
        {(quickStats.sleepHours !== null || (hasWatchData && healthData.sleep)) && (
          <View style={styles.quickStatItem}>
            <Ionicons name="moon-outline" size={16} color={theme.accent} />
            <Text style={styles.quickStatValue}>
              {hasWatchData && healthData.sleep
                ? healthData.sleep.totalSleepHours.toFixed(1)
                : quickStats.sleepHours?.toFixed(1) ?? '--'}h
            </Text>
            <Text style={styles.quickStatLabel}>Sleep</Text>
          </View>
        )}
        <View style={styles.quickStatItem}>
          <Ionicons name="pulse-outline" size={16} color="#8B5CF6" />
          <Text style={styles.quickStatValue}>
            {hasWatchData && healthData.hrv
              ? Math.round(healthData.hrv.hrvMs)
              : '--'}
          </Text>
          <Text style={styles.quickStatLabel}>HRV</Text>
        </View>
        <View style={styles.quickStatItem}>
          <Ionicons name="heart-outline" size={16} color="#EF4444" />
          <Text style={styles.quickStatValue}>
            {hasWatchData && healthData.restingHeartRate
              ? healthData.restingHeartRate.bpm
              : '--'}
          </Text>
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
              <Text style={styles.legendValue}>
                {isMetric
                  ? `${Math.round(progress.water.current * 29.57)}/${Math.round(targets.water_oz * 29.57)} ml`
                  : `${Math.round(progress.water.current)}/${targets.water_oz} oz`
                }
              </Text>
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

      {/* Action Card - only show for today */}
      {isToday && (
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

    {/* Calendar Modal */}
    <Modal
      visible={showCalendar}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setShowCalendar(false)}
    >
      <Pressable
        style={styles.calendarModalOverlay}
        onPress={() => setShowCalendar(false)}
      >
        <Pressable style={styles.calendarModalContent} onPress={e => e.stopPropagation()}>
          {/* Month Navigation */}
          <View style={styles.calendarNav}>
            <TouchableOpacity
              onPress={() => {
                const newMonth = new Date(calendarMonth);
                newMonth.setMonth(newMonth.getMonth() - 1);
                setCalendarMonth(newMonth);
              }}
              style={styles.calendarNavButton}
            >
              <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.calendarMonthTitle}>
              {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity
              onPress={() => {
                const newMonth = new Date(calendarMonth);
                newMonth.setMonth(newMonth.getMonth() + 1);
                // Don't go past current month
                if (newMonth <= new Date()) {
                  setCalendarMonth(newMonth);
                }
              }}
              style={styles.calendarNavButton}
            >
              <Ionicons name="chevron-forward" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Day Headers */}
          <View style={styles.calendarWeek}>
            {DAY_NAMES.map(day => (
              <View key={day} style={styles.calendarDayCell}>
                <Text style={styles.calendarDayHeader}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          {(() => {
            const year = calendarMonth.getFullYear();
            const month = calendarMonth.getMonth();
            const daysInMonth = getDaysInMonth(year, month);
            const firstDay = getFirstDayOfMonth(year, month);
            const todayStr = today.toISOString().split('T')[0];

            const weeks: React.ReactNode[] = [];
            let days: React.ReactNode[] = [];

            // Empty cells before first day
            for (let i = 0; i < firstDay; i++) {
              days.push(<View key={`empty-${i}`} style={styles.calendarDayCell} />);
            }

            // Days of month
            for (let day = 1; day <= daysInMonth; day++) {
              const date = new Date(year, month, day);
              const dateStr = date.toISOString().split('T')[0];
              const isTodayDate = dateStr === todayStr;
              const isSelected = dateStr === selectedDate.toISOString().split('T')[0];
              const isFuture = date > today;

              days.push(
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.calendarDayCell,
                    isTodayDate && styles.calendarDayToday,
                    isSelected && styles.calendarDaySelected,
                  ]}
                  onPress={() => !isFuture && handleCalendarDateSelect(date)}
                  disabled={isFuture}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      isTodayDate && styles.calendarDayTextToday,
                      isSelected && styles.calendarDayTextSelected,
                      isFuture && styles.calendarDayTextFuture,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );

              if ((firstDay + day) % 7 === 0 || day === daysInMonth) {
                weeks.push(
                  <View key={`week-${weeks.length}`} style={styles.calendarWeek}>
                    {days}
                  </View>
                );
                days = [];
              }
            }

            return weeks;
          })()}

          {/* Today Button */}
          <TouchableOpacity
            style={styles.calendarTodayButton}
            onPress={() => {
              setSelectedDate(new Date());
              setCalendarMonth(new Date());
              setShowCalendar(false);
            }}
          >
            <Text style={styles.calendarTodayButtonText}>Go to Today</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
    </>
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
    dateNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    },
    dateArrow: {
      padding: spacing.sm,
      borderRadius: borderRadius.full,
    },
    dateArrowDisabled: {
      opacity: 0.3,
    },
    dateCenter: {
      alignItems: 'center',
      flex: 1,
    },
    todayHint: {
      fontSize: 11,
      color: theme.accent,
      marginTop: spacing.xxs,
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
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    // Calendar Modal Styles
    calendarModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    calendarModalContent: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      width: '100%',
      maxWidth: 360,
    },
    calendarNav: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    calendarNavButton: {
      padding: spacing.sm,
    },
    calendarMonthTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    calendarWeek: {
      flexDirection: 'row',
    },
    calendarDayCell: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      margin: 2,
    },
    calendarDayHeader: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    calendarDayText: {
      fontSize: 14,
      color: theme.textPrimary,
    },
    calendarDayToday: {
      backgroundColor: theme.accentLight,
      borderRadius: 20,
    },
    calendarDayTextToday: {
      color: theme.accent,
      fontWeight: '600',
    },
    calendarDaySelected: {
      backgroundColor: theme.accent,
      borderRadius: 20,
    },
    calendarDayTextSelected: {
      color: '#fff',
      fontWeight: '600',
    },
    calendarDayTextFuture: {
      color: theme.textSecondary,
      opacity: 0.4,
    },
    calendarTodayButton: {
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: theme.accent,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    calendarTodayButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
  });
}
