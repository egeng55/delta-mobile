/**
 * Prefetch Service - Preload data during splash animation.
 *
 * Called during WelcomeAnimationScreen to fetch and cache data
 * before the user arrives at the main screens.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCacheEnvelope, trimArrayToLimit } from './storage/cachePolicy';
import {
  insightsApi,
  workoutApi,
  derivativesApi,
  dashboardApi,
  healthIntelligenceApi,
} from './api';

const CACHE_PREFIX = '@delta_insights_';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const MAX_PREFETCH_CARDS = 10;
const MAX_PREFETCH_WEEKLY_SUMMARIES = 14;
const MAX_PREFETCH_CAUSAL_CHAINS = 10;
const MAX_PREFETCH_MODULES = 10;

const setCache = async <T,>(key: string, data: T): Promise<void> => {
  try {
    const cached = createCacheEnvelope(data, CACHE_DURATION_MS, {
      category: 'prefetch_insights_cache',
      key,
    });
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cached));
  } catch {
    // Ignore cache errors
  }
};

const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
};

function minimizePrefetchAnalyticsPayload(data: Record<string, unknown>): Record<string, unknown> {
  return {
    ...data,
    cards: trimArrayToLimit(Array.isArray(data.cards) ? data.cards : [], MAX_PREFETCH_CARDS),
    weekly: trimArrayToLimit(Array.isArray(data.weekly) ? data.weekly : [], MAX_PREFETCH_WEEKLY_SUMMARIES),
    causalChains: trimArrayToLimit(
      Array.isArray(data.causalChains) ? data.causalChains : [],
      MAX_PREFETCH_CAUSAL_CHAINS
    ),
    modules: trimArrayToLimit(Array.isArray(data.modules) ? data.modules : [], MAX_PREFETCH_MODULES),
  };
}

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
  const defaultModules = { user_id: userId, has_data: false, modules: [] };

  try {
    // Fire modules request early (LLM endpoint, takes 5-15s) - don't await
    // This warms up the backend and starts generation while we fetch core data
    const modulesPromise = healthIntelligenceApi.getModules(userId).catch(() => defaultModules);

    // Fetch all core data in parallel (fast endpoints)
    const [insightsData, derivativesData, cardsData, weeklyData, dashboardData, healthStateData, workoutData] = await Promise.all([
      withTimeout(insightsApi.getInsights(userId), 6000, defaultInsights),
      withTimeout(derivativesApi.getDerivatives(userId, 30), 6000, defaultDerivatives),
      withTimeout(derivativesApi.getCards(userId, 14), 6000, { cards: [], count: 0 }),
      withTimeout(dashboardApi.getWeekly(userId), 6000, defaultWeekly),
      withTimeout(dashboardApi.getDashboard(userId), 6000, defaultDashboard),
      withTimeout(healthIntelligenceApi.getState(userId), 6000, defaultHealthState),
      withTimeout(workoutApi.getToday(userId), 6000, { workout: null }),
    ]);

    // Also await modules if it finishes in time (15s timeout)
    const modulesData = await withTimeout(modulesPromise, 15000, defaultModules);

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

    await setCache(`analytics_${userId}`, minimizePrefetchAnalyticsPayload({
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
      // Include modules if prefetch succeeded
      modules: (modulesData as { modules?: unknown[] }).modules ?? [],
    }));

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
