/**
 * ActivityScreen - Workout tracking and load state
 *
 * Shows:
 * - Today's workout plan
 * - Exercise list with completion tracking
 * - Load state from health intelligence
 * - Weekly workout summary
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { Theme } from '../theme/colors';
import { spacing, typography, borderRadius, shadows } from '../theme/designSystem';
import { useInsightsData } from '../hooks/useInsightsData';
import { useAuth } from '../context/AuthContext';
import { workoutApi, Exercise } from '../services/api';
import { StateCard } from '../components/HealthState';

interface ActivityScreenProps {
  theme: Theme;
}

export default function ActivityScreen({ theme }: ActivityScreenProps): React.ReactElement {
  const { user } = useAuth();
  const {
    workout,
    healthState,
    weeklySummaries,
    workoutLoading,
    fetchWorkoutData,
    invalidateCache,
  } = useInsightsData();

  const [weights, setWeights] = useState<Record<string, string>>({});
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    fetchWorkoutData();
  }, [fetchWorkoutData]);

  // Calculate workout progress
  const progressPercentage = useMemo((): number => {
    if (workout === null) return 0;
    const exercises = workout.exercise_details ?? [];
    if (exercises.length === 0) return 0;
    const completed = exercises.filter(e => e.completed === true).length;
    return Math.round((completed / exercises.length) * 100);
  }, [workout]);

  // Weekly workout stats
  const weeklyStats = useMemo(() => {
    const workoutCount = weeklySummaries.filter(s => s.workouts > 0).length;
    const totalMinutes = weeklySummaries.reduce((sum, s) => sum + s.workout_minutes, 0);
    return { workoutCount, totalMinutes };
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
      await fetchWorkoutData(true);
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
      contentContainerStyle={styles.content}
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
        <Text style={styles.headerSubtitle}>Track your workouts</Text>
      </View>

      {/* Load State Card */}
      {healthState?.load && (
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.loadStateCard}>
          <StateCard
            theme={theme}
            type="load"
            state={healthState.load.state}
            confidence={healthState.load.confidence}
            cumulative={healthState.load.cumulative}
          />
        </Animated.View>
      )}

      {/* Weekly Summary */}
      <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.weeklyCard}>
        <Text style={styles.cardTitle}>This Week</Text>
        <View style={styles.weeklyStats}>
          <View style={styles.weeklyStat}>
            <Text style={styles.weeklyStatValue}>{weeklyStats.workoutCount}</Text>
            <Text style={styles.weeklyStatLabel}>Workouts</Text>
          </View>
          <View style={styles.weeklyStatDivider} />
          <View style={styles.weeklyStat}>
            <Text style={styles.weeklyStatValue}>{weeklyStats.totalMinutes}</Text>
            <Text style={styles.weeklyStatLabel}>Minutes</Text>
          </View>
        </View>
      </Animated.View>

      {/* Today's Workout */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <Text style={styles.sectionTitle}>Today's Workout</Text>

        {workout === null || workout.status === 'completed' || workout.status === 'skipped' ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name={workout?.status === 'completed' ? 'checkmark-circle' : 'barbell-outline'}
                size={48}
                color={workout?.status === 'completed' ? theme.success : theme.textSecondary}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {workout?.status === 'completed'
                ? 'Workout Complete!'
                : 'No Workout Planned'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {workout?.status === 'completed'
                ? 'Great work today. Rest up!'
                : 'Generate a workout or take a rest day'}
            </Text>
            {workout?.status !== 'completed' && (
              <TouchableOpacity
                style={styles.generateButton}
                onPress={handleGenerateWorkout}
                disabled={isCompleting}
              >
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.generateButtonText}>Generate Workout</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {/* Workout Card */}
            <View style={styles.workoutCard}>
              <View style={styles.workoutHeader}>
                <View style={[styles.workoutIcon, { backgroundColor: theme.success + '20' }]}>
                  <Ionicons name="barbell" size={24} color={theme.success} />
                </View>
                <View style={styles.workoutInfo}>
                  <Text style={styles.workoutName}>{workout.name}</Text>
                  <Text style={styles.workoutType}>{workout.workout_type}</Text>
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
                <Text style={styles.progressText}>{progressPercentage}%</Text>
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
                    style={styles.exerciseCard}
                    onPress={() => handleToggleExercise(exercise)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.exerciseRow}>
                      <Ionicons
                        name={exercise.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={exercise.completed ? theme.success : theme.textSecondary}
                      />
                      <View style={styles.exerciseInfo}>
                        <Text
                          style={[
                            styles.exerciseName,
                            exercise.completed && styles.exerciseCompleted,
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

                    {/* Weight Input - only show for weighted exercises, not bodyweight */}
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
    loadStateCard: {
      marginBottom: spacing.lg,
    },
    weeklyCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      ...shadows.sm,
    },
    cardTitle: {
      ...typography.labelLarge,
      color: theme.textSecondary,
      marginBottom: spacing.md,
    },
    weeklyStats: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    weeklyStat: {
      flex: 1,
      alignItems: 'center',
    },
    weeklyStatValue: {
      ...typography.metric,
      color: theme.textPrimary,
    },
    weeklyStatLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: spacing.xs,
    },
    weeklyStatDivider: {
      width: 1,
      height: 32,
      backgroundColor: theme.border,
    },
    sectionTitle: {
      ...typography.labelLarge,
      color: theme.textSecondary,
      marginBottom: spacing.md,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    emptyState: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xxxl,
      alignItems: 'center',
      ...shadows.sm,
    },
    emptyIcon: {
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
    workoutCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
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
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    progressBar: {
      flex: 1,
      height: 8,
      backgroundColor: theme.border,
      borderRadius: borderRadius.xs,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: borderRadius.xs,
    },
    progressText: {
      ...typography.labelSmall,
      color: theme.textSecondary,
      marginLeft: spacing.sm,
      width: 36,
      textAlign: 'right',
    },
    exerciseList: {
      gap: spacing.sm,
    },
    exerciseCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      ...shadows.sm,
    },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
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
    exerciseCompleted: {
      textDecorationLine: 'line-through',
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
