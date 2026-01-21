/**
 * TasksScreen - Workout coaching and task tracking.
 *
 * SAFETY DECISIONS:
 * - Explicit loading states
 * - Error handling with fallback
 * - Explicit types throughout
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { workoutApi, WorkoutPlan, Exercise } from '../services/api';

interface TasksScreenProps {
  theme: Theme;
}

export default function TasksScreen({ theme }: TasksScreenProps): React.ReactNode {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [workout, setWorkout] = useState<WorkoutPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [weights, setWeights] = useState<Record<string, string>>({});

  const userId = user?.id ?? 'anonymous';

  const fetchTodayWorkout = useCallback(async (showRefreshIndicator: boolean = false): Promise<void> => {
    if (showRefreshIndicator === true) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError('');

    try {
      const response = await workoutApi.getToday(userId);
      setWorkout(response.workout);
    } catch {
      setError('Could not load workout');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTodayWorkout();
  }, [fetchTodayWorkout]);

  const onRefresh = (): void => {
    fetchTodayWorkout(true);
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
      // Refresh workout to get updated state
      await fetchTodayWorkout();

      // Auto-start workout if first exercise
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
      await fetchTodayWorkout();
      Alert.alert('Workout Complete!', 'Great job! Your workout has been logged.');
    } catch {
      setError('Could not complete workout');
    }
  };

  const skipWorkout = async (): Promise<void> => {
    if (workout === null) return;

    Alert.alert(
      'Skip Workout',
      'Are you sure you want to skip today\'s workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: async () => {
            try {
              await workoutApi.updateStatus(workout.plan_id, 'skipped');
              await fetchTodayWorkout();
            } catch {
              setError('Could not skip workout');
            }
          },
        },
      ]
    );
  };

  const getProgressPercentage = (): number => {
    if (workout === null) return 0;
    const exercises = workout.exercise_details ?? [];
    if (exercises.length === 0) return 0;
    const completed = exercises.filter(e => e.completed === true).length;
    return Math.round((completed / exercises.length) * 100);
  };

  const formatDate = (): string => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    };
    return now.toLocaleDateString('en-US', options);
  };

  const getWorkoutTypeIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'strength':
        return 'barbell-outline';
      case 'cardio':
        return 'heart-outline';
      case 'flexibility':
        return 'body-outline';
      case 'hiit':
        return 'flash-outline';
      default:
        return 'fitness-outline';
    }
  };

  const styles = createStyles(theme, insets.top);

  if (isLoading === true) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading workout...</Text>
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
        <Text style={styles.headerTitle}>TODAY'S WORKOUT</Text>
        <Text style={styles.headerDate}>{formatDate()}</Text>
      </View>

      {error.length > 0 && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {workout === null || workout.status === 'completed' || workout.status === 'skipped' ? (
        // Empty state or completed state
        <View style={styles.emptyState}>
          <Ionicons
            name={workout?.status === 'completed' ? 'checkmark-circle' : 'fitness-outline'}
            size={64}
            color={workout?.status === 'completed' ? theme.success : theme.textSecondary}
          />
          <Text style={styles.emptyTitle}>
            {workout?.status === 'completed'
              ? 'Workout Complete!'
              : workout?.status === 'skipped'
              ? 'Workout Skipped'
              : 'No Workout Scheduled'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {workout?.status === 'completed'
              ? 'Great job! Your workout has been logged.'
              : workout?.status === 'skipped'
              ? 'You can still get a new workout recommendation.'
              : 'Get a personalized workout recommendation from Delta'}
          </Text>
          <TouchableOpacity
            style={[styles.generateButton, isGenerating === true && styles.buttonDisabled]}
            onPress={generateWorkout}
            disabled={isGenerating === true}
          >
            {isGenerating === true ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.generateButtonText}>Get Recommendation</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        // Active workout
        <>
          <View style={styles.workoutCard}>
            <View style={styles.workoutHeader}>
              <View style={styles.workoutInfo}>
                <View style={[styles.typeIcon, { backgroundColor: theme.accent + '20' }]}>
                  <Ionicons
                    name={getWorkoutTypeIcon(workout.workout_type)}
                    size={24}
                    color={theme.accent}
                  />
                </View>
                <View style={styles.workoutDetails}>
                  <Text style={styles.workoutName}>{workout.name}</Text>
                  <Text style={styles.workoutType}>
                    {workout.workout_type.charAt(0).toUpperCase() + workout.workout_type.slice(1)}
                    {workout.estimated_duration_minutes
                      ? ` · ${workout.estimated_duration_minutes} min`
                      : ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={skipWorkout} style={styles.skipButton}>
                <Ionicons name="close-circle-outline" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${getProgressPercentage()}%`, backgroundColor: theme.success },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{getProgressPercentage()}% Complete</Text>
            </View>

            {/* Warmup */}
            {workout.warmup && (
              <View style={styles.warmupCooldown}>
                <Ionicons name="flame-outline" size={16} color={theme.warning} />
                <Text style={styles.warmupText}>Warmup: {workout.warmup}</Text>
              </View>
            )}
          </View>

          {/* Exercises list */}
          <View style={styles.exercisesSection}>
            <Text style={styles.sectionTitle}>Exercises</Text>
            {(workout.exercise_details ?? []).map((exercise, index) => (
              <View key={exercise.exercise_id} style={styles.exerciseCard}>
                <TouchableOpacity
                  style={styles.exerciseRow}
                  onPress={() => toggleExercise(exercise)}
                >
                  <View style={styles.checkbox}>
                    {exercise.completed === true ? (
                      <Ionicons name="checkbox" size={28} color={theme.success} />
                    ) : (
                      <Ionicons name="square-outline" size={28} color={theme.textSecondary} />
                    )}
                  </View>
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
                      {exercise.rest_seconds ? ` · ${exercise.rest_seconds}s rest` : ''}
                    </Text>
                    {exercise.notes && (
                      <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                    )}
                  </View>
                </TouchableOpacity>
                {exercise.completed !== true && (
                  <View style={styles.weightInput}>
                    <TextInput
                      style={styles.weightField}
                      placeholder="Weight"
                      placeholderTextColor={theme.textSecondary}
                      value={weights[exercise.exercise_id] ?? ''}
                      onChangeText={(text) =>
                        setWeights((prev) => ({ ...prev, [exercise.exercise_id]: text }))
                      }
                      keyboardType="default"
                    />
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Cooldown */}
          {workout.cooldown && (
            <View style={styles.cooldownSection}>
              <View style={styles.warmupCooldown}>
                <Ionicons name="snow-outline" size={16} color={theme.accent} />
                <Text style={styles.warmupText}>Cooldown: {workout.cooldown}</Text>
              </View>
            </View>
          )}

          {/* Complete button */}
          <View style={styles.completeSection}>
            <TouchableOpacity style={styles.completeButton} onPress={completeWorkout}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.completeButtonText}>Complete Workout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function createStyles(theme: Theme, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.textSecondary,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: topInset + 8,
      paddingBottom: 16,
      backgroundColor: theme.background,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.textPrimary,
      letterSpacing: 1,
    },
    headerDate: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
    },
    errorBanner: {
      backgroundColor: theme.error + '20',
      padding: 12,
      marginHorizontal: 16,
      borderRadius: 8,
    },
    errorText: {
      color: theme.error,
      fontSize: 14,
      textAlign: 'center',
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingVertical: 64,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.textPrimary,
      marginTop: 16,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 20,
    },
    generateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.accent,
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 12,
      marginTop: 24,
    },
    generateButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    workoutCard: {
      backgroundColor: theme.surface,
      marginHorizontal: 16,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    workoutHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    workoutInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    typeIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    workoutDetails: {
      marginLeft: 12,
      flex: 1,
    },
    workoutName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    workoutType: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    skipButton: {
      padding: 8,
    },
    progressContainer: {
      marginTop: 16,
    },
    progressBar: {
      height: 8,
      backgroundColor: theme.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    progressText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
      textAlign: 'right',
    },
    warmupCooldown: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    warmupText: {
      fontSize: 13,
      color: theme.textSecondary,
      marginLeft: 8,
      flex: 1,
    },
    exercisesSection: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 12,
    },
    exerciseCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    checkbox: {
      marginRight: 12,
      marginTop: 2,
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.textPrimary,
    },
    exerciseCompleted: {
      textDecorationLine: 'line-through',
      color: theme.textSecondary,
    },
    exerciseMeta: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
    },
    exerciseNotes: {
      fontSize: 12,
      color: theme.accent,
      marginTop: 4,
      fontStyle: 'italic',
    },
    weightInput: {
      marginTop: 8,
      marginLeft: 40,
    },
    weightField: {
      backgroundColor: theme.surfaceSecondary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: theme.textPrimary,
      width: 100,
    },
    cooldownSection: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    completeSection: {
      padding: 16,
      paddingBottom: 32,
    },
    completeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.success,
      paddingVertical: 16,
      borderRadius: 12,
    },
    completeButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
  });
}
