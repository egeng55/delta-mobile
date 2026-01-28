/**
 * useInsightsData - Shared data hook for insights screens
 *
 * Provides cached data fetching for analytics, workout, and calendar data.
 * Used by TodayScreen, ActivityScreen, RecoveryScreen, and HistoryScreen.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import {
  insightsApi,
  InsightsData,
  workoutApi,
  WorkoutPlan,
  calendarApi,
  DailyLog,
  derivativesApi,
  DerivativesData,
  InsightCard as DerivativeCard,
  dashboardApi,
  DailyTargets as ApiDailyTargets,
  DashboardResponse,
  WorkoutDayTargets,
  healthIntelligenceApi,
  HealthStateResponse,
  CausalChain,
  MenstrualCalendarDay,
  MenstrualSettings,
  CyclePhase,
  // Delta Intelligence types
  DeltaInsightsResponse,
  DeltaCommentary,
  DigestionInsightsResponse,
} from '../services/api';
import * as menstrualService from '../services/menstrualTracking';

// Cache configuration
const CACHE_PREFIX = '@delta_insights_';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface CachedData<T> {
  data: T;
  timestamp: number;
}

const getCached = async <T,>(key: string): Promise<T | null> => {
  try {
    const cached = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (cached) {
      const parsed: CachedData<T> = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_DURATION_MS) {
        return parsed.data;
      }
    }
  } catch {
    // Ignore cache errors
  }
  return null;
};

const setCache = async <T,>(key: string, data: T): Promise<void> => {
  try {
    const cached: CachedData<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cached));
  } catch {
    // Ignore cache errors
  }
};

// Local targets interface for display
export interface DisplayTargets {
  calories: number;
  protein: number;
  water_oz: number;
  sleep_hours: number;
  workouts: number;
}

export interface TargetsInfo {
  isWorkoutDay: boolean;
  workoutDayTargets: WorkoutDayTargets | null;
  activityLevel: string | null;
  phase: string | null;
  bmr: number | null;
  tdee: number | null;
}

export const DEFAULT_TARGETS: DisplayTargets = {
  calories: 2000,
  protein: 150,
  water_oz: 64,
  sleep_hours: 8,
  workouts: 1,
};

// Weekly summary from dashboard API
export interface WeeklySummary {
  date: string;
  meals: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  workouts: number;
  workout_minutes: number;
  sleep_hours: number | null;
  sleep_quality: number | null;
  mood_avg: number | null;
  water_oz: number;
  weight: number | null;
}

export interface InsightsDataState {
  // Analytics data
  insights: InsightsData | null;
  derivatives: DerivativesData | null;
  derivativeCards: DerivativeCard[];
  weeklySummaries: WeeklySummary[];
  todaySummary: WeeklySummary | null;
  targets: DisplayTargets;
  targetsPersonalized: boolean;
  targetsInfo: TargetsInfo;
  healthState: HealthStateResponse | null;
  causalChains: CausalChain[];

  // Delta Intelligence - LLM-powered explanations
  deltaInsights: DeltaInsightsResponse | null;
  deltaCommentary: DeltaCommentary | null;
  digestionInsights: DigestionInsightsResponse | null;

  // Workout data
  workout: WorkoutPlan | null;

  // Calendar data
  monthLogs: DailyLog[];
  menstrualSettings: MenstrualSettings | null;
  menstrualCalendar: MenstrualCalendarDay[];
  cyclePhase: CyclePhase | null;

  // Loading states
  analyticsLoading: boolean;
  llmLoading: boolean;  // True while LLM-powered data loads in background
  workoutLoading: boolean;
  calendarLoading: boolean;
  error: string;

  // Actions
  fetchAnalyticsData: (forceRefresh?: boolean) => Promise<void>;
  fetchWorkoutData: (forceRefresh?: boolean) => Promise<void>;
  fetchCalendarData: (year: number, month: number, forceRefresh?: boolean) => Promise<void>;
  refreshAll: () => Promise<void>;
  invalidateCache: (tab: 'analytics' | 'workout' | 'calendar', refetch?: boolean) => Promise<void>;
}

export function useInsightsData(): InsightsDataState {
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';

  // Analytics state
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [derivatives, setDerivatives] = useState<DerivativesData | null>(null);
  const [derivativeCards, setDerivativeCards] = useState<DerivativeCard[]>([]);
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([]);
  const [todaySummary, setTodaySummary] = useState<WeeklySummary | null>(null);
  const [targets, setTargets] = useState<DisplayTargets>(DEFAULT_TARGETS);
  const [targetsPersonalized, setTargetsPersonalized] = useState<boolean>(false);
  const [targetsInfo, setTargetsInfo] = useState<TargetsInfo>({
    isWorkoutDay: false,
    workoutDayTargets: null,
    activityLevel: null,
    phase: null,
    bmr: null,
    tdee: null,
  });
  const [healthState, setHealthState] = useState<HealthStateResponse | null>(null);
  const [causalChains, setCausalChains] = useState<CausalChain[]>([]);

  // Delta Intelligence state
  const [deltaInsights, setDeltaInsights] = useState<DeltaInsightsResponse | null>(null);
  const [deltaCommentary, setDeltaCommentary] = useState<DeltaCommentary | null>(null);
  const [digestionInsights, setDigestionInsights] = useState<DigestionInsightsResponse | null>(null);

  // Workout state
  const [workout, setWorkout] = useState<WorkoutPlan | null>(null);

  // Calendar state
  const [monthLogs, setMonthLogs] = useState<DailyLog[]>([]);
  const [menstrualSettings, setMenstrualSettings] = useState<MenstrualSettings | null>(null);
  const [menstrualCalendar, setMenstrualCalendar] = useState<MenstrualCalendarDay[]>([]);
  const [cyclePhase, setCyclePhase] = useState<CyclePhase | null>(null);

  // Loading states
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(true);
  const [llmLoading, setLlmLoading] = useState<boolean>(false); // Separate state for LLM data
  const [workoutLoading, setWorkoutLoading] = useState<boolean>(false);
  const [calendarLoading, setCalendarLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Track loaded tabs
  const loadedTabs = useRef<Set<string>>(new Set());

  // Defaults
  const defaultInsights: InsightsData = useMemo(() => ({
    user_id: userId,
    total_conversations: 0,
    topics_discussed: [],
    wellness_score: 0,
    streak_days: 0,
  }), [userId]);

  const defaultDerivatives: DerivativesData = useMemo(() => ({
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
  }), []);

  const withTimeout = useCallback(<T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);
  }, []);

  // Fetch Analytics data
  const fetchAnalyticsData = useCallback(async (forceRefresh: boolean = false): Promise<void> => {
    const cacheKey = `analytics_${userId}`;

    if (!forceRefresh && loadedTabs.current.has('analytics')) {
      return; // Already loaded
    }

    if (!forceRefresh) {
      const cached = await getCached<{
        insights: InsightsData;
        derivatives: DerivativesData;
        cards: DerivativeCard[];
        weekly: WeeklySummary[];
        today: WeeklySummary | null;
        targets: DisplayTargets;
        targetsPersonalized: boolean;
        targetsInfo: TargetsInfo;
        healthState: HealthStateResponse | null;
        causalChains: CausalChain[];
        deltaInsights: DeltaInsightsResponse | null;
      }>(cacheKey);

      if (cached) {
        setInsights(cached.insights);
        setDerivatives(cached.derivatives);
        setDerivativeCards(cached.cards);
        setWeeklySummaries(cached.weekly);
        setTodaySummary(cached.today);
        setTargets(cached.targets);
        setTargetsPersonalized(cached.targetsPersonalized);
        setTargetsInfo(cached.targetsInfo);
        setHealthState(cached.healthState);
        setCausalChains(cached.causalChains ?? []);
        setDeltaInsights(cached.deltaInsights);
        setDeltaCommentary(cached.deltaInsights?.commentary ?? null);
        setAnalyticsLoading(false);
        loadedTabs.current.add('analytics');
        return;
      }
    }

    setAnalyticsLoading(true);
    setError('');

    try {
      const defaultWeekly = { weekly_summaries: [], days_count: 0 };
      const defaultDashboard: DashboardResponse = {
        today: null,
        streak: { current_streak: 0, longest_streak: 0, last_active_date: null },
        recent_entries: [],
        targets: DEFAULT_TARGETS as unknown as ApiDailyTargets,
        targets_calculated: false,
        targets_source: 'default',
      };
      const defaultHealthState: HealthStateResponse = { has_data: false };
      const defaultDeltaInsights: DeltaInsightsResponse = {
        user_id: userId,
        has_data: false,
        commentary: { headline: '', body: '', tone: 'neutral' },
        patterns: [],
        factors: [],
        interaction: null,
        readiness: null,
        cycle_context: null,
      };

      const defaultDigestion: DigestionInsightsResponse = {
        user_id: userId,
        has_data: false,
        summary: '',
        factors: [],
        suggestions: [],
      };

      // Phase 1: Fetch core data first (fast endpoints - no LLM calls)
      // These are pure database queries, should complete in <2 seconds
      const [insightsData, derivativesData, cardsData, weeklyData, dashboardData, healthStateData] = await Promise.all([
        withTimeout(insightsApi.getInsights(userId), 5000, defaultInsights),
        withTimeout(derivativesApi.getDerivatives(userId, 30), 5000, defaultDerivatives),
        withTimeout(derivativesApi.getCards(userId, 14), 5000, { cards: [], count: 0 }),
        withTimeout(dashboardApi.getWeekly(userId) as Promise<{ weekly_summaries: WeeklySummary[] }>, 5000, defaultWeekly),
        withTimeout(dashboardApi.getDashboard(userId), 5000, defaultDashboard),
        withTimeout(healthIntelligenceApi.getState(userId), 5000, defaultHealthState),
      ]);

      // Process targets immediately (no async needed)
      const isWorkoutDay = dashboardData.is_workout_day === true;
      const workoutDayTargets = dashboardData.workout_day_targets as WorkoutDayTargets | null;

      const newTargets: DisplayTargets = {
        calories: isWorkoutDay && workoutDayTargets
          ? workoutDayTargets.calories
          : (dashboardData.targets?.calories ?? DEFAULT_TARGETS.calories),
        protein: isWorkoutDay && workoutDayTargets
          ? workoutDayTargets.protein_g
          : (dashboardData.targets?.protein_g ?? DEFAULT_TARGETS.protein),
        water_oz: isWorkoutDay && workoutDayTargets
          ? workoutDayTargets.water_oz
          : (dashboardData.targets?.water_oz ?? DEFAULT_TARGETS.water_oz),
        sleep_hours: dashboardData.targets?.sleep_hours ?? DEFAULT_TARGETS.sleep_hours,
        workouts: 1,
      };

      const newTargetsInfo: TargetsInfo = {
        isWorkoutDay,
        workoutDayTargets,
        activityLevel: dashboardData.activity_level as string | null ?? null,
        phase: dashboardData.phase as string | null ?? null,
        bmr: dashboardData.bmr as number | null ?? null,
        tdee: dashboardData.tdee as number | null ?? null,
      };

      // Set ALL core data immediately so UI can render
      setInsights(insightsData);
      setDerivatives(derivativesData);
      setDerivativeCards(cardsData.cards);
      setHealthState(healthStateData);
      setCausalChains(healthStateData.causal_chains ?? []);
      setWeeklySummaries(weeklyData.weekly_summaries?.reverse() ?? []);
      setTodaySummary(dashboardData.today as WeeklySummary | null);
      setTargets(newTargets);
      setTargetsPersonalized(dashboardData.targets_calculated ?? false);
      setTargetsInfo(newTargetsInfo);

      // UI CAN RENDER NOW - set loading false
      setAnalyticsLoading(false);
      loadedTabs.current.add('analytics');

      // Phase 2: Fetch LLM-powered data in BACKGROUND (don't await!)
      // These call OpenAI and take 5-15 seconds - UI should NOT wait
      setLlmLoading(true);

      // Fire and forget - don't block with await
      Promise.all([
        withTimeout(healthIntelligenceApi.getInsights(userId), 20000, defaultDeltaInsights),
        withTimeout(healthIntelligenceApi.getDigestionInsights(userId), 20000, defaultDigestion),
      ]).then(([deltaInsightsData, digestionData]) => {
        // Update state when LLM data arrives (UI already rendered)
        setDeltaInsights(deltaInsightsData);
        setDeltaCommentary(deltaInsightsData.commentary);
        setDigestionInsights(digestionData);
        setLlmLoading(false);

        // Update cache with complete data
        setCache(cacheKey, {
          insights: insightsData,
          derivatives: derivativesData,
          cards: cardsData.cards,
          weekly: weeklyData.weekly_summaries?.reverse() ?? [],
          today: dashboardData.today as WeeklySummary | null,
          targets: newTargets,
          targetsPersonalized: dashboardData.targets_calculated ?? false,
          targetsInfo: newTargetsInfo,
          healthState: healthStateData,
          causalChains: healthStateData.causal_chains ?? [],
          deltaInsights: deltaInsightsData,
        });
      }).catch((err) => {
        console.log('[useInsightsData] LLM fetch failed:', err);
        setLlmLoading(false);
        // Keep default values - don't crash
      });
    } catch {
      setError('Could not load analytics');
      setInsights(defaultInsights);
      setDerivatives(defaultDerivatives);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [userId, defaultInsights, defaultDerivatives, withTimeout]);

  // Fetch Workout data
  const fetchWorkoutData = useCallback(async (forceRefresh: boolean = false): Promise<void> => {
    const cacheKey = `workout_${userId}`;

    if (!forceRefresh && loadedTabs.current.has('workout')) {
      return;
    }

    if (!forceRefresh) {
      const cached = await getCached<{ workout: WorkoutPlan | null }>(cacheKey);
      if (cached) {
        setWorkout(cached.workout);
        setWorkoutLoading(false);
        loadedTabs.current.add('workout');
        return;
      }
    }

    setWorkoutLoading(true);

    try {
      const workoutData = await withTimeout(workoutApi.getToday(userId), 8000, { workout: null });
      setWorkout(workoutData.workout);
      await setCache(cacheKey, { workout: workoutData.workout });
      loadedTabs.current.add('workout');
    } catch {
      setWorkout(null);
    } finally {
      setWorkoutLoading(false);
    }
  }, [userId, withTimeout]);

  // Fetch Calendar data
  const fetchCalendarData = useCallback(async (
    year: number,
    month: number,
    forceRefresh: boolean = false
  ): Promise<void> => {
    const cacheKey = `calendar_${userId}_${year}_${month}`;

    if (!forceRefresh) {
      const cached = await getCached<{
        logs: DailyLog[];
        menstrualSettings: MenstrualSettings | null;
        menstrualCalendar: MenstrualCalendarDay[];
        cyclePhase: CyclePhase | null;
        weeklySummaries: WeeklySummary[];
      }>(cacheKey);
      if (cached) {
        setMonthLogs(cached.logs);
        setMenstrualSettings(cached.menstrualSettings);
        setMenstrualCalendar(cached.menstrualCalendar);
        setCyclePhase(cached.cyclePhase);
        if (cached.weeklySummaries) {
          setWeeklySummaries(cached.weeklySummaries);
        }
        setCalendarLoading(false);
        loadedTabs.current.add('calendar');
        return;
      }
    }

    setCalendarLoading(true);

    try {
      const defaultWeekly = { weekly_summaries: [] as WeeklySummary[] };
      const [monthData, menstrualSettingsData, weeklyData] = await Promise.all([
        withTimeout(calendarApi.getMonthLogs(userId, year, month), 8000, { logs: [], days_count: 0, year, month }),
        menstrualService.getSettings(userId),
        withTimeout(dashboardApi.getWeekly(userId) as Promise<{ weekly_summaries: WeeklySummary[] }>, 8000, defaultWeekly),
      ]);

      setMonthLogs(monthData.logs);
      setMenstrualSettings(menstrualSettingsData);
      const reversedWeekly = [...(weeklyData.weekly_summaries ?? [])].reverse();
      setWeeklySummaries(reversedWeekly);

      let calendarData: MenstrualCalendarDay[] = [];
      let phase: CyclePhase | null = null;

      if (menstrualSettingsData.tracking_enabled === true) {
        const menstrualLogs = await menstrualService.getMonthLogs(userId, year, month);
        calendarData = menstrualService.generateCalendarData(year, month, menstrualLogs, menstrualSettingsData);
        setMenstrualCalendar(calendarData);

        phase = menstrualService.calculateCyclePhase(
          menstrualSettingsData.last_period_start,
          menstrualSettingsData.average_cycle_length,
          menstrualSettingsData.average_period_length
        );
        setCyclePhase(phase);
      }

      await setCache(cacheKey, {
        logs: monthData.logs,
        menstrualSettings: menstrualSettingsData,
        menstrualCalendar: calendarData,
        cyclePhase: phase,
        weeklySummaries: reversedWeekly,
      });

      loadedTabs.current.add('calendar');
    } catch {
      setMonthLogs([]);
    } finally {
      setCalendarLoading(false);
    }
  }, [userId, withTimeout]);

  // Refresh all data
  const refreshAll = useCallback(async (): Promise<void> => {
    loadedTabs.current.clear();
    await Promise.all([
      fetchAnalyticsData(true),
      fetchWorkoutData(true),
    ]);
  }, [fetchAnalyticsData, fetchWorkoutData]);

  // Invalidate cache for a specific tab and optionally refetch
  const invalidateCache = useCallback(async (
    tab: 'analytics' | 'workout' | 'calendar',
    refetch: boolean = false
  ): Promise<void> => {
    loadedTabs.current.delete(tab);
    const cacheKey = `${CACHE_PREFIX}${tab}_${userId}`;
    await AsyncStorage.removeItem(cacheKey);

    // Optionally trigger immediate refetch
    if (refetch) {
      if (tab === 'analytics') {
        fetchAnalyticsData(true);
      } else if (tab === 'workout') {
        fetchWorkoutData(true);
      } else if (tab === 'calendar') {
        const now = new Date();
        fetchCalendarData(now.getFullYear(), now.getMonth() + 1, true);
      }
    }
  }, [userId, fetchAnalyticsData, fetchWorkoutData, fetchCalendarData]);

  return {
    // Analytics data
    insights,
    derivatives,
    derivativeCards,
    weeklySummaries,
    todaySummary,
    targets,
    targetsPersonalized,
    targetsInfo,
    healthState,
    causalChains,

    // Delta Intelligence - LLM-powered explanations
    deltaInsights,
    deltaCommentary,
    digestionInsights,

    // Workout data
    workout,

    // Calendar data
    monthLogs,
    menstrualSettings,
    menstrualCalendar,
    cyclePhase,

    // Loading states
    analyticsLoading,
    llmLoading,  // True while LLM endpoints load (show skeleton cards)
    workoutLoading,
    calendarLoading,
    error,

    // Actions
    fetchAnalyticsData,
    fetchWorkoutData,
    fetchCalendarData,
    refreshAll,
    invalidateCache,
  };
}
