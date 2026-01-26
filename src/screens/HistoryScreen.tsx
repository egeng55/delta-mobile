/**
 * HistoryScreen - Calendar and historical data
 *
 * Shows:
 * - Monthly calendar with activity dots
 * - Daily log details on selection
 * - Menstrual tracking (if enabled)
 * - Weekly trends chart
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Theme } from '../theme/colors';
import { spacing, typography, borderRadius, shadows } from '../theme/designSystem';
import { useInsightsData } from '../hooks/useInsightsData';
import { useAuth } from '../context/AuthContext';
import { DailyLog, MenstrualCalendarDay, FlowIntensity, MenstrualSymptom } from '../services/api';
import * as menstrualService from '../services/menstrualTracking';
import LineChart, { DataPoint } from '../components/LineChart';

interface HistoryScreenProps {
  theme: Theme;
}

// Calendar helpers
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month, 1).getDay();
};

const formatMonthYear = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function HistoryScreen({ theme }: HistoryScreenProps): React.ReactElement {
  const { user } = useAuth();
  const {
    monthLogs,
    weeklySummaries,
    menstrualSettings,
    menstrualCalendar,
    cyclePhase,
    calendarLoading,
    fetchCalendarData,
  } = useInsightsData();

  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null);
  const [selectedChartMetric, setSelectedChartMetric] = useState<'calories' | 'protein' | 'sleep'>('calories');

  // Period logging modal
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [periodModalDate, setPeriodModalDate] = useState('');
  const [selectedFlow, setSelectedFlow] = useState<FlowIntensity>('medium');
  const [selectedSymptoms, setSelectedSymptoms] = useState<MenstrualSymptom[]>([]);
  const [isSavingPeriod, setIsSavingPeriod] = useState(false);

  const userId = user?.id ?? 'anonymous';

  useEffect(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth() + 1;
    fetchCalendarData(year, month);
  }, [calendarDate, fetchCalendarData]);

  // Pre-indexed maps for O(1) lookup
  const logsMap = useMemo(() => {
    return new Map(monthLogs.map(log => [log.date, log]));
  }, [monthLogs]);

  const menstrualDayMap = useMemo(() => {
    return new Map(menstrualCalendar.map(d => [d.date, d]));
  }, [menstrualCalendar]);

  const handlePrevMonth = () => {
    setCalendarDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
    setSelectedDate(null);
    setSelectedLog(null);
  };

  const handleNextMonth = () => {
    setCalendarDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
    setSelectedDate(null);
    setSelectedLog(null);
  };

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedLog(logsMap.get(dateStr) ?? null);
  };

  const openPeriodModal = (date: string) => {
    setPeriodModalDate(date);
    setSelectedFlow('medium');
    setSelectedSymptoms([]);
    setShowPeriodModal(true);
  };

  const savePeriodLog = async () => {
    if (!periodModalDate || !userId) return;

    setIsSavingPeriod(true);
    try {
      await menstrualService.logEvent(
        userId,
        periodModalDate,
        'period_start',
        selectedFlow,
        selectedSymptoms.length > 0 ? selectedSymptoms : undefined
      );
      setShowPeriodModal(false);
      const year = calendarDate.getFullYear();
      const month = calendarDate.getMonth() + 1;
      fetchCalendarData(year, month, true);
      Alert.alert('Logged', 'Period start logged successfully.');
    } catch {
      Alert.alert('Error', 'Could not save period log.');
    } finally {
      setIsSavingPeriod(false);
    }
  };

  // Build chart data
  const chartData = useMemo((): DataPoint[] => {
    if (weeklySummaries.length === 0) return [];

    return weeklySummaries.slice(-7).map(summary => {
      const date = new Date(summary.date);
      const label = DAY_NAMES[date.getDay()];
      let value: number | null = null;

      switch (selectedChartMetric) {
        case 'calories':
          value = summary.calories > 0 ? summary.calories : null;
          break;
        case 'protein':
          value = summary.protein > 0 ? summary.protein : null;
          break;
        case 'sleep':
          value = summary.sleep_hours;
          break;
      }

      return { label, value };
    });
  }, [weeklySummaries, selectedChartMetric]);

  // Render calendar
  const renderCalendar = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = getLocalDateString();

    const weeks: React.ReactNode[] = [];
    let days: React.ReactNode[] = [];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const log = logsMap.get(dateStr);
      const menstrualDay = menstrualDayMap.get(dateStr);
      const isToday = dateStr === today;
      const isSelected = dateStr === selectedDate;

      const hasMeals = log && log.meals && log.meals.length > 0;
      const hasWorkouts = log && log.workout_plan_id !== null;
      const hasSleep = log && log.sleep_hours !== null && log.sleep_hours > 0;
      const isPeriod = menstrualDay?.is_period === true;
      const isPredictedPeriod = menstrualDay?.is_predicted_period === true;

      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            isToday && styles.calendarDayToday,
            isSelected && styles.calendarDaySelected,
            isPeriod && styles.calendarDayPeriod,
            isPredictedPeriod && !isPeriod && styles.calendarDayPredicted,
          ]}
          onPress={() => handleSelectDate(dateStr)}
          onLongPress={() => {
            if (menstrualSettings?.tracking_enabled) {
              openPeriodModal(dateStr);
            }
          }}
        >
          <Text
            style={[
              styles.calendarDayText,
              isToday && styles.calendarDayTextToday,
              isSelected && styles.calendarDayTextSelected,
              isPeriod && styles.calendarDayTextPeriod,
            ]}
          >
            {day}
          </Text>
          <View style={styles.calendarDots}>
            {hasMeals && <View style={[styles.calendarDot, { backgroundColor: theme.success }]} />}
            {hasWorkouts && <View style={[styles.calendarDot, { backgroundColor: theme.accent }]} />}
            {hasSleep && <View style={[styles.calendarDot, { backgroundColor: theme.warning }]} />}
          </View>
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

    return (
      <View style={styles.calendarContainer}>
        {/* Month Navigation */}
        <View style={styles.calendarNav}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.calendarMonth}>{formatMonthYear(calendarDate)}</Text>
          <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Day Headers */}
        <View style={styles.calendarWeek}>
          {DAY_NAMES.map(day => (
            <View key={day} style={styles.calendarDay}>
              <Text style={styles.calendarDayHeader}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        {weeks}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
            <Text style={styles.legendText}>Meals</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.accent }]} />
            <Text style={styles.legendText}>Workout</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.warning }]} />
            <Text style={styles.legendText}>Sleep</Text>
          </View>
        </View>
      </View>
    );
  };

  const styles = createStyles(theme);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={calendarLoading}
          onRefresh={() => {
            const year = calendarDate.getFullYear();
            const month = calendarDate.getMonth() + 1;
            fetchCalendarData(year, month, true);
          }}
          tintColor={theme.accent}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
      </View>

      {/* Cycle Phase (if menstrual tracking enabled) */}
      {menstrualSettings?.tracking_enabled && cyclePhase && (
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={styles.cycleCard}>
          <View style={[styles.cycleIcon, { backgroundColor: '#E5737320' }]}>
            <Ionicons name="flower-outline" size={20} color="#E57373" />
          </View>
          <View style={styles.cycleInfo}>
            <Text style={styles.cyclePhase}>{cyclePhase.phase.replace('_', ' ')}</Text>
            <Text style={styles.cycleDay}>Day {cyclePhase.day_in_cycle}</Text>
          </View>
        </Animated.View>
      )}

      {/* Calendar */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        {renderCalendar()}
      </Animated.View>

      {/* Selected Day Details */}
      {selectedDate && (
        <Animated.View entering={FadeInUp.duration(300)} style={styles.selectedDay}>
          <Text style={styles.selectedDayTitle}>
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </Text>

          {selectedLog ? (
            <View style={styles.logDetails}>
              {selectedLog.meals && selectedLog.meals.length > 0 && (
                <View style={styles.logSection}>
                  <View style={styles.logSectionHeader}>
                    <Ionicons name="restaurant" size={16} color={theme.success} />
                    <Text style={styles.logSectionTitle}>Meals</Text>
                  </View>
                  {selectedLog.meals.map((meal, i) => (
                    <Text key={i} style={styles.logItem}>
                      {meal.meal}: {meal.description || 'No description'}
                      {meal.calories_est && ` - ${meal.calories_est} cal`}
                    </Text>
                  ))}
                </View>
              )}

              {selectedLog.workout_plan_id && (
                <View style={styles.logSection}>
                  <View style={styles.logSectionHeader}>
                    <Ionicons name="barbell" size={16} color={theme.accent} />
                    <Text style={styles.logSectionTitle}>Workout</Text>
                  </View>
                  <Text style={styles.logItem}>Workout completed</Text>
                </View>
              )}

              {selectedLog.sleep_hours !== null && selectedLog.sleep_hours > 0 && (
                <View style={styles.logSection}>
                  <View style={styles.logSectionHeader}>
                    <Ionicons name="moon" size={16} color={theme.warning} />
                    <Text style={styles.logSectionTitle}>Sleep</Text>
                  </View>
                  <Text style={styles.logItem}>
                    {selectedLog.sleep_hours} hours
                    {selectedLog.sleep_quality !== null && ` - Quality: ${selectedLog.sleep_quality}/10`}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noLogState}>
              <Ionicons name="calendar-outline" size={32} color={theme.textSecondary} />
              <Text style={styles.noLogText}>No logs for this day</Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* Weekly Trends Chart */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.chartSection}>
        <Text style={styles.sectionTitle}>Weekly Trends</Text>

        <View style={styles.chartMetrics}>
          {(['calories', 'protein', 'sleep'] as const).map(metric => (
            <TouchableOpacity
              key={metric}
              style={[
                styles.metricChip,
                selectedChartMetric === metric && styles.metricChipActive,
              ]}
              onPress={() => setSelectedChartMetric(metric)}
            >
              <Text
                style={[
                  styles.metricChipText,
                  selectedChartMetric === metric && styles.metricChipTextActive,
                ]}
              >
                {metric.charAt(0).toUpperCase() + metric.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {chartData.some(d => d.value !== null) ? (
          <LineChart
            data={chartData}
            width={SCREEN_WIDTH - spacing.lg * 4}
            height={160}
            color={theme.accent}
            backgroundColor={theme.surface}
            textColor={theme.textPrimary}
            secondaryTextColor={theme.textSecondary}
          />
        ) : (
          <View style={styles.chartEmpty}>
            <Text style={styles.chartEmptyText}>No data for this period</Text>
          </View>
        )}
      </Animated.View>

      {/* Period Modal */}
      <Modal
        visible={showPeriodModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPeriodModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPeriodModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Log Period</Text>
            <TouchableOpacity onPress={savePeriodLog} disabled={isSavingPeriod}>
              <Text style={[styles.modalSave, isSavingPeriod && { opacity: 0.5 }]}>
                {isSavingPeriod ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDate}>
              {periodModalDate && new Date(periodModalDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>

            <Text style={styles.modalLabel}>Flow Intensity</Text>
            <View style={styles.flowOptions}>
              {(['light', 'medium', 'heavy'] as FlowIntensity[]).map(flow => (
                <TouchableOpacity
                  key={flow}
                  style={[
                    styles.flowOption,
                    selectedFlow === flow && styles.flowOptionSelected,
                  ]}
                  onPress={() => setSelectedFlow(flow)}
                >
                  <Text
                    style={[
                      styles.flowOptionText,
                      selectedFlow === flow && styles.flowOptionTextSelected,
                    ]}
                  >
                    {flow.charAt(0).toUpperCase() + flow.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    header: {
      paddingBottom: spacing.lg,
    },
    headerTitle: {
      ...typography.headline,
      color: theme.textPrimary,
    },
    headerSubtitle: {
      ...typography.bodyMedium,
      color: theme.textSecondary,
      marginTop: spacing.xs,
    },
    cycleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
      ...shadows.sm,
    },
    cycleIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cycleInfo: {
      marginLeft: spacing.md,
    },
    cyclePhase: {
      ...typography.labelMedium,
      color: theme.textPrimary,
      textTransform: 'capitalize',
    },
    cycleDay: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    calendarContainer: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      ...shadows.sm,
    },
    calendarNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    navButton: {
      padding: spacing.sm,
    },
    calendarMonth: {
      ...typography.subtitle,
      color: theme.textPrimary,
    },
    calendarWeek: {
      flexDirection: 'row',
    },
    calendarDay: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
    },
    calendarDayHeader: {
      ...typography.caption,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    calendarDayText: {
      ...typography.bodySmall,
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
    calendarDayPeriod: {
      backgroundColor: '#E5737330',
      borderRadius: 20,
    },
    calendarDayPredicted: {
      backgroundColor: '#E5737315',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#E5737350',
      borderStyle: 'dashed',
    },
    calendarDayTextPeriod: {
      color: '#C62828',
      fontWeight: '600',
    },
    calendarDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 2,
      marginTop: 2,
      minHeight: 4,
    },
    calendarDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.lg,
      marginTop: spacing.md,
      paddingTop: spacing.md,
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
      ...typography.caption,
      color: theme.textSecondary,
    },
    selectedDay: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      ...shadows.sm,
    },
    selectedDayTitle: {
      ...typography.subtitle,
      color: theme.textPrimary,
      marginBottom: spacing.md,
    },
    logDetails: {
      gap: spacing.md,
    },
    logSection: {
      gap: spacing.xs,
    },
    logSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    logSectionTitle: {
      ...typography.labelMedium,
      color: theme.textPrimary,
    },
    logItem: {
      ...typography.bodySmall,
      color: theme.textSecondary,
      marginLeft: spacing.xl,
    },
    noLogState: {
      alignItems: 'center',
      padding: spacing.xl,
    },
    noLogText: {
      ...typography.bodySmall,
      color: theme.textSecondary,
      marginTop: spacing.md,
    },
    chartSection: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      ...typography.labelLarge,
      color: theme.textSecondary,
      marginBottom: spacing.md,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    chartMetrics: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    metricChip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.lg,
      backgroundColor: theme.surface,
    },
    metricChipActive: {
      backgroundColor: theme.accent,
    },
    metricChipText: {
      ...typography.labelSmall,
      color: theme.textSecondary,
    },
    metricChipTextActive: {
      color: '#fff',
    },
    chartEmpty: {
      height: 160,
      backgroundColor: theme.surface,
      borderRadius: borderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chartEmptyText: {
      ...typography.bodySmall,
      color: theme.textSecondary,
    },
    modalContainer: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalCancel: {
      ...typography.bodyMedium,
      color: theme.textSecondary,
    },
    modalTitle: {
      ...typography.subtitle,
      color: theme.textPrimary,
    },
    modalSave: {
      ...typography.bodyMedium,
      color: theme.accent,
      fontWeight: '600',
    },
    modalContent: {
      flex: 1,
      padding: spacing.lg,
    },
    modalDate: {
      ...typography.title,
      color: theme.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.xxl,
    },
    modalLabel: {
      ...typography.labelMedium,
      color: theme.textSecondary,
      marginBottom: spacing.md,
    },
    flowOptions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    flowOption: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: theme.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    flowOptionSelected: {
      backgroundColor: '#E5737320',
      borderColor: '#E57373',
    },
    flowOptionText: {
      ...typography.labelMedium,
      color: theme.textSecondary,
    },
    flowOptionTextSelected: {
      color: '#C62828',
    },
  });
}
