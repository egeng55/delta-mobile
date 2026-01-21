/**
 * InsightsScreen - Combined health insights, analytics, and workouts.
 *
 * SAFETY DECISIONS:
 * - Explicit loading states
 * - Error handling with fallback data
 * - Explicit types
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
import { insightsApi, InsightsData, workoutApi, WorkoutPlan, Exercise } from '../services/api';

interface InsightsScreenProps {
  theme: Theme;
}

interface InsightCard {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

type TabType = 'insights' | 'workout';

export default function InsightsScreen({ theme }: InsightsScreenProps): React.ReactNode {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabType>('insights');
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [workout, setWorkout] = useState<WorkoutPlan | null>(null);
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

    try {
      const [insightsData, workoutData] = await Promise.all([
        insightsApi.getInsights(userId),
        workoutApi.getToday(userId),
      ]);
      setInsights(insightsData);
      setWorkout(workoutData.workout);
    } catch {
      setError('Could not load data');
      setInsights({
        user_id: userId,
        total_conversations: 0,
        topics_discussed: [],
        wellness_score: 0,
        streak_days: 0,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = (): void => {
    fetchData(true);
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

  const insightCards: InsightCard[] = [
    {
      id: '1',
      title: 'Conversations',
      value: String(insights?.total_conversations ?? 0),
      subtitle: 'Total chats with Delta',
      icon: 'chatbubbles-outline',
      color: theme.accent,
    },
    {
      id: '2',
      title: 'Topics',
      value: String(insights?.topics_discussed?.length ?? 0),
      subtitle: insights?.topics_discussed?.slice(0, 2).join(', ') || 'Start chatting!',
      icon: 'list-outline',
      color: theme.success,
    },
    {
      id: '3',
      title: 'Wellness',
      value: String(insights?.wellness_score ?? 0),
      subtitle: 'Based on your habits',
      icon: 'heart-outline',
      color: theme.error,
    },
    {
      id: '4',
      title: 'Streak',
      value: `${insights?.streak_days ?? 0}`,
      subtitle: insights?.streak_days && insights.streak_days > 0 ? 'days' : 'Start today!',
      icon: 'flame-outline',
      color: theme.warning,
    },
  ];

  const styles = createStyles(theme, insets.top);

  if (isLoading === true) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading...</Text>
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
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'insights' && styles.tabActive]}
          onPress={() => setActiveTab('insights')}
        >
          <Ionicons
            name="analytics-outline"
            size={18}
            color={activeTab === 'insights' ? theme.accent : theme.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'insights' && styles.tabTextActive]}>
            Analytics
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
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
        </TouchableOpacity>
      </View>

      {error.length > 0 && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {activeTab === 'insights' ? (
        <>
          <View style={styles.cardsContainer}>
            {insightCards.map(insight => (
              <View key={insight.id} style={styles.card}>
                <View style={[styles.iconContainer, { backgroundColor: insight.color + '20' }]}>
                  <Ionicons name={insight.icon} size={24} color={insight.color} />
                </View>
                <Text style={styles.cardTitle}>{insight.title}</Text>
                <Text style={styles.cardValue}>{insight.value}</Text>
                <Text style={styles.cardSubtitle} numberOfLines={1}>{insight.subtitle}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.activityCard}>
              {insights?.total_conversations && insights.total_conversations > 0 ? (
                <Text style={styles.activityText}>
                  You've had {insights.total_conversations} conversation{insights.total_conversations !== 1 ? 's' : ''} with Delta.
                  {insights.streak_days && insights.streak_days > 0
                    ? ` You're on a ${insights.streak_days}-day streak!`
                    : ' Start a streak by chatting daily!'}
                </Text>
              ) : (
                <Text style={styles.activityText}>
                  Start chatting with Delta to see your activity and insights here!
                </Text>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tips</Text>
            <View style={styles.tipCard}>
              <Ionicons name="bulb" size={20} color={theme.warning} />
              <Text style={styles.tipText}>
                Discuss your sleep patterns with Delta for personalized tips.
              </Text>
            </View>
          </View>
        </>
      ) : (
        <>
          {workout === null || workout.status === 'completed' || workout.status === 'skipped' ? (
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
                  : 'No Workout Today'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {workout?.status === 'completed'
                  ? 'Great job! Your workout has been logged.'
                  : 'Get a personalized workout recommendation'}
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
                    <Text style={styles.generateButtonText}>Get Workout</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.workoutCard}>
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
                  <View style={styles.progressBar}>
                    <View
                      style={[styles.progressFill, { width: `${getProgressPercentage()}%`, backgroundColor: theme.success }]}
                    />
                  </View>
                  <Text style={styles.progressText}>{getProgressPercentage()}%</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Exercises</Text>
                {(workout.exercise_details ?? []).map((exercise, index) => (
                  <View key={exercise.exercise_id} style={styles.exerciseCard}>
                    <TouchableOpacity
                      style={styles.exerciseRow}
                      onPress={() => toggleExercise(exercise)}
                    >
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
                    </TouchableOpacity>
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
                  </View>
                ))}
              </View>

              <View style={styles.section}>
                <TouchableOpacity style={styles.completeButton} onPress={completeWorkout}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.completeButtonText}>Complete Workout</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </>
      )}
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
    tipCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: theme.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border },
    tipText: { flex: 1, fontSize: 14, color: theme.textPrimary, lineHeight: 20, marginLeft: 12 },
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
  });
}
