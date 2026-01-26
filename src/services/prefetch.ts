/**
 * Prefetch Service - Preload data during splash animation.
 *
 * Called during WelcomeAnimationScreen to fetch and cache data
 * before the user arrives at the main screens.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  insightsApi,
  workoutApi,
  derivativesApi,
  dashboardApi,
  healthIntelligenceApi,
} from './api';

const CACHE_PREFIX = '@delta_insights_';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface CachedData<T> {
  data: T;
  timestamp: number;
}

const setCache = async <T,>(key: string, data: T): Promise<void> => {
  try {
    const cached: CachedData<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cached));
  } catch {
    // Ignore cache errors
  }
};

const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
};

/**
 * Prefetch all initial app data for a user.
 * Call this during the welcome animation to preload cache.
 */
export async function prefetchAppData(userId: string): Promise<void> {
  const DEFAULT_TARGETS = {
    calories: 2000,
    protein_g: 150,
    carbs_g: 250,
    fat_g: 65,
    water_oz: 64,
    sleep_hours: 8,
    workouts_per_week: 3,
  };

  const defaultInsights = {
    user_id: userId,
    total_conversations: 0,
    topics_discussed: [],
    wellness_score: 0,
    streak_days: 0,
  };

  const defaultDerivatives = {
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

  const defaultDashboard = {
    today: null,
    streak: { current_streak: 0, longest_streak: 0, last_active_date: null },
    recent_entries: [],
    targets: DEFAULT_TARGETS,
    targets_calculated: false,
    targets_source: 'default' as const,
  };

  const defaultHealthState = { has_data: false };
  const defaultWeekly = { weekly_summaries: [], days_count: 0 };

  try {
    // Fetch all data in parallel
    const [insightsData, derivativesData, cardsData, weeklyData, dashboardData, healthStateData, workoutData] = await Promise.all([
      withTimeout(insightsApi.getInsights(userId), 6000, defaultInsights),
      withTimeout(derivativesApi.getDerivatives(userId, 30), 6000, defaultDerivatives),
      withTimeout(derivativesApi.getCards(userId, 14), 6000, { cards: [], count: 0 }),
      withTimeout(dashboardApi.getWeekly(userId), 6000, defaultWeekly),
      withTimeout(dashboardApi.getDashboard(userId), 6000, defaultDashboard),
      withTimeout(healthIntelligenceApi.getState(userId), 6000, defaultHealthState),
      withTimeout(workoutApi.getToday(userId), 6000, { workout: null }),
    ]);

    // Cache analytics data
    const isWorkoutDay = (dashboardData as { is_workout_day?: boolean }).is_workout_day === true;
    const workoutDayTargets = (dashboardData as { workout_day_targets?: unknown }).workout_day_targets;

    const targets = {
      calories: isWorkoutDay && workoutDayTargets
        ? (workoutDayTargets as { calories: number }).calories
        : ((dashboardData as { targets?: { calories?: number } }).targets?.calories ?? DEFAULT_TARGETS.calories),
      protein: isWorkoutDay && workoutDayTargets
        ? (workoutDayTargets as { protein_g: number }).protein_g
        : ((dashboardData as { targets?: { protein_g?: number } }).targets?.protein_g ?? DEFAULT_TARGETS.protein_g),
      water_oz: isWorkoutDay && workoutDayTargets
        ? (workoutDayTargets as { water_oz: number }).water_oz
        : ((dashboardData as { targets?: { water_oz?: number } }).targets?.water_oz ?? DEFAULT_TARGETS.water_oz),
      sleep_hours: (dashboardData as { targets?: { sleep_hours?: number } }).targets?.sleep_hours ?? DEFAULT_TARGETS.sleep_hours,
      workouts: 1,
    };

    const targetsInfo = {
      isWorkoutDay,
      workoutDayTargets: workoutDayTargets ?? null,
      activityLevel: (dashboardData as { activity_level?: string }).activity_level ?? null,
      phase: (dashboardData as { phase?: string }).phase ?? null,
      bmr: (dashboardData as { bmr?: number }).bmr ?? null,
      tdee: (dashboardData as { tdee?: number }).tdee ?? null,
    };

    await setCache(`analytics_${userId}`, {
      insights: insightsData,
      derivatives: derivativesData,
      cards: (cardsData as { cards: unknown[] }).cards,
      weekly: ((weeklyData as { weekly_summaries?: unknown[] }).weekly_summaries ?? []).reverse(),
      today: (dashboardData as { today?: unknown }).today ?? null,
      targets,
      targetsPersonalized: (dashboardData as { targets_calculated?: boolean }).targets_calculated ?? false,
      targetsInfo,
      healthState: healthStateData,
      causalChains: (healthStateData as { causal_chains?: unknown[] }).causal_chains ?? [],
    });

    // Cache workout data
    await setCache(`workout_${userId}`, {
      workout: (workoutData as { workout: unknown }).workout,
    });

    console.log('Prefetch: Data cached successfully');
  } catch (error) {
    console.log('Prefetch: Failed to cache data', error);
    // Silent fail - screens will fetch data normally if prefetch fails
  }
}
