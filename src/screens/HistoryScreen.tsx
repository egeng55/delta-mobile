/**
 * HistoryScreen - Trends-focused historical data (WHOOP-style)
 *
 * Shows:
 * - Weekly Trends as Hero (large interactive chart)
 * - Domain Tabs: Nutrition / Activity / Sleep / Recovery
 * - Expanded metric selection
 * - Calendar as secondary navigation
 * - Period comparisons: This week vs last week
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
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
import { DailyLog, FlowIntensity, MenstrualSymptom } from '../services/api';
import * as menstrualService from '../services/menstrualTracking';
import LineChart, { DataPoint } from '../components/LineChart';
import { MetricComparisonCard } from '../components/Metrics';

interface HistoryScreenProps {
  theme: Theme;
  isFocused?: boolean;
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

// Domain types and metrics
type Domain = 'nutrition' | 'activity' | 'sleep' | 'recovery';

interface MetricConfig {
  key: string;
  label: string;
  unit: string;
  domain: Domain;
  icon: string;
  iconColor: string;
  higherIsBetter: boolean;
  decimals: number;
}

const METRICS: MetricConfig[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', domain: 'nutrition', icon: 'flame', iconColor: '#F97316', higherIsBetter: false, decimals: 0 },
  { key: 'protein', label: 'Protein', unit: 'g', domain: 'nutrition', icon: 'nutrition', iconColor: '#EF4444', higherIsBetter: true, decimals: 0 },
  { key: 'carbs', label: 'Carbs', unit: 'g', domain: 'nutrition', icon: 'leaf', iconColor: '#22C55E', higherIsBetter: false, decimals: 0 },
  { key: 'fat', label: 'Fat', unit: 'g', domain: 'nutrition', icon: 'water', iconColor: '#EAB308', higherIsBetter: false, decimals: 0 },
  { key: 'steps', label: 'Steps', unit: '', domain: 'activity', icon: 'footsteps', iconColor: '#3B82F6', higherIsBetter: true, decimals: 0 },
  { key: 'workout_minutes', label: 'Workout', unit: 'min', domain: 'activity', icon: 'barbell', iconColor: '#8B5CF6', higherIsBetter: true, decimals: 0 },
  { key: 'active_calories', label: 'Active Cal', unit: 'kcal', domain: 'activity', icon: 'flame-outline', iconColor: '#F97316', higherIsBetter: true, decimals: 0 },
  { key: 'sleep_hours', label: 'Sleep', unit: 'h', domain: 'sleep', icon: 'moon', iconColor: '#6366F1', higherIsBetter: true, decimals: 1 },
  { key: 'sleep_efficiency', label: 'Efficiency', unit: '%', domain: 'sleep', icon: 'analytics', iconColor: '#8B5CF6', higherIsBetter: true, decimals: 0 },
  { key: 'deep_sleep', label: 'Deep Sleep', unit: 'h', domain: 'sleep', icon: 'bed', iconColor: '#4F46E5', higherIsBetter: true, decimals: 1 },
  { key: 'hrv', label: 'HRV', unit: 'ms', domain: 'recovery', icon: 'pulse', iconColor: '#8B5CF6', higherIsBetter: true, decimals: 0 },
  { key: 'resting_hr', label: 'Resting HR', unit: 'bpm', domain: 'recovery', icon: 'heart', iconColor: '#EF4444', higherIsBetter: false, decimals: 0 },
];

const DOMAIN_LABELS: Record<Domain, { label: string; icon: string; color: string }> = {
  nutrition: { label: 'Nutrition', icon: 'restaurant', color: '#22C55E' },
  activity: { label: 'Activity', icon: 'fitness', color: '#3B82F6' },
  sleep: { label: 'Sleep', icon: 'moon', color: '#6366F1' },
  recovery: { label: 'Recovery', icon: 'heart', color: '#EF4444' },
};

export default function HistoryScreen({ theme, isFocused = true }: HistoryScreenProps): React.ReactElement {
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

  // Domain and metric selection
  const [selectedDomain, setSelectedDomain] = useState<Domain>('nutrition');
  const [selectedMetricKey, setSelectedMetricKey] = useState<string>('calories');
  const [showCalendar, setShowCalendar] = useState(false);

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null);

  // Period logging modal
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [periodModalDate, setPeriodModalDate] = useState('');
  const [selectedFlow, setSelectedFlow] = useState<FlowIntensity>('medium');
  const [selectedSymptoms, setSelectedSymptoms] = useState<MenstrualSymptom[]>([]);
  const [isSavingPeriod, setIsSavingPeriod] = useState(false);

  const userId = user?.id ?? 'anonymous';
  const wasFocused = useRef(isFocused);

  // Get current metric config
  const currentMetric = useMemo(() => {
    return METRICS.find(m => m.key === selectedMetricKey) ?? METRICS[0];
  }, [selectedMetricKey]);

  // Filter metrics by domain
  const domainMetrics = useMemo(() => {
    return METRICS.filter(m => m.domain === selectedDomain);
  }, [selectedDomain]);

  // Update selected metric when domain changes
  useEffect(() => {
    const firstMetricInDomain = METRICS.find(m => m.domain === selectedDomain);
    if (firstMetricInDomain) {
      setSelectedMetricKey(firstMetricInDomain.key);
    }
  }, [selectedDomain]);

  useEffect(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth() + 1;
    fetchCalendarData(year, month);
  }, [calendarDate, fetchCalendarData]);

  // Refresh data when tab becomes focused
  useEffect(() => {
    if (isFocused && !wasFocused.current) {
      const year = calendarDate.getFullYear();
      const month = calendarDate.getMonth() + 1;
      fetchCalendarData(year, month, true);
    }
    wasFocused.current = isFocused;
  }, [isFocused, calendarDate, fetchCalendarData]);

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

  // Build chart data for selected metric
  const chartData = useMemo((): DataPoint[] => {
    if (weeklySummaries.length === 0) return [];

    return weeklySummaries.slice(-7).map(summary => {
      const date = new Date(summary.date);
      const label = DAY_NAMES[date.getDay()];
      const summaryAny = summary as any;
      let value: number | null = summaryAny[selectedMetricKey] ?? null;

      // Handle special cases
      if (selectedMetricKey === 'calories' && value === 0) value = null;
      if (selectedMetricKey === 'protein' && value === 0) value = null;
      if (selectedMetricKey === 'sleep_hours' && value === 0) value = null;

      return { label, value };
    });
  }, [weeklySummaries, selectedMetricKey]);

  // Calculate this week vs last week comparison
  const weekComparison = useMemo(() => {
    if (weeklySummaries.length < 7) return null;

    const thisWeek = weeklySummaries.slice(-7);
    const lastWeek = weeklySummaries.slice(-14, -7);

    if (lastWeek.length === 0) return null;

    const getAverage = (data: typeof weeklySummaries, key: string): number => {
      const validData = data.filter(d => (d as any)[key] != null && (d as any)[key] > 0);
      if (validData.length === 0) return 0;
      return validData.reduce((sum, d) => sum + ((d as any)[key] ?? 0), 0) / validData.length;
    };

    const thisWeekAvg = getAverage(thisWeek, selectedMetricKey);
    const lastWeekAvg = getAverage(lastWeek, selectedMetricKey);

    return {
      thisWeek: thisWeekAvg,
      lastWeek: lastWeekAvg,
      change: lastWeekAvg > 0 ? ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100 : 0,
    };
  }, [weeklySummaries, selectedMetricKey]);

  // Get weekly averages for comparison cards
  const weeklyStats = useMemo(() => {
    const thisWeek = weeklySummaries.slice(-7);

    const getStats = (key: string) => {
      const validData = thisWeek.filter(d => (d as any)[key] != null && (d as any)[key] > 0);
      if (validData.length === 0) return { current: 0, average: 0 };
      const total = validData.reduce((sum, d) => sum + ((d as any)[key] ?? 0), 0);
      const avg = total / validData.length;
      const latest = validData[validData.length - 1];
      return {
        current: latest ? (latest as any)[key] ?? 0 : 0,
        average: avg,
      };
    };

    return {
      calories: getStats('calories'),
      protein: getStats('protein'),
      sleep_hours: getStats('sleep_hours'),
      steps: getStats('steps'),
    };
  }, [weeklySummaries]);

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
        <Text style={styles.headerTitle}>Trends</Text>
        <Text style={styles.headerSubtitle}>Track your progress over time</Text>
      </View>

      {/* Domain Tabs */}
      <Animated.View entering={FadeInDown.delay(50).duration(400)} style={styles.domainTabs}>
        {(Object.keys(DOMAIN_LABELS) as Domain[]).map(domain => {
          const config = DOMAIN_LABELS[domain];
          const isActive = selectedDomain === domain;
          return (
            <TouchableOpacity
              key={domain}
              style={[
                styles.domainTab,
                isActive && { backgroundColor: config.color + '20', borderColor: config.color },
              ]}
              onPress={() => setSelectedDomain(domain)}
            >
              <Ionicons
                name={config.icon as any}
                size={16}
                color={isActive ? config.color : theme.textSecondary}
              />
              <Text style={[styles.domainTabText, isActive && { color: config.color }]}>
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </Animated.View>

      {/* Hero: Weekly Trends Chart */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.heroSection}>
        <View style={styles.heroCard}>
          {/* Metric Selection */}
          <View style={styles.metricTabs}>
            {domainMetrics.map(metric => (
              <TouchableOpacity
                key={metric.key}
                style={[
                  styles.metricTab,
                  selectedMetricKey === metric.key && styles.metricTabActive,
                ]}
                onPress={() => setSelectedMetricKey(metric.key)}
              >
                <Text
                  style={[
                    styles.metricTabText,
                    selectedMetricKey === metric.key && styles.metricTabTextActive,
                  ]}
                >
                  {metric.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Chart */}
          <View style={styles.chartWrapper}>
            {chartData.some(d => d.value !== null) ? (
              <LineChart
                data={chartData}
                width={SCREEN_WIDTH - spacing.lg * 4}
                height={180}
                color={currentMetric.iconColor}
                backgroundColor={theme.surface}
                textColor={theme.textPrimary}
                secondaryTextColor={theme.textSecondary}
              />
            ) : (
              <View style={styles.chartEmpty}>
                <Ionicons name={currentMetric.icon as any} size={40} color={theme.textSecondary} />
                <Text style={styles.chartEmptyText}>No {currentMetric.label.toLowerCase()} data yet</Text>
                <Text style={styles.chartEmptyHint}>Log via chat or connect Apple Health</Text>
              </View>
            )}
          </View>

          {/* Week-over-Week Comparison */}
          {weekComparison && weekComparison.thisWeek > 0 && (
            <View style={styles.weekComparison}>
              <View style={styles.weekCompareRow}>
                <Text style={styles.weekCompareLabel}>This Week Avg</Text>
                <Text style={styles.weekCompareValue}>
                  {currentMetric.decimals > 0
                    ? weekComparison.thisWeek.toFixed(currentMetric.decimals)
                    : Math.round(weekComparison.thisWeek).toLocaleString()}
                  {currentMetric.unit && ` ${currentMetric.unit}`}
                </Text>
              </View>
              {weekComparison.lastWeek > 0 && (
                <View style={styles.weekCompareRow}>
                  <Text style={styles.weekCompareLabel}>vs Last Week</Text>
                  <View style={styles.weekChangeContainer}>
                    <Ionicons
                      name={weekComparison.change >= 0 ? 'arrow-up' : 'arrow-down'}
                      size={14}
                      color={
                        (currentMetric.higherIsBetter && weekComparison.change >= 0) ||
                        (!currentMetric.higherIsBetter && weekComparison.change < 0)
                          ? '#22C55E'
                          : '#EF4444'
                      }
                    />
                    <Text
                      style={[
                        styles.weekChangeText,
                        {
                          color:
                            (currentMetric.higherIsBetter && weekComparison.change >= 0) ||
                            (!currentMetric.higherIsBetter && weekComparison.change < 0)
                              ? '#22C55E'
                              : '#EF4444',
                        },
                      ]}
                    >
                      {Math.abs(weekComparison.change).toFixed(1)}%
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </Animated.View>

      {/* Quick Stats Row */}
      <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.quickStatsSection}>
        <Text style={styles.sectionTitle}>Today's Snapshot</Text>
        <View style={styles.quickStatsRow}>
          {weeklyStats.calories.current > 0 && (
            <View style={styles.quickStatCard}>
              <MetricComparisonCard
                theme={theme}
                label="Calories"
                currentValue={weeklyStats.calories.current}
                comparisonValue={weeklyStats.calories.average}
                comparisonBasis="7-day avg"
                unit="kcal"
                icon="flame"
                iconColor="#F97316"
                higherIsBetter={false}
                compact={true}
              />
            </View>
          )}
          {weeklyStats.sleep_hours.current > 0 && (
            <View style={styles.quickStatCard}>
              <MetricComparisonCard
                theme={theme}
                label="Sleep"
                currentValue={weeklyStats.sleep_hours.current}
                comparisonValue={weeklyStats.sleep_hours.average}
                comparisonBasis="7-day avg"
                unit="h"
                icon="moon"
                iconColor="#6366F1"
                higherIsBetter={true}
                decimals={1}
                compact={true}
              />
            </View>
          )}
        </View>
      </Animated.View>

      {/* Cycle Phase (if menstrual tracking enabled) */}
      {menstrualSettings?.tracking_enabled && cyclePhase && (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.cycleCard}>
          <View style={[styles.cycleIcon, { backgroundColor: '#E5737320' }]}>
            <Ionicons name="flower-outline" size={24} color="#E57373" />
          </View>
          <View style={styles.cycleInfo}>
            <Text style={styles.cyclePhase}>{cyclePhase.phase.replace('_', ' ')}</Text>
            <Text style={styles.cycleDay}>Day {cyclePhase.day_in_cycle} of cycle</Text>
          </View>
        </Animated.View>
      )}

      {/* Calendar Section (Collapsible) */}
      <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.calendarSection}>
        <TouchableOpacity
          style={styles.calendarToggle}
          onPress={() => setShowCalendar(!showCalendar)}
        >
          <View style={styles.calendarToggleLeft}>
            <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
            <Text style={styles.calendarToggleText}>Monthly Calendar</Text>
          </View>
          <Ionicons
            name={showCalendar ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        {showCalendar && (
          <Animated.View entering={FadeInDown.duration(300)}>
            {renderCalendar()}
          </Animated.View>
        )}
      </Animated.View>

      {/* Selected Day Details */}
      {selectedDate && showCalendar && (
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
      paddingBottom: spacing.md,
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
    // Domain Tabs
    domainTabs: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    domainTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    domainTabText: {
      ...typography.labelSmall,
      color: theme.textSecondary,
    },
    // Hero Section
    heroSection: {
      marginBottom: spacing.lg,
    },
    heroCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      ...shadows.sm,
    },
    metricTabs: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
      flexWrap: 'wrap',
    },
    metricTab: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
      backgroundColor: theme.surfaceSecondary,
    },
    metricTabActive: {
      backgroundColor: theme.accent,
    },
    metricTabText: {
      ...typography.labelSmall,
      color: theme.textSecondary,
    },
    metricTabTextActive: {
      color: '#fff',
    },
    chartWrapper: {
      marginVertical: spacing.sm,
    },
    chartEmpty: {
      height: 180,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.sm,
    },
    chartEmptyText: {
      ...typography.bodyMedium,
      color: theme.textSecondary,
    },
    chartEmptyHint: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    weekComparison: {
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: spacing.sm,
    },
    weekCompareRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    weekCompareLabel: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    weekCompareValue: {
      ...typography.labelMedium,
      color: theme.textPrimary,
      fontWeight: '600',
    },
    weekChangeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    weekChangeText: {
      ...typography.labelSmall,
      fontWeight: '600',
    },
    // Quick Stats
    quickStatsSection: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      ...typography.labelLarge,
      color: theme.textSecondary,
      marginBottom: spacing.md,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    quickStatsRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    quickStatCard: {
      flex: 1,
    },
    // Cycle Card
    cycleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadows.sm,
    },
    cycleIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
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
    // Calendar Section
    calendarSection: {
      marginBottom: spacing.lg,
    },
    calendarToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      ...shadows.sm,
    },
    calendarToggleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    calendarToggleText: {
      ...typography.labelMedium,
      color: theme.textSecondary,
    },
    calendarContainer: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginTop: spacing.md,
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
    // Selected Day
    selectedDay: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
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
    // Modal
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
