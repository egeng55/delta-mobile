/**
 * ActivityScreen - Oura-quality workout tracking and activity metrics
 *
 * Shows:
 * - Activity score ring with daily progress
 * - Key metrics: Steps, Active calories, Workout minutes
 * - Weekly activity bar chart
 * - Today's workout plan with exercise tracking
 * - Load state visualization
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInRight, FadeIn } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Theme } from '../theme/colors';
import { spacing, typography, borderRadius, shadows } from '../theme/designSystem';
import { useInsightsData } from '../hooks/useInsightsData';
import { useAuth } from '../context/AuthContext';
import { useHealthKit } from '../context/HealthKitContext';
import { workoutApi, Exercise } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ActivityScreenProps {
  theme: Theme;
}

// Activity Score Ring Component
interface ActivityRingProps {
  score: number; // 0-100
  size: number;
  strokeWidth: number;
  theme: Theme;
}

const ActivityRing: React.FC<ActivityRingProps> = ({ score, size, strokeWidth, theme }) => {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score));
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Color based on score
  const getScoreColor = (s: number): string => {
    if (s >= 80) return '#22C55E'; // Green - excellent
    if (s >= 60) return '#3B82F6'; // Blue - good
    if (s >= 40) return '#F59E0B'; // Yellow - moderate
    return '#EF4444'; // Red - low
  };

  const scoreColor = getScoreColor(score);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={scoreColor} stopOpacity="1" />
            <Stop offset="100%" stopColor={scoreColor} stopOpacity="0.6" />
          </LinearGradient>
        </Defs>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={theme.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#ringGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 36, fontWeight: '700', color: theme.textPrimary }}>
          {Math.round(score)}
        </Text>
        <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
          Activity Score
        </Text>
      </View>
    </View>
  );
};

// Weekly Bar Chart Component
interface WeeklyBarChartProps {
  data: { label: string; value: number; isToday: boolean }[];
  maxValue: number;
  theme: Theme;
  color: string;
}

const WeeklyBarChart: React.FC<WeeklyBarChartProps> = ({ data, maxValue, theme, color }) => {
  const barWidth = (SCREEN_WIDTH - spacing.lg * 4 - spacing.sm * 6) / 7;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 80 }}>
      {data.map((item, index) => {
        const barHeight = maxValue > 0 ? Math.max(4, (item.value / maxValue) * 60) : 4;
        return (
          <View key={index} style={{ alignItems: 'center', width: barWidth }}>
            <View
              style={{
                width: barWidth * 0.7,
                height: barHeight,
                backgroundColor: item.isToday ? color : color + '60',
                borderRadius: 4,
                marginBottom: 6,
              }}
            />
            <Text style={{
              fontSize: 10,
              color: item.isToday ? theme.textPrimary : theme.textSecondary,
              fontWeight: item.isToday ? '600' : '400',
            }}>
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

export default function ActivityScreen({ theme }: ActivityScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    workout,
    healthState,
    weeklySummaries,
    workoutLoading,
    fetchWorkoutData,
    fetchAnalyticsData,
    invalidateCache,
  } = useInsightsData();

  // Use centralized HealthKit context for Apple Watch data
  const { hasWatchData, healthData } = useHealthKit();

  const [weights, setWeights] = useState<Record<string, string>>({});
  const [isCompleting, setIsCompleting] = useState(false);
  const [expandedWorkout, setExpandedWorkout] = useState(true);

  useEffect(() => {
    // Fetch both workout data and analytics (for weeklySummaries metrics)
    fetchWorkoutData();
    fetchAnalyticsData();
  }, [fetchWorkoutData, fetchAnalyticsData]);

  // Calculate workout progress
  const progressPercentage = useMemo((): number => {
    if (workout === null) return 0;
    const exercises = workout.exercise_details ?? [];
    if (exercises.length === 0) return 0;
    const completed = exercises.filter(e => e.completed === true).length;
    return Math.round((completed / exercises.length) * 100);
  }, [workout]);

  // Calculate activity score (composite of workout, calories)
  const activityScore = useMemo(() => {
    const today = weeklySummaries[weeklySummaries.length - 1];
    if (!today) return 0;

    // Score components based on available data
    const workoutScore = today.workouts > 0 ? 50 : Math.min(50, (today.workout_minutes / 30) * 50);
    const nutritionScore = Math.min(50, (today.calories / 2000) * 50);

    return Math.round(workoutScore + nutritionScore);
  }, [weeklySummaries]);

  // Today's metrics (using available WeeklySummary fields)
  const todayMetrics = useMemo(() => {
    const today = weeklySummaries[weeklySummaries.length - 1];
    return {
      calories: today?.calories ?? 0,
      workoutMinutes: today?.workout_minutes ?? 0,
      workouts: today?.workouts ?? 0,
      sleepHours: today?.sleep_hours ?? 0,
    };
  }, [weeklySummaries]);

  // Weekly workout data for chart
  const weeklyWorkoutData = useMemo(() => {
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayIndex = new Date().getDay(); // 0=Sun, 1=Mon...
    const adjustedTodayIndex = todayIndex === 0 ? 6 : todayIndex - 1; // Convert to 0=Mon

    return weeklySummaries.slice(-7).map((summary, index) => ({
      label: dayLabels[index % 7],
      value: summary.workout_minutes,
      isToday: index === adjustedTodayIndex || index === weeklySummaries.slice(-7).length - 1,
    }));
  }, [weeklySummaries]);

  // Weekly stats
  const weeklyStats = useMemo(() => {
    const thisWeek = weeklySummaries.slice(-7);
    return {
      totalWorkouts: thisWeek.filter(s => s.workouts > 0).length,
      totalMinutes: thisWeek.reduce((sum, s) => sum + s.workout_minutes, 0),
      avgCalories: Math.round(thisWeek.reduce((sum, s) => sum + s.calories, 0) / Math.max(1, thisWeek.length)),
    };
  }, [weeklySummaries]);

  const maxWorkoutMinutes = useMemo(() => {
    return Math.max(...weeklySummaries.slice(-7).map(s => s.workout_minutes), 30);
  }, [weeklySummaries]);

  const handleToggleExercise = async (exercise: Exercise): Promise<void> => {
    if (workout === null || user?.id === undefined) return;

    try {
      if (exercise.completed) {
        await workoutApi.uncompleteExercise(exercise.exercise_id);
      } else {
        await workoutApi.completeExercise(
          exercise.exercise_id,
          weights[exercise.name] || exercise.weight || undefined
        );
      }
      invalidateCache('workout');
      invalidateCache('analytics');
      await fetchWorkoutData(true);
    } catch {
      Alert.alert('Error', 'Could not update exercise');
    }
  };

  const handleCompleteWorkout = (): void => {
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
    setIsCompleting(true);
    try {
      await workoutApi.updateStatus(workout.plan_id, 'completed');
      invalidateCache('workout');
      invalidateCache('analytics');
      // Fetch both workout data and analytics (for updated weeklySummaries)
      await Promise.all([
        fetchWorkoutData(true),
        fetchAnalyticsData(true),
      ]);
      Alert.alert('Workout Complete!', 'Great job! Your workout has been logged.');
    } catch {
      Alert.alert('Error', 'Could not complete workout');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleGenerateWorkout = async (): Promise<void> => {
    if (user?.id === undefined) return;
    setIsCompleting(true);
    try {
      await workoutApi.recommend(user.id);
      invalidateCache('workout');
      await fetchWorkoutData(true);
    } catch {
      Alert.alert('Error', 'Could not generate workout');
    } finally {
      setIsCompleting(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
      refreshControl={
        <RefreshControl
          refreshing={workoutLoading}
          onRefresh={() => fetchWorkoutData(true)}
          tintColor={theme.accent}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
        {hasWatchData && (
          <View style={styles.watchBadge}>
            <Ionicons name="watch" size={12} color="#FF2D55" />
            <Text style={styles.watchBadgeText}>Apple Watch</Text>
          </View>
        )}
      </View>

      {/* Activity Score Ring */}
      <Animated.View entering={FadeInDown.delay(50).duration(400)} style={styles.scoreSection}>
        <ActivityRing
          score={activityScore}
          size={160}
          strokeWidth={12}
          theme={theme}
        />

        {/* Quick Metrics Row */}
        <View style={styles.metricsRow}>
          {hasWatchData ? (
            <>
              {/* Apple Watch metrics */}
              <View style={styles.metricItem}>
                <View style={[styles.metricIcon, { backgroundColor: '#22C55E20' }]}>
                  <Ionicons name="footsteps" size={18} color="#22C55E" />
                </View>
                <Text style={styles.metricValue}>{healthData.steps.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Steps</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <View style={[styles.metricIcon, { backgroundColor: '#F9731620' }]}>
                  <Ionicons name="flame" size={18} color="#F97316" />
                </View>
                <Text style={styles.metricValue}>{healthData.activeCalories.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Active Cal</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <View style={[styles.metricIcon, { backgroundColor: '#8B5CF620' }]}>
                  <Ionicons name="barbell" size={18} color="#8B5CF6" />
                </View>
                <Text style={styles.metricValue}>{todayMetrics.workoutMinutes}</Text>
                <Text style={styles.metricLabel}>Workout Min</Text>
              </View>
            </>
          ) : (
            <>
              {/* Standard metrics when no Apple Watch */}
              <View style={styles.metricItem}>
                <View style={[styles.metricIcon, { backgroundColor: '#F9731620' }]}>
                  <Ionicons name="flame" size={18} color="#F97316" />
                </View>
                <Text style={styles.metricValue}>{todayMetrics.calories.toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Calories</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <View style={[styles.metricIcon, { backgroundColor: '#8B5CF620' }]}>
                  <Ionicons name="barbell" size={18} color="#8B5CF6" />
                </View>
                <Text style={styles.metricValue}>{todayMetrics.workoutMinutes}</Text>
                <Text style={styles.metricLabel}>Workout Min</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <View style={[styles.metricIcon, { backgroundColor: '#6366F120' }]}>
                  <Ionicons name="moon" size={18} color="#6366F1" />
                </View>
                <Text style={styles.metricValue}>{todayMetrics.sleepHours?.toFixed(1) ?? '-'}</Text>
                <Text style={styles.metricLabel}>Sleep Hrs</Text>
              </View>
            </>
          )}
        </View>
      </Animated.View>

      {/* Weekly Overview */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.weeklyCard}>
        <View style={styles.weeklyHeader}>
          <Text style={styles.cardTitle}>This Week</Text>
          <View style={styles.weeklyBadges}>
            <View style={styles.weeklyBadge}>
              <Text style={styles.weeklyBadgeValue}>{weeklyStats.totalWorkouts}</Text>
              <Text style={styles.weeklyBadgeLabel}>Workouts</Text>
            </View>
            <View style={styles.weeklyBadge}>
              <Text style={styles.weeklyBadgeValue}>{weeklyStats.totalMinutes}</Text>
              <Text style={styles.weeklyBadgeLabel}>Minutes</Text>
            </View>
          </View>
        </View>

        <WeeklyBarChart
          data={weeklyWorkoutData}
          maxValue={maxWorkoutMinutes}
          theme={theme}
          color="#8B5CF6"
        />
      </Animated.View>

      {/* Load State Card */}
      {healthState?.load && (
        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.loadStateCard}>
          <View style={styles.loadStateHeader}>
            <View style={styles.loadStateInfo}>
              <Text style={styles.loadStateTitle}>Training Load</Text>
              <Text style={[styles.loadStateValue, {
                color:
                  healthState.load.state === 'low' ? '#22C55E' :
                  healthState.load.state === 'moderate' ? '#F59E0B' :
                  '#EF4444'
              }]}>
                {healthState.load.state.charAt(0).toUpperCase() + healthState.load.state.slice(1)}
              </Text>
            </View>
          </View>
          {healthState.load.cumulative && (
            <View style={styles.loadStateBar}>
              <View
                style={[styles.loadStateBarFill, {
                  width: `${Math.min(100, healthState.load.cumulative)}%`,
                  backgroundColor:
                    healthState.load.state === 'low' ? '#22C55E' :
                    healthState.load.state === 'moderate' ? '#F59E0B' :
                    '#EF4444'
                }]}
              />
            </View>
          )}
        </Animated.View>
      )}

      {/* Today's Workout Section */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setExpandedWorkout(!expandedWorkout)}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionTitle}>Today's Workout</Text>
          <Ionicons
            name={expandedWorkout ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        {expandedWorkout && (
          <>
            {workout === null || workout.status === 'completed' || workout.status === 'skipped' ? (
              <Animated.View entering={FadeIn.duration(300)} style={styles.emptyState}>
                <View style={[styles.emptyIcon, {
                  backgroundColor: workout?.status === 'completed' ? '#22C55E20' : theme.surface
                }]}>
                  <Ionicons
                    name={workout?.status === 'completed' ? 'checkmark-circle' : 'barbell-outline'}
                    size={40}
                    color={workout?.status === 'completed' ? '#22C55E' : theme.textSecondary}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {workout?.status === 'completed'
                    ? 'Workout Complete!'
                    : 'No Workout Planned'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {workout?.status === 'completed'
                    ? 'Great work today. Recovery is just as important.'
                    : 'Generate an AI workout or take a rest day'}
                </Text>
                {workout?.status !== 'completed' && (
                  <TouchableOpacity
                    style={styles.generateButton}
                    onPress={handleGenerateWorkout}
                    disabled={isCompleting}
                  >
                    <Ionicons name="sparkles" size={18} color="#fff" />
                    <Text style={styles.generateButtonText}>
                      {isCompleting ? 'Generating...' : 'Generate Workout'}
                    </Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            ) : (
              <>
                {/* Active Workout Card */}
                <View style={styles.workoutCard}>
                  <View style={styles.workoutHeader}>
                    <View style={[styles.workoutIcon, { backgroundColor: theme.success + '20' }]}>
                      <Ionicons name="barbell" size={24} color={theme.success} />
                    </View>
                    <View style={styles.workoutInfo}>
                      <Text style={styles.workoutName}>{workout.name}</Text>
                      <Text style={styles.workoutType}>{workout.workout_type}</Text>
                    </View>
                    <View style={styles.workoutProgress}>
                      <Text style={styles.workoutProgressText}>{progressPercentage}%</Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${progressPercentage}%`, backgroundColor: theme.success },
                        ]}
                      />
                    </View>
                  </View>
                </View>

                {/* Exercise List */}
                <View style={styles.exerciseList}>
                  {(workout.exercise_details ?? []).map((exercise, index) => (
                    <Animated.View
                      key={`${exercise.name}-${index}`}
                      entering={FadeInRight.delay(index * 50).duration(300)}
                    >
                      <TouchableOpacity
                        style={[
                          styles.exerciseCard,
                          exercise.completed && styles.exerciseCardCompleted,
                        ]}
                        onPress={() => handleToggleExercise(exercise)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.exerciseRow}>
                          <View style={[
                            styles.exerciseCheck,
                            exercise.completed && styles.exerciseCheckCompleted,
                          ]}>
                            {exercise.completed && (
                              <Ionicons name="checkmark" size={16} color="#fff" />
                            )}
                          </View>
                          <View style={styles.exerciseInfo}>
                            <Text
                              style={[
                                styles.exerciseName,
                                exercise.completed && styles.exerciseNameCompleted,
                              ]}
                            >
                              {exercise.name}
                            </Text>
                            <Text style={styles.exerciseMeta}>
                              {exercise.sets} sets × {exercise.reps} reps
                              {exercise.weight && ` @ ${exercise.weight}`}
                            </Text>
                          </View>
                        </View>

                        {/* Weight Input */}
                        {!exercise.completed && exercise.weight !== null && (
                          <TextInput
                            style={styles.weightInput}
                            placeholder="Weight used"
                            placeholderTextColor={theme.textSecondary}
                            keyboardType="numeric"
                            value={weights[exercise.name] || ''}
                            onChangeText={(text) =>
                              setWeights(prev => ({ ...prev, [exercise.name]: text }))
                            }
                          />
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>

                {/* Complete Button */}
                <TouchableOpacity
                  style={[styles.completeButton, { backgroundColor: theme.success }]}
                  onPress={handleCompleteWorkout}
                  disabled={isCompleting}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.completeButtonText}>
                    {isCompleting ? 'Completing...' : 'Complete Workout'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </Animated.View>

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
    watchBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FF2D5515',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
      borderRadius: borderRadius.sm,
      gap: 4,
      marginTop: spacing.sm,
      alignSelf: 'flex-start',
    },
    watchBadgeText: {
      fontSize: 10,
      color: '#FF2D55',
      fontWeight: '500',
    },
    // Score Section
    scoreSection: {
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      marginBottom: spacing.lg,
      ...shadows.sm,
    },
    metricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      width: '100%',
      marginTop: spacing.xl,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    metricItem: {
      alignItems: 'center',
      flex: 1,
    },
    metricIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    metricValue: {
      ...typography.subtitle,
      color: theme.textPrimary,
      fontWeight: '700',
    },
    metricLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: 2,
    },
    metricDivider: {
      width: 1,
      height: 50,
      backgroundColor: theme.border,
    },
    // Weekly Card
    weeklyCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadows.sm,
    },
    weeklyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    cardTitle: {
      ...typography.labelLarge,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    weeklyBadges: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    weeklyBadge: {
      alignItems: 'center',
    },
    weeklyBadgeValue: {
      ...typography.labelMedium,
      color: theme.textPrimary,
      fontWeight: '700',
    },
    weeklyBadgeLabel: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    // Load State
    loadStateCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadows.sm,
    },
    loadStateHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    loadStateInfo: {},
    loadStateTitle: {
      ...typography.caption,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    loadStateValue: {
      ...typography.subtitle,
      color: theme.textPrimary,
      textTransform: 'capitalize',
    },
    loadStateBadge: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
    },
    loadStateBadgeText: {
      ...typography.caption,
      fontWeight: '500',
    },
    loadStateBar: {
      height: 6,
      backgroundColor: theme.border,
      borderRadius: 3,
      marginTop: spacing.md,
      overflow: 'hidden',
    },
    loadStateBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    // Section Header
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    sectionTitle: {
      ...typography.labelLarge,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    // Empty State
    emptyState: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xxxl,
      alignItems: 'center',
      ...shadows.sm,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    emptyTitle: {
      ...typography.subtitle,
      color: theme.textPrimary,
      marginBottom: spacing.sm,
    },
    emptySubtitle: {
      ...typography.bodySmall,
      color: theme.textSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
    },
    generateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.accent,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.md,
      marginTop: spacing.xl,
      gap: spacing.sm,
    },
    generateButtonText: {
      ...typography.labelMedium,
      color: '#fff',
    },
    // Workout Card
    workoutCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadows.sm,
    },
    workoutHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    workoutIcon: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    workoutInfo: {
      marginLeft: spacing.md,
      flex: 1,
    },
    workoutName: {
      ...typography.subtitle,
      color: theme.textPrimary,
    },
    workoutType: {
      ...typography.bodySmall,
      color: theme.textSecondary,
      marginTop: spacing.xxs,
      textTransform: 'capitalize',
    },
    workoutProgress: {
      backgroundColor: theme.success + '20',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
    },
    workoutProgressText: {
      ...typography.labelMedium,
      color: theme.success,
      fontWeight: '700',
    },
    progressContainer: {
      marginTop: spacing.lg,
    },
    progressBar: {
      height: 8,
      backgroundColor: theme.border,
      borderRadius: borderRadius.xs,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: borderRadius.xs,
    },
    // Exercise List
    exerciseList: {
      gap: spacing.sm,
    },
    exerciseCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: theme.border,
      ...shadows.sm,
    },
    exerciseCardCompleted: {
      borderLeftColor: theme.success,
      backgroundColor: theme.success + '08',
    },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    exerciseCheck: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    exerciseCheckCompleted: {
      backgroundColor: theme.success,
      borderColor: theme.success,
    },
    exerciseInfo: {
      marginLeft: spacing.md,
      flex: 1,
    },
    exerciseName: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
      fontWeight: '500',
    },
    exerciseNameCompleted: {
      color: theme.textSecondary,
    },
    exerciseMeta: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: spacing.xxs,
    },
    weightInput: {
      backgroundColor: theme.surfaceSecondary,
      borderRadius: borderRadius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 13,
      color: theme.textPrimary,
      marginTop: spacing.sm,
      marginLeft: 36,
      width: 100,
    },
    completeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.md,
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    completeButtonText: {
      ...typography.labelLarge,
      color: '#fff',
    },
  });
}
