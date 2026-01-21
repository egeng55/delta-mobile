/**
 * InsightsScreen - Analytics, workout tracking, and calendar view.
 *
 * Calendar displays data parsed from chat conversations.
 * Analytics shows derivative trends and patterns.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInRight, FadeInUp } from 'react-native-reanimated';
import { AnimatedCard, AnimatedListItem, AnimatedProgress, AnimatedButton, FadeInView } from '../components/Animated';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useAccess } from '../context/AccessContext';
import {
  insightsApi,
  InsightsData,
  workoutApi,
  WorkoutPlan,
  Exercise,
  calendarApi,
  DailyLog,
  derivativesApi,
  DerivativesData,
  InsightCard as DerivativeCard,
} from '../services/api';

interface InsightsScreenProps {
  theme: Theme;
}

interface TrendCard {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  trend?: string | null;
  confidence?: number;
  direction?: 'improving' | 'declining' | 'stable' | 'volatile';
}

type TabType = 'analytics' | 'workout' | 'calendar';

// Calendar helper functions
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month, 1).getDay();
};

const formatMonthYear = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export default function InsightsScreen({ theme }: InsightsScreenProps): React.ReactNode {
  const { user } = useAuth();
  const { hasAccess, isLoading: accessLoading, openPricing, isDeveloper } = useAccess();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabType>('analytics');
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [derivatives, setDerivatives] = useState<DerivativesData | null>(null);
  const [derivativeCards, setDerivativeCards] = useState<DerivativeCard[]>([]);
  const [workout, setWorkout] = useState<WorkoutPlan | null>(null);
  const [monthLogs, setMonthLogs] = useState<DailyLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [weights, setWeights] = useState<Record<string, string>>({});

  const userId = user?.id ?? 'anonymous';

  const fetchData = useCallback(async (showRefreshIndicator: boolean = false): Promise<void> => {
    if (showRefreshIndicator === true) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError('');

    const defaultInsights: InsightsData = {
      user_id: userId,
      total_conversations: 0,
      topics_discussed: [],
      wellness_score: 0,
      streak_days: 0,
    };

    const defaultDerivatives: DerivativesData = {
      has_data: false,
      days_analyzed: 0,
      data_points: 0,
      date_range: { start: '', end: '' },
      metrics: {},
      composite: {
        physiological_momentum: {
          score: 0,
          label: 'insufficient_data',
          symbol: '→',
          confidence: 0,
          signals_analyzed: 0,
        },
      },
      recovery_patterns: {
        pattern: 'insufficient_data',
        description: 'Continue logging data to see recovery patterns.',
        insufficient_data: true,
      },
    };

    const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
      ]);
    };

    try {
      const year = calendarDate.getFullYear();
      const month = calendarDate.getMonth() + 1;

      const [insightsData, workoutData, derivativesData, cardsData, monthData] = await Promise.all([
        withTimeout(insightsApi.getInsights(userId), 5000, defaultInsights),
        withTimeout(workoutApi.getToday(userId), 5000, { workout: null }),
        withTimeout(derivativesApi.getDerivatives(userId, 30), 5000, defaultDerivatives),
        withTimeout(derivativesApi.getCards(userId, 14), 5000, { cards: [], count: 0 }),
        withTimeout(calendarApi.getMonthLogs(userId, year, month), 5000, { logs: [], days_count: 0, year, month }),
      ]);
      setInsights(insightsData);
      setWorkout(workoutData.workout);
      setDerivatives(derivativesData);
      setDerivativeCards(cardsData.cards);
      setMonthLogs(monthData.logs);
    } catch {
      setError('Could not load data');
      setInsights(defaultInsights);
      setDerivatives(defaultDerivatives);
      setDerivativeCards([]);
      setWorkout(null);
      setMonthLogs([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId, calendarDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = (): void => {
    fetchData(true);
  };

  const changeMonth = (delta: number): void => {
    const newDate = new Date(calendarDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCalendarDate(newDate);
    setSelectedDate(null);
    setSelectedLog(null);
  };

  const selectDate = (date: string): void => {
    setSelectedDate(date);
    const log = monthLogs.find(l => l.date === date) ?? null;
    setSelectedLog(log);
  };

  const generateWorkout = async (): Promise<void> => {
    setIsGenerating(true);
    setError('');
    try {
      const response = await workoutApi.recommend(userId);
      setWorkout(response.workout as WorkoutPlan);
    } catch {
      setError('Could not generate workout');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleExercise = async (exercise: Exercise): Promise<void> => {
    if (workout === null) return;
    try {
      if (exercise.completed === true) {
        await workoutApi.uncompleteExercise(exercise.exercise_id);
      } else {
        const weight = weights[exercise.exercise_id];
        await workoutApi.completeExercise(exercise.exercise_id, weight);
      }
      await fetchData();
      if (workout.status === 'pending') {
        await workoutApi.updateStatus(workout.plan_id, 'in_progress');
      }
    } catch {
      setError('Could not update exercise');
    }
  };

  const completeWorkout = async (): Promise<void> => {
    if (workout === null) return;
    const exercises = workout.exercise_details ?? [];
    const completedCount = exercises.filter(e => e.completed === true).length;

    if (completedCount < exercises.length) {
      Alert.alert(
        'Incomplete Workout',
        `You have ${exercises.length - completedCount} exercises remaining. Complete anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Complete', onPress: () => markWorkoutComplete() },
        ]
      );
    } else {
      markWorkoutComplete();
    }
  };

  const markWorkoutComplete = async (): Promise<void> => {
    if (workout === null) return;
    try {
      await workoutApi.updateStatus(workout.plan_id, 'completed');
      await fetchData();
      Alert.alert('Workout Complete!', 'Great job! Your workout has been logged.');
    } catch {
      setError('Could not complete workout');
    }
  };

  const getProgressPercentage = (): number => {
    if (workout === null) return 0;
    const exercises = workout.exercise_details ?? [];
    if (exercises.length === 0) return 0;
    const completed = exercises.filter(e => e.completed === true).length;
    return Math.round((completed / exercises.length) * 100);
  };

  const getMetricIcon = (metricKey: string): keyof typeof Ionicons.glyphMap => {
    const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
      sleep_quality: 'bed-outline',
      energy_level: 'flash-outline',
      stress_level: 'pulse-outline',
      soreness_level: 'fitness-outline',
    };
    return iconMap[metricKey] ?? 'analytics-outline';
  };

  const getDirectionColor = (direction?: string): string => {
    switch (direction) {
      case 'improving':
        return theme.success;
      case 'declining':
        return theme.error;
      case 'volatile':
        return theme.warning;
      case 'stable':
      default:
        return theme.accent;
    }
  };

  const buildTrendCards = (): TrendCard[] => {
    const cards: TrendCard[] = [];

    const momentum = derivatives?.composite?.physiological_momentum;
    if (momentum && momentum.label !== 'insufficient_data') {
      const momentumLabels: Record<string, string> = {
        strong_positive: 'Strong positive',
        positive: 'Positive',
        neutral: 'Neutral',
        negative: 'Needs attention',
        strong_negative: 'Review patterns',
      };
      cards.push({
        id: 'momentum',
        title: 'Momentum',
        value: momentum.symbol,
        subtitle: momentumLabels[momentum.label] ?? momentum.label,
        icon: 'trending-up',
        color: momentum.score > 0 ? theme.success : momentum.score < 0 ? theme.error : theme.accent,
        confidence: momentum.confidence,
        direction: momentum.score > 30 ? 'improving' : momentum.score < -30 ? 'declining' : 'stable',
      });
    }

    const metrics = derivatives?.metrics ?? {};
    Object.entries(metrics).forEach(([key, metric]) => {
      if (metric.insufficient_data === true) return;

      cards.push({
        id: key,
        title: metric.name,
        value: metric.symbol,
        subtitle: `${metric.direction.charAt(0).toUpperCase()}${metric.direction.slice(1)} • ${metric.stability}`,
        icon: getMetricIcon(key),
        color: getDirectionColor(metric.direction),
        trend: metric.symbol,
        confidence: metric.confidence,
        direction: metric.direction,
      });
    });

    const recovery = derivatives?.recovery_patterns;
    if (recovery && recovery.pattern && recovery.pattern !== 'insufficient_data' && recovery.pattern !== 'no_stress_events') {
      const recoveryLabels: Record<string, string> = {
        fast_recovery: 'Fast',
        moderate_recovery: 'Moderate',
        slow_recovery: 'Slow',
      };
      cards.push({
        id: 'recovery',
        title: 'Recovery',
        value: recovery.avg_days ? `${recovery.avg_days}d` : '→',
        subtitle: recoveryLabels[recovery.pattern] ?? recovery.description,
        icon: 'refresh-outline',
        color: recovery.pattern === 'fast_recovery' ? theme.success : recovery.pattern === 'slow_recovery' ? theme.warning : theme.accent,
      });
    }

    if (cards.length === 0) {
      cards.push(
        {
          id: 'conversations',
          title: 'Conversations',
          value: String(insights?.total_conversations ?? 0),
          subtitle: 'Total chats with Delta',
          icon: 'chatbubbles-outline',
          color: theme.accent,
        },
        {
          id: 'data_points',
          title: 'Data Points',
          value: String(derivatives?.data_points ?? 0),
          subtitle: 'Logged via chat',
          icon: 'analytics-outline',
          color: theme.success,
        }
      );
    }

    return cards;
  };

  const trendCards = buildTrendCards();

  // Build calendar grid
  const renderCalendar = (): React.ReactNode => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = new Date().toISOString().split('T')[0];

    const logDates = new Set(monthLogs.map(l => l.date));

    const weeks: React.ReactNode[] = [];
    let days: React.ReactNode[] = [];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasData = logDates.has(dateStr);
      const isToday = dateStr === today;
      const isSelected = dateStr === selectedDate;

      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            isToday && styles.calendarDayToday,
            isSelected && styles.calendarDaySelected,
          ]}
          onPress={() => selectDate(dateStr)}
        >
          <Text
            style={[
              styles.calendarDayText,
              isToday && styles.calendarDayTextToday,
              isSelected && styles.calendarDayTextSelected,
            ]}
          >
            {day}
          </Text>
          {hasData && <View style={[styles.calendarDot, { backgroundColor: theme.success }]} />}
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
      <View style={styles.calendarGrid}>
        {/* Month navigation */}
        <View style={styles.calendarNav}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.calendarNavButton}>
            <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.calendarMonth}>{formatMonthYear(calendarDate)}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.calendarNavButton}>
            <Ionicons name="chevron-forward" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Day headers */}
        <View style={styles.calendarWeek}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <View key={i} style={styles.calendarDay}>
              <Text style={styles.calendarDayHeader}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Weeks */}
        {weeks}
      </View>
    );
  };

  const renderSelectedDayDetails = (): React.ReactNode => {
    if (!selectedDate) {
      return (
        <View style={styles.selectedDayEmpty}>
          <Ionicons name="calendar-outline" size={32} color={theme.textSecondary} />
          <Text style={styles.selectedDayEmptyText}>Tap a day to see details</Text>
        </View>
      );
    }

    if (!selectedLog) {
      return (
        <View style={styles.selectedDayEmpty}>
          <Text style={styles.selectedDayEmptyText}>No data logged for this day</Text>
          <Text style={styles.selectedDayHint}>Chat with Delta to log your activities</Text>
        </View>
      );
    }

    return (
      <View style={styles.selectedDayDetails}>
        <Text style={styles.selectedDayDate}>
          {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </Text>

        {selectedLog.sleep_hours && (
          <View style={styles.logItem}>
            <Ionicons name="bed-outline" size={18} color={theme.accent} />
            <Text style={styles.logItemText}>Sleep: {selectedLog.sleep_hours}h</Text>
            {selectedLog.sleep_quality && (
              <Text style={styles.logItemMeta}>Quality: {selectedLog.sleep_quality}/5</Text>
            )}
          </View>
        )}

        {selectedLog.energy_level && (
          <View style={styles.logItem}>
            <Ionicons name="flash-outline" size={18} color={theme.warning} />
            <Text style={styles.logItemText}>Energy: {selectedLog.energy_level}/5</Text>
          </View>
        )}

        {selectedLog.stress_level && (
          <View style={styles.logItem}>
            <Ionicons name="pulse-outline" size={18} color={theme.error} />
            <Text style={styles.logItemText}>Stress: {selectedLog.stress_level}/5</Text>
          </View>
        )}

        {selectedLog.workout_plan_id && (
          <View style={styles.logItem}>
            <Ionicons name="barbell-outline" size={18} color={theme.success} />
            <Text style={styles.logItemText}>Workout completed</Text>
          </View>
        )}

        {selectedLog.notes && (
          <View style={styles.logNote}>
            <Text style={styles.logNoteText}>{selectedLog.notes}</Text>
          </View>
        )}
      </View>
    );
  };

  const styles = createStyles(theme, insets.top);

  if (isLoading === true || accessLoading === true) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Show paywall for users without access (unless they're developers)
  if (hasAccess !== true && isDeveloper !== true) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="lock-closed" size={64} color={theme.textSecondary} />
        <Text style={[styles.emptyTitle, { marginTop: 16 }]}>Premium Feature</Text>
        <Text style={[styles.emptySubtitle, { marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }]}>
          Insights, analytics, and workout coaching require a Delta Premium subscription.
        </Text>
        <TouchableOpacity
          style={[styles.generateButton, { marginTop: 24 }]}
          onPress={openPricing}
        >
          <Ionicons name="sparkles" size={20} color="#fff" />
          <Text style={styles.generateButtonText}>View Plans</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing === true}
          onRefresh={onRefresh}
          tintColor={theme.accent}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>INSIGHTS</Text>
      </View>

      {/* Tab Switcher */}
      <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'analytics' && styles.tabActive]}
          onPress={() => setActiveTab('analytics')}
        >
          <Ionicons
            name="analytics-outline"
            size={18}
            color={activeTab === 'analytics' ? theme.accent : theme.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'analytics' && styles.tabTextActive]}>
            Analytics
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'workout' && styles.tabActive]}
          onPress={() => setActiveTab('workout')}
        >
          <Ionicons
            name="barbell-outline"
            size={18}
            color={activeTab === 'workout' ? theme.accent : theme.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'workout' && styles.tabTextActive]}>
            Workout
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'calendar' && styles.tabActive]}
          onPress={() => setActiveTab('calendar')}
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color={activeTab === 'calendar' ? theme.accent : theme.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'calendar' && styles.tabTextActive]}>
            Calendar
          </Text>
        </Pressable>
      </Animated.View>

      {error.length > 0 && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {activeTab === 'analytics' ? (
        <>
          {/* Trend Cards */}
          <View style={styles.cardsContainer}>
            {trendCards.map((card, index) => (
              <AnimatedCard key={card.id} style={styles.card} delay={index * 80}>
                <View style={[styles.iconContainer, { backgroundColor: card.color + '20' }]}>
                  <Ionicons name={card.icon} size={24} color={card.color} />
                </View>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <View style={styles.trendValueRow}>
                  <Text style={[styles.cardValue, styles.trendSymbol, { color: card.color }]}>
                    {card.value}
                  </Text>
                  {card.confidence !== undefined && card.confidence > 0 && (
                    <View style={styles.confidenceBadge}>
                      <Text style={styles.confidenceText}>
                        {Math.round(card.confidence * 100)}%
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardSubtitle} numberOfLines={2}>{card.subtitle}</Text>
              </AnimatedCard>
            ))}
          </View>

          {/* Derivative Insight Cards */}
          {derivativeCards.length > 0 && (
            <FadeInView style={styles.section} delay={200}>
              <Text style={styles.sectionTitle}>Trends</Text>
              {derivativeCards.map((card, index) => (
                <AnimatedListItem key={card.id} index={index} style={styles.insightCardRow}>
                  <View style={styles.insightCardContent}>
                    <View style={styles.insightCardHeader}>
                      <Text style={styles.insightCardTitle}>{card.title}</Text>
                      {card.trend && (
                        <Text style={[styles.insightTrendSymbol, { color: card.color ?? theme.accent }]}>
                          {card.trend}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.insightCardValue}>{card.value}</Text>
                    <Text style={styles.insightCardSubtitle}>{card.subtitle}</Text>
                  </View>
                  {card.confidence > 0 && (
                    <AnimatedProgress
                      progress={card.confidence * 100}
                      height={4}
                      backgroundColor={theme.border}
                      fillColor={card.color ?? theme.accent}
                      style={styles.insightConfidenceBar}
                    />
                  )}
                </AnimatedListItem>
              ))}
            </FadeInView>
          )}

          {/* Activity Summary */}
          <FadeInView style={styles.section} delay={300}>
            <Text style={styles.sectionTitle}>Activity</Text>
            <AnimatedCard style={styles.activityCard} delay={350}>
              {derivatives?.has_data === true ? (
                <Text style={styles.activityText}>
                  Analyzing {derivatives.days_analyzed} days of data with {derivatives.data_points} data points.
                  Delta tracks your patterns to show what's working.
                </Text>
              ) : (
                <Text style={styles.activityText}>
                  Chat with Delta about your day to see trend analysis and insights here.
                </Text>
              )}
            </AnimatedCard>
          </FadeInView>
        </>
      ) : activeTab === 'workout' ? (
        <>
          {workout === null || workout.status === 'completed' || workout.status === 'skipped' ? (
            <FadeInView style={styles.emptyState} delay={100}>
              <Animated.View entering={FadeInUp.delay(150).springify()}>
                <Ionicons
                  name={workout?.status === 'completed' ? 'checkmark-circle' : 'fitness-outline'}
                  size={64}
                  color={workout?.status === 'completed' ? theme.success : theme.textSecondary}
                />
              </Animated.View>
              <Text style={styles.emptyTitle}>
                {workout?.status === 'completed'
                  ? 'Workout Complete!'
                  : workout?.status === 'skipped'
                  ? 'Workout Skipped'
                  : 'No Workout Today'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {workout?.status === 'completed'
                  ? 'Great job! Your workout has been logged.'
                  : 'Get a personalized workout recommendation'}
              </Text>
              <AnimatedButton
                style={[styles.generateButton, isGenerating === true && styles.buttonDisabled]}
                onPress={generateWorkout}
                disabled={isGenerating === true}
              >
                {isGenerating === true ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={20} color="#fff" />
                    <Text style={styles.generateButtonText}>Get Workout</Text>
                  </>
                )}
              </AnimatedButton>
            </FadeInView>
          ) : (
            <>
              <AnimatedCard style={styles.workoutCard} delay={50}>
                <View style={styles.workoutHeader}>
                  <View style={[styles.workoutIcon, { backgroundColor: theme.accent + '20' }]}>
                    <Ionicons name="barbell-outline" size={24} color={theme.accent} />
                  </View>
                  <View style={styles.workoutInfo}>
                    <Text style={styles.workoutName}>{workout.name}</Text>
                    <Text style={styles.workoutType}>
                      {workout.workout_type.charAt(0).toUpperCase() + workout.workout_type.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.progressContainer}>
                  <AnimatedProgress
                    progress={getProgressPercentage()}
                    height={8}
                    backgroundColor={theme.border}
                    fillColor={theme.success}
                    style={styles.progressBar}
                  />
                  <Text style={styles.progressText}>{getProgressPercentage()}%</Text>
                </View>
              </AnimatedCard>

              <FadeInView style={styles.section} delay={100}>
                <Text style={styles.sectionTitle}>Exercises</Text>
                {(workout.exercise_details ?? []).map((exercise, index) => (
                  <AnimatedListItem key={exercise.exercise_id} index={index} style={styles.exerciseCard} onPress={() => toggleExercise(exercise)}>
                    <View style={styles.exerciseRow}>
                      <Ionicons
                        name={exercise.completed === true ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={exercise.completed === true ? theme.success : theme.textSecondary}
                      />
                      <View style={styles.exerciseInfo}>
                        <Text
                          style={[
                            styles.exerciseName,
                            exercise.completed === true && styles.exerciseCompleted,
                          ]}
                        >
                          {index + 1}. {exercise.name}
                        </Text>
                        <Text style={styles.exerciseMeta}>
                          {exercise.sets ? `${exercise.sets} sets` : ''}
                          {exercise.sets && exercise.reps ? ' × ' : ''}
                          {exercise.reps ?? ''}
                        </Text>
                      </View>
                    </View>
                    {exercise.completed !== true && (
                      <TextInput
                        style={styles.weightInput}
                        placeholder="Weight"
                        placeholderTextColor={theme.textSecondary}
                        value={weights[exercise.exercise_id] ?? ''}
                        onChangeText={(text) =>
                          setWeights((prev) => ({ ...prev, [exercise.exercise_id]: text }))
                        }
                      />
                    )}
                  </AnimatedListItem>
                ))}
              </FadeInView>

              <FadeInView style={styles.section} delay={200}>
                <AnimatedButton style={styles.completeButton} onPress={completeWorkout}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.completeButtonText}>Complete Workout</Text>
                </AnimatedButton>
              </FadeInView>
            </>
          )}
        </>
      ) : activeTab === 'calendar' ? (
        <>
          {renderCalendar()}
          {renderSelectedDayDetails()}
        </>
      ) : null}
    </ScrollView>
  );
}

function createStyles(theme: Theme, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
    loadingText: { marginTop: 12, fontSize: 16, color: theme.textSecondary },
    header: { paddingHorizontal: 16, paddingTop: topInset + 8, paddingBottom: 8 },
    headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary, letterSpacing: 1 },
    tabContainer: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: theme.surface, borderRadius: 12, padding: 4, marginBottom: 16 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8 },
    tabActive: { backgroundColor: theme.accentLight },
    tabText: { fontSize: 14, color: theme.textSecondary, marginLeft: 6 },
    tabTextActive: { color: theme.accent, fontWeight: '600' },
    errorBanner: { backgroundColor: theme.error + '20', padding: 12, marginHorizontal: 16, borderRadius: 8, marginBottom: 16 },
    errorText: { color: theme.error, fontSize: 14, textAlign: 'center' },
    cardsContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
    card: { width: '50%', padding: 8 },
    iconContainer: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    cardTitle: { fontSize: 12, color: theme.textSecondary, marginBottom: 2 },
    cardValue: { fontSize: 24, fontWeight: '700', color: theme.textPrimary },
    cardSubtitle: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
    section: { padding: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginBottom: 12 },
    activityCard: { backgroundColor: theme.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border },
    activityText: { fontSize: 14, color: theme.textPrimary, lineHeight: 20 },
    emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 20, fontWeight: '600', color: theme.textPrimary, marginTop: 16 },
    emptySubtitle: { fontSize: 14, color: theme.textSecondary, marginTop: 8, textAlign: 'center' },
    generateButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.accent, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, marginTop: 24 },
    generateButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
    buttonDisabled: { opacity: 0.7 },
    workoutCard: { backgroundColor: theme.surface, marginHorizontal: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border },
    workoutHeader: { flexDirection: 'row', alignItems: 'center' },
    workoutIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    workoutInfo: { marginLeft: 12, flex: 1 },
    workoutName: { fontSize: 18, fontWeight: '600', color: theme.textPrimary },
    workoutType: { fontSize: 14, color: theme.textSecondary, marginTop: 2 },
    progressContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
    progressBar: { flex: 1, height: 8, backgroundColor: theme.border, borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 4 },
    progressText: { fontSize: 12, color: theme.textSecondary, marginLeft: 8, width: 32 },
    exerciseCard: { backgroundColor: theme.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
    exerciseRow: { flexDirection: 'row', alignItems: 'center' },
    exerciseInfo: { marginLeft: 12, flex: 1 },
    exerciseName: { fontSize: 15, fontWeight: '500', color: theme.textPrimary },
    exerciseCompleted: { textDecorationLine: 'line-through', color: theme.textSecondary },
    exerciseMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    weightInput: { backgroundColor: theme.surfaceSecondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, fontSize: 13, color: theme.textPrimary, marginTop: 8, marginLeft: 36, width: 80 },
    completeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.success, paddingVertical: 14, borderRadius: 12 },
    completeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
    // Trend card styles
    trendValueRow: { flexDirection: 'row', alignItems: 'center' },
    trendSymbol: { fontSize: 28 },
    confidenceBadge: { backgroundColor: theme.surfaceSecondary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 },
    confidenceText: { fontSize: 10, color: theme.textSecondary, fontWeight: '500' },
    // Insight card row styles
    insightCardRow: { flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
    insightCardContent: { flex: 1 },
    insightCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    insightCardTitle: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
    insightTrendSymbol: { fontSize: 18, fontWeight: '600' },
    insightCardValue: { fontSize: 16, fontWeight: '500', color: theme.textPrimary, marginTop: 4 },
    insightCardSubtitle: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    insightConfidenceBar: { width: 4, backgroundColor: theme.border, borderRadius: 2, marginLeft: 12, overflow: 'hidden', justifyContent: 'flex-end' },
    insightConfidenceFill: { width: '100%', borderRadius: 2 },
    // Calendar styles
    calendarGrid: { marginHorizontal: 16, marginBottom: 16 },
    calendarNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    calendarNavButton: { padding: 8 },
    calendarMonth: { fontSize: 18, fontWeight: '600', color: theme.textPrimary },
    calendarWeek: { flexDirection: 'row' },
    calendarDay: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
    calendarDayHeader: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
    calendarDayText: { fontSize: 14, color: theme.textPrimary },
    calendarDayToday: { backgroundColor: theme.accentLight, borderRadius: 20 },
    calendarDayTextToday: { fontWeight: '600', color: theme.accent },
    calendarDaySelected: { backgroundColor: theme.accent, borderRadius: 20 },
    calendarDayTextSelected: { color: '#fff', fontWeight: '600' },
    calendarDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
    selectedDayEmpty: { alignItems: 'center', padding: 32 },
    selectedDayEmptyText: { fontSize: 14, color: theme.textSecondary, marginTop: 8 },
    selectedDayHint: { fontSize: 12, color: theme.textSecondary, marginTop: 4 },
    selectedDayDetails: { marginHorizontal: 16, backgroundColor: theme.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border },
    selectedDayDate: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginBottom: 12 },
    logItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    logItemText: { fontSize: 14, color: theme.textPrimary, marginLeft: 8, flex: 1 },
    logItemMeta: { fontSize: 12, color: theme.textSecondary },
    logNote: { marginTop: 8, padding: 12, backgroundColor: theme.surfaceSecondary, borderRadius: 8 },
    logNoteText: { fontSize: 13, color: theme.textPrimary, fontStyle: 'italic' },
  });
}
