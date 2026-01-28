/**
 * InsightsScreen - Analytics, workout tracking, and calendar view.
 *
 * Calendar displays data parsed from chat conversations.
 * Analytics shows derivative trends and patterns.
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
  Modal,
  Switch,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInRight, FadeInUp } from 'react-native-reanimated';
import { AnimatedCard, AnimatedListItem, AnimatedProgress, AnimatedButton, FadeInView } from '../components/Animated';
import LineChart, { DataPoint } from '../components/LineChart';
import { AvatarCanvas } from '../components/Avatar';
import { UserAvatar, AvatarInsight, DEFAULT_AVATAR } from '../types/avatar';
import { avatarService } from '../services/avatarService';
import AvatarCustomizeScreen from './AvatarCustomizeScreen';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useAccess } from '../context/AccessContext';

// No cache - always fetch fresh data
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
  MenstrualCalendarDay,
  MenstrualSettings,
  FlowIntensity,
  MenstrualSymptom,
  CyclePhase,
  dashboardApi,
  DailyTargets as ApiDailyTargets,
  DashboardResponse,
  WorkoutDayTargets,
  healthIntelligenceApi,
  HealthStateResponse,
  CausalChain,
} from '../services/api';
import { StateCard, AlignmentRing } from '../components/HealthState';
import { ChainCard } from '../components/CausalChain';
import * as menstrualService from '../services/menstrualTracking';
import healthKitService, { SleepSummary, HealthSummary } from '../services/healthKit';
import { useDayChange } from '../hooks/useDayChange';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Local targets interface for display
interface DisplayTargets {
  calories: number;
  protein: number;
  water_oz: number;
  sleep_hours: number;
  workouts: number;
}

interface TargetsInfo {
  isWorkoutDay: boolean;
  workoutDayTargets: WorkoutDayTargets | null;
  activityLevel: string | null;
  phase: string | null;
  bmr: number | null;
  tdee: number | null;
}

const DEFAULT_TARGETS: DisplayTargets = {
  calories: 2000,
  protein: 150,
  water_oz: 64,
  sleep_hours: 8,
  workouts: 1,
};

// Weekly summary from dashboard API
interface WeeklySummary {
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

// Get local date string in YYYY-MM-DD format (phone's timezone, not UTC)
const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

// Map semantic color names from API to actual theme colors
const mapCardColor = (colorName: string | undefined, theme: Theme): string => {
  if (!colorName) return theme.accent;
  const colorMap: Record<string, string> = {
    accent: theme.accent,
    warning: theme.warning,
    success: theme.success,
    error: theme.error,
    primary: theme.accent, // Use accent as primary
    secondary: theme.textSecondary,
  };
  return colorMap[colorName] ?? theme.accent;
};

export default function InsightsScreen({ theme }: InsightsScreenProps): React.ReactNode {
  const { user } = useAuth();
  const { hasAccess, isLoading: accessLoading, showPaywall, isDeveloper } = useAccess();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabType>('analytics');
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [derivatives, setDerivatives] = useState<DerivativesData | null>(null);
  const [derivativeCards, setDerivativeCards] = useState<DerivativeCard[]>([]);
  const [workout, setWorkout] = useState<WorkoutPlan | null>(null);
  const [monthLogs, setMonthLogs] = useState<DailyLog[]>([]);
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([]);
  const [todaySummary, setTodaySummary] = useState<WeeklySummary | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [weights, setWeights] = useState<Record<string, string>>({});
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
  const [selectedChartMetric, setSelectedChartMetric] = useState<'calories' | 'protein' | 'sleep' | 'workouts'>('calories');

  // Avatar state
  const [userAvatar, setUserAvatar] = useState<UserAvatar>(DEFAULT_AVATAR);
  const [avatarInsights, setAvatarInsights] = useState<AvatarInsight[]>([]);
  const [showAvatarCustomize, setShowAvatarCustomize] = useState<boolean>(false);

  // Track which tabs have been loaded
  const loadedTabs = useRef<Set<TabType>>(new Set());
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(true);
  const [workoutLoading, setWorkoutLoading] = useState<boolean>(false);
  const [calendarLoading, setCalendarLoading] = useState<boolean>(false);

  // HealthKit state
  const [healthKitAuthorized, setHealthKitAuthorized] = useState<boolean>(false);
  const [healthKitSleep, setHealthKitSleep] = useState<SleepSummary | null>(null);
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);

  // Menstrual tracking state
  const [menstrualSettings, setMenstrualSettings] = useState<MenstrualSettings | null>(null);
  const [menstrualCalendar, setMenstrualCalendar] = useState<MenstrualCalendarDay[]>([]);
  const [cyclePhase, setCyclePhase] = useState<CyclePhase | null>(null);
  const [showPeriodModal, setShowPeriodModal] = useState<boolean>(false);
  const [periodModalDate, setPeriodModalDate] = useState<string>('');
  const [selectedFlow, setSelectedFlow] = useState<FlowIntensity>('medium');
  const [selectedSymptoms, setSelectedSymptoms] = useState<MenstrualSymptom[]>([]);
  const [isSavingPeriod, setIsSavingPeriod] = useState<boolean>(false);

  // Health Intelligence state
  const [healthState, setHealthState] = useState<HealthStateResponse | null>(null);
  const [causalChains, setCausalChains] = useState<CausalChain[]>([]);
  const [showCausalChains, setShowCausalChains] = useState<boolean>(false);

  const userId = user?.id ?? 'anonymous';

  // Default data structures
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

  // Fetch Analytics tab data (dashboard, derivatives, weekly summaries)
  const fetchAnalyticsData = useCallback(async (): Promise<void> => {
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

      // Progressive loading: fire all requests, update UI as each resolves
      const insightsP = withTimeout(insightsApi.getInsights(userId), 8000, defaultInsights);
      const derivativesP = withTimeout(derivativesApi.getDerivatives(userId, 30), 8000, defaultDerivatives);
      const cardsP = withTimeout(derivativesApi.getCards(userId, 14), 8000, { cards: [], count: 0 });
      const weeklyP = withTimeout(dashboardApi.getWeekly(userId) as Promise<{ weekly_summaries: WeeklySummary[] }>, 8000, defaultWeekly);
      const dashboardP = withTimeout(dashboardApi.getDashboard(userId), 8000, defaultDashboard);
      const healthStateP = withTimeout(healthIntelligenceApi.getState(userId), 8000, defaultHealthState);

      // Update UI as each promise resolves (don't block on slowest)
      insightsP.then(d => setInsights(d));
      derivativesP.then(d => { setDerivatives(d); });
      cardsP.then(d => setDerivativeCards(d.cards));
      weeklyP.then(d => setWeeklySummaries(d.weekly_summaries?.reverse() ?? []));
      healthStateP.then(d => { setHealthState(d); setCausalChains(d.causal_chains ?? []); });

      // Dashboard has complex processing, await it
      const dashboardData = await dashboardP;
      setTodaySummary(dashboardData.today as WeeklySummary | null);

      // Wait for remaining to finish (they already started, just ensuring no unhandled rejections)
      await Promise.allSettled([insightsP, derivativesP, cardsP, weeklyP, healthStateP]);

      // Set personalized targets from dashboard
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

      setTargets(newTargets);
      setTargetsPersonalized(dashboardData.targets_calculated ?? false);
      setTargetsInfo(newTargetsInfo);

      loadedTabs.current.add('analytics');
    } catch {
      setError('Could not load analytics');
      setInsights(defaultInsights);
      setDerivatives(defaultDerivatives);
    } finally {
      setAnalyticsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId, defaultInsights, defaultDerivatives, withTimeout]);

  // Fetch Workout tab data
  const fetchWorkoutData = useCallback(async (): Promise<void> => {
    setWorkoutLoading(true);
    try {
      const workoutData = await withTimeout(workoutApi.getToday(userId), 8000, { workout: null });
      setWorkout(workoutData.workout);
      loadedTabs.current.add('workout');
    } catch {
      setWorkout(null);
    } finally {
      setWorkoutLoading(false);
    }
  }, [userId, withTimeout]);

  // Fetch Calendar tab data
  const fetchCalendarData = useCallback(async (): Promise<void> => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth() + 1;

    setCalendarLoading(true);

    try {
      const [monthData, menstrualSettingsData] = await Promise.all([
        withTimeout(calendarApi.getMonthLogs(userId, year, month), 8000, { logs: [], days_count: 0, year, month }),
        menstrualService.getSettings(userId),
      ]);

      setMonthLogs(monthData.logs);
      setMenstrualSettings(menstrualSettingsData);

      // Load menstrual calendar data if tracking is enabled
      if (menstrualSettingsData.tracking_enabled === true) {
        const menstrualLogs = await menstrualService.getMonthLogs(userId, year, month);
        const calendarData = menstrualService.generateCalendarData(year, month, menstrualLogs, menstrualSettingsData);
        setMenstrualCalendar(calendarData);

        const phase = menstrualService.calculateCyclePhase(
          menstrualSettingsData.last_period_start,
          menstrualSettingsData.average_cycle_length,
          menstrualSettingsData.average_period_length
        );
        setCyclePhase(phase);
      }

      loadedTabs.current.add('calendar');
    } catch {
      setMonthLogs([]);
    } finally {
      setCalendarLoading(false);
    }
  }, [userId, calendarDate, withTimeout]);

  // Fetch HealthKit data (runs in background, doesn't block UI)
  const fetchHealthKitData = useCallback(async (): Promise<void> => {
    if (!healthKitService.isHealthKitAvailable()) return;

    try {
      const authorized = await healthKitService.isAuthorized();
      setHealthKitAuthorized(authorized);

      if (authorized) {
        const [summary, sleepData] = await Promise.all([
          healthKitService.getTodayHealthSummary(),
          healthKitService.getSleepSummary(new Date()),
        ]);
        setHealthSummary(summary);
        setHealthKitSleep(sleepData);
      }
    } catch (healthKitError) {
      console.log('HealthKit data fetch error:', healthKitError);
    }
  }, []);

  // Load data for the active tab - always fetches fresh data
  const loadTabData = useCallback(async (tab: TabType): Promise<void> => {
    switch (tab) {
      case 'analytics':
        await fetchAnalyticsData();
        fetchHealthKitData();
        break;
      case 'workout':
        await fetchWorkoutData();
        break;
      case 'calendar':
        await fetchCalendarData();
        break;
    }
  }, [fetchAnalyticsData, fetchWorkoutData, fetchCalendarData, fetchHealthKitData]);

  // Load initial tab on mount
  useEffect(() => {
    loadTabData('analytics');
  }, [userId]);

  // Refresh data when screen comes into focus (e.g., after logging food in chat)
  useFocusEffect(
    useCallback(() => {
      loadTabData(activeTab);
    }, [activeTab, loadTabData])
  );

  // Refresh data when day changes (midnight or app foregrounded on new day)
  useDayChange(() => {
    loadTabData(activeTab);
  });

  // Load data when tab changes
  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  // Reload calendar when month changes
  useEffect(() => {
    if (activeTab === 'calendar') {
      fetchCalendarData();
    }
  }, [calendarDate]);

  // Load user's avatar on mount
  useEffect(() => {
    const loadAvatar = async () => {
      if (userId && userId !== 'anonymous') {
        const avatar = await avatarService.getAvatar(userId);
        setUserAvatar(avatar);
      }
    };
    loadAvatar();
  }, [userId]);

  // Generate avatar insights from derivative cards and today's progress
  useEffect(() => {
    if (derivativeCards.length > 0 || todaySummary) {
      const insights: AvatarInsight[] = [];

      // Map derivative cards to avatar insights
      derivativeCards.slice(0, 3).forEach((card, index) => {
        const mapped = avatarService.mapInsightsToAvatar([{
          id: card.id ?? `card_${index}`,
          text: card.subtitle ?? card.title,
          type: card.title.toLowerCase(),
        }]);
        insights.push(...mapped);
      });

      // Add today's progress as insights if available
      if (todaySummary) {
        if (todaySummary.protein > 0) {
          const proteinPercent = Math.round((todaySummary.protein / targets.protein) * 100);
          insights.push({
            id: 'today_protein',
            text: `${todaySummary.protein}g protein today`,
            shortLabel: proteinPercent >= 80 ? 'On track' : 'Low protein',
            category: 'protein',
            sentiment: proteinPercent >= 80 ? 'positive' : proteinPercent >= 50 ? 'neutral' : 'attention',
            icon: 'nutrition',
            region: 'stomach',
          });
        }

        if (todaySummary.sleep_hours && todaySummary.sleep_hours > 0) {
          insights.push({
            id: 'today_sleep',
            text: `${todaySummary.sleep_hours}h sleep`,
            shortLabel: todaySummary.sleep_hours >= 7 ? 'Well rested' : 'Rest more',
            category: 'sleep',
            sentiment: todaySummary.sleep_hours >= 7 ? 'positive' : 'attention',
            icon: 'moon',
            region: 'head',
          });
        }

        if (todaySummary.workouts > 0) {
          insights.push({
            id: 'today_workout',
            text: `${todaySummary.workouts} workout${todaySummary.workouts > 1 ? 's' : ''} logged`,
            shortLabel: 'Active',
            category: 'cardio',
            sentiment: 'positive',
            icon: 'barbell',
            region: 'chest',
          });
        }
      }

      setAvatarInsights(insights);
    }
  }, [derivativeCards, todaySummary, targets.protein]);

  // Combined loading state for backwards compatibility
  const isLoading = activeTab === 'analytics' ? analyticsLoading :
                    activeTab === 'workout' ? workoutLoading :
                    calendarLoading;

  const onRefresh = (): void => {
    setIsRefreshing(true);
    loadTabData(activeTab).finally(() => setIsRefreshing(false));
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
      await fetchWorkoutData(true);
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
      await fetchWorkoutData(true);
      // Also refresh analytics since workout completion affects daily stats
      loadedTabs.current.delete('analytics');
      Alert.alert('Workout Complete!', 'Great job! Your workout has been logged.');
    } catch {
      setError('Could not complete workout');
    }
  };

  // Menstrual tracking functions
  const openPeriodModal = (date: string): void => {
    setPeriodModalDate(date);
    setSelectedFlow('medium');
    setSelectedSymptoms([]);
    setShowPeriodModal(true);
  };

  const closePeriodModal = (): void => {
    setShowPeriodModal(false);
    setPeriodModalDate('');
    setSelectedFlow('medium');
    setSelectedSymptoms([]);
  };

  const toggleSymptom = (symptom: MenstrualSymptom): void => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const savePeriodLog = async (): Promise<void> => {
    if (periodModalDate.length === 0) return;

    setIsSavingPeriod(true);
    try {
      await menstrualService.logEvent(
        userId,
        periodModalDate,
        'period_start',
        selectedFlow,
        selectedSymptoms.length > 0 ? selectedSymptoms : undefined
      );
      closePeriodModal();
      await fetchCalendarData(true);
      Alert.alert('Logged', 'Period start logged successfully.');
    } catch {
      Alert.alert('Error', 'Could not save period log.');
    } finally {
      setIsSavingPeriod(false);
    }
  };

  const removePeriodLog = async (date: string): Promise<void> => {
    Alert.alert(
      'Remove Period Log',
      'Are you sure you want to remove this period log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            // Find and delete the log
            const year = calendarDate.getFullYear();
            const month = calendarDate.getMonth() + 1;
            const logs = await menstrualService.getMonthLogs(userId, year, month);
            const log = logs.find(l => l.date === date && l.event_type === 'period_start');
            if (log !== undefined) {
              await menstrualService.deleteLog(log.id);
              await fetchCalendarData(true);
            }
          },
        },
      ]
    );
  };

  // Pre-indexed menstrual calendar for O(1) lookup instead of O(n) per day
  const menstrualDayMap = useMemo(() => {
    return new Map(menstrualCalendar.map(d => [d.date, d]));
  }, [menstrualCalendar]);

  const getMenstrualDayData = useCallback((dateStr: string): MenstrualCalendarDay | undefined => {
    return menstrualDayMap.get(dateStr);
  }, [menstrualDayMap]);

  // Memoize progress calculation
  const progressPercentage = useMemo((): number => {
    if (workout === null) return 0;
    const exercises = workout.exercise_details ?? [];
    if (exercises.length === 0) return 0;
    const completed = exercises.filter(e => e.completed === true).length;
    return Math.round((completed / exercises.length) * 100);
  }, [workout]);

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

  // Memoize trend cards to prevent recalculation on every render
  const trendCards = useMemo(() => buildTrendCards(), [derivatives, insights, theme]);

  // Build chart data from weekly summaries
  const chartData = useMemo((): DataPoint[] => {
    if (weeklySummaries.length === 0) return [];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return weeklySummaries.map(summary => {
      const date = new Date(summary.date);
      const label = dayNames[date.getDay()];
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
        case 'workouts':
          value = summary.workout_minutes > 0 ? summary.workout_minutes : null;
          break;
      }

      return { label, value };
    });
  }, [weeklySummaries, selectedChartMetric]);

  // Get current target based on selected metric
  const currentTarget = useMemo((): number | undefined => {
    switch (selectedChartMetric) {
      case 'calories':
        return targets.calories;
      case 'protein':
        return targets.protein;
      case 'sleep':
        return targets.sleep_hours;
      case 'workouts':
        return 45; // 45 min workout target
      default:
        return undefined;
    }
  }, [selectedChartMetric, targets]);

  // Calculate today's progress
  const todayProgress = useMemo(() => {
    const summary = todaySummary;
    if (!summary) {
      return {
        calories: { current: 0, target: targets.calories, percent: 0 },
        protein: { current: 0, target: targets.protein, percent: 0 },
        water: { current: 0, target: targets.water_oz, percent: 0 },
        workouts: { current: 0, target: targets.workouts, percent: 0 },
      };
    }

    return {
      calories: {
        current: summary.calories,
        target: targets.calories,
        percent: Math.min(100, Math.round((summary.calories / targets.calories) * 100)),
      },
      protein: {
        current: summary.protein,
        target: targets.protein,
        percent: Math.min(100, Math.round((summary.protein / targets.protein) * 100)),
      },
      water: {
        current: summary.water_oz,
        target: targets.water_oz,
        percent: Math.min(100, Math.round((summary.water_oz / targets.water_oz) * 100)),
      },
      workouts: {
        current: summary.workouts,
        target: targets.workouts,
        percent: Math.min(100, summary.workouts >= targets.workouts ? 100 : 0),
      },
    };
  }, [todaySummary, targets]);

  // Calculate weekly totals and averages
  const weeklyStats = useMemo(() => {
    if (weeklySummaries.length === 0) {
      return {
        totalCalories: 0,
        avgCalories: 0,
        totalProtein: 0,
        avgProtein: 0,
        totalWorkouts: 0,
        avgSleep: 0,
        daysLogged: 0,
      };
    }

    // Exclude today from averages - only count completed days
    const today = getLocalDateString();
    const completedDays = weeklySummaries.filter(s => s.date !== today);

    const daysWithCalories = completedDays.filter(s => s.calories > 0);
    const daysWithSleep = completedDays.filter(s => s.sleep_hours !== null);
    const daysWithProtein = completedDays.filter(s => s.protein > 0);

    const totalCalories = daysWithCalories.reduce((sum, s) => sum + s.calories, 0);
    const totalProtein = daysWithProtein.reduce((sum, s) => sum + s.protein, 0);
    const totalWorkouts = completedDays.reduce((sum, s) => sum + s.workouts, 0);
    const totalSleep = daysWithSleep.reduce((sum, s) => sum + (s.sleep_hours ?? 0), 0);

    return {
      totalCalories,
      avgCalories: daysWithCalories.length > 0 ? Math.round(totalCalories / daysWithCalories.length) : 0,
      totalProtein,
      avgProtein: daysWithProtein.length > 0 ? Math.round(totalProtein / daysWithProtein.length) : 0,
      totalWorkouts,
      avgSleep: daysWithSleep.length > 0 ? Math.round((totalSleep / daysWithSleep.length) * 10) / 10 : 0,
      daysLogged: daysWithCalories.length,
    };
  }, [weeklySummaries]);

  // Build calendar grid
  const renderCalendar = (): React.ReactNode => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = getLocalDateString();

    const logDates = new Set(monthLogs.map(l => l.date));
    const isCycleTrackingEnabled = menstrualSettings?.tracking_enabled === true;

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

      // Get menstrual data for this day
      const menstrualDay = isCycleTrackingEnabled ? getMenstrualDayData(dateStr) : undefined;

      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            isToday && styles.calendarDayToday,
            isSelected && styles.calendarDaySelected,
            menstrualDay?.is_period === true && styles.calendarDayPeriod,
            menstrualDay?.is_predicted_period === true && styles.calendarDayPredictedPeriod,
          ]}
          onPress={() => selectDate(dateStr)}
          onLongPress={() => {
            if (isCycleTrackingEnabled) {
              if (menstrualDay?.is_period === true) {
                removePeriodLog(dateStr);
              } else {
                openPeriodModal(dateStr);
              }
            }
          }}
        >
          <Text
            style={[
              styles.calendarDayText,
              isToday && styles.calendarDayTextToday,
              isSelected && styles.calendarDayTextSelected,
              menstrualDay?.is_period === true && styles.calendarDayTextPeriod,
            ]}
          >
            {day}
          </Text>
          <View style={styles.calendarDots}>
            {hasData && <View style={[styles.calendarDot, { backgroundColor: theme.success }]} />}
            {menstrualDay?.is_period === true && (
              <View style={[styles.calendarDot, { backgroundColor: '#E57373' }]} />
            )}
            {menstrualDay?.is_predicted_period === true && !menstrualDay?.is_period && (
              <View style={[styles.calendarDot, { backgroundColor: '#E5737380' }]} />
            )}
            {menstrualDay?.is_ovulation === true && (
              <View style={[styles.calendarDot, { backgroundColor: '#64B5F6' }]} />
            )}
            {menstrualDay?.is_fertile === true && !menstrualDay?.is_ovulation && (
              <View style={[styles.calendarDot, { backgroundColor: '#81C784' }]} />
            )}
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

        {/* Cycle phase indicator */}
        {isCycleTrackingEnabled && cyclePhase !== null && (
          <View style={styles.cyclePhaseCard}>
            <View style={[styles.cyclePhaseIcon, { backgroundColor: menstrualService.getPhaseColor(cyclePhase.phase) + '20' }]}>
              <Ionicons
                name={cyclePhase.phase === 'menstrual' ? 'water' : cyclePhase.phase === 'ovulation' ? 'sunny' : 'leaf'}
                size={20}
                color={menstrualService.getPhaseColor(cyclePhase.phase)}
              />
            </View>
            <View style={styles.cyclePhaseInfo}>
              <Text style={styles.cyclePhaseTitle}>{menstrualService.getPhaseLabel(cyclePhase.phase)}</Text>
              <Text style={styles.cyclePhaseSubtitle}>
                Day {cyclePhase.day_in_cycle}
                {cyclePhase.days_until_period !== null && ` • ${cyclePhase.days_until_period} days until period`}
                {cyclePhase.is_fertile_window && ' • Fertile window'}
              </Text>
            </View>
          </View>
        )}

        {/* Cycle tracking legend */}
        {isCycleTrackingEnabled && (
          <View style={styles.calendarLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#E57373' }]} />
              <Text style={styles.legendText}>Period</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#64B5F6' }]} />
              <Text style={styles.legendText}>Ovulation</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#81C784' }]} />
              <Text style={styles.legendText}>Fertile</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
              <Text style={styles.legendText}>Data</Text>
            </View>
          </View>
        )}

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

        {/* Long press hint for cycle tracking */}
        {isCycleTrackingEnabled && (
          <Text style={styles.calendarHint}>Long press a day to log period start</Text>
        )}
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

  // Show upgrade prompt for users without access (unless they're developers)
  if (hasAccess !== true && isDeveloper !== true) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="analytics" size={64} color={theme.textSecondary} />
        <Text style={[styles.emptyTitle, { marginTop: 16 }]}>Advanced Insights</Text>
        <Text style={[styles.emptySubtitle, { marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }]}>
          Unlock detailed analytics, trend tracking, and personalized workout coaching.
        </Text>
        <TouchableOpacity
          style={[styles.generateButton, { marginTop: 24 }]}
          onPress={showPaywall}
        >
          <Ionicons name="diamond" size={20} color="#fff" />
          <Text style={styles.generateButtonText}>Upgrade to Pro</Text>
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
        <Text style={styles.dateHeader}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
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

      {/* Avatar Customize Modal */}
      <Modal
        visible={showAvatarCustomize}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAvatarCustomize(false)}
      >
        <AvatarCustomizeScreen
          theme={theme}
          onClose={() => setShowAvatarCustomize(false)}
          onSave={(avatar) => setUserAvatar(avatar)}
        />
      </Modal>

      {activeTab === 'analytics' ? (
        <>
          {/* Avatar Canvas Section */}
          <FadeInView style={styles.avatarSection} delay={0}>
            <AvatarCanvas
              avatar={userAvatar}
              insights={avatarInsights}
              theme={theme}
              size={260}
              onInsightPress={(insight) => {
                Alert.alert(
                  insight.shortLabel,
                  insight.text,
                  [{ text: 'OK' }]
                );
              }}
              onCustomizePress={() => setShowAvatarCustomize(true)}
              showCustomizeButton={true}
              maxVisibleTags={4}
            />
          </FadeInView>

          {/* Health State Section */}
          {healthState?.has_data === true && (
            <FadeInView style={styles.section} delay={25}>
              <Text style={styles.sectionTitle}>Health State</Text>
              {healthState.recovery !== undefined && (
                <StateCard
                  theme={theme}
                  type="recovery"
                  state={healthState.recovery.state}
                  confidence={healthState.recovery.confidence}
                  factors={healthState.recovery.factors}
                  index={0}
                />
              )}
              {healthState.load !== undefined && (
                <StateCard
                  theme={theme}
                  type="load"
                  state={healthState.load.state}
                  confidence={healthState.load.confidence}
                  cumulative={healthState.load.cumulative}
                  index={1}
                />
              )}
              {healthState.energy !== undefined && (
                <StateCard
                  theme={theme}
                  type="energy"
                  state={healthState.energy.state}
                  confidence={healthState.energy.confidence}
                  index={2}
                />
              )}
              {healthState.alignment !== undefined && (
                <AlignmentRing
                  theme={theme}
                  score={healthState.alignment.score}
                  confidence={healthState.alignment.confidence}
                  chronotype={healthState.alignment.chronotype}
                  optimalWindows={undefined}
                />
              )}
              <Text style={styles.healthDisclaimer}>
                {healthState.disclaimer ?? 'Reflects logged patterns only. Not a medical assessment.'}
              </Text>
            </FadeInView>
          )}

          {/* Causal Chains Section */}
          {causalChains.length > 0 && (
            <FadeInView style={styles.section} delay={35}>
              <TouchableOpacity
                style={styles.sectionTitleRow}
                onPress={() => setShowCausalChains(!showCausalChains)}
              >
                <Text style={styles.sectionTitle}>Detected Patterns</Text>
                <View style={styles.chainCount}>
                  <Text style={styles.chainCountText}>{causalChains.length}</Text>
                </View>
                <Ionicons
                  name={showCausalChains ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
              {showCausalChains && causalChains.map((chain, index) => (
                <ChainCard
                  key={chain.chain_type}
                  theme={theme}
                  chain={chain}
                  index={index}
                />
              ))}
              {!showCausalChains && causalChains.length > 0 && (
                <Text style={styles.chainPreview}>
                  {causalChains[0].narrative}
                </Text>
              )}
            </FadeInView>
          )}

          {/* Weekly Chart Section */}
          <FadeInView style={styles.section} delay={50}>
            <Text style={styles.sectionTitle}>Weekly Trends</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chartMetricScroll}
              contentContainerStyle={styles.chartMetricContainer}
            >
              {(['calories', 'protein', 'sleep', 'workouts'] as const).map(metric => (
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
            </ScrollView>
            <AnimatedCard style={styles.chartCard} delay={100}>
              {chartData.length > 0 && chartData.some(d => d.value !== null) ? (
                <LineChart
                  data={chartData}
                  width={SCREEN_WIDTH - 64}
                  height={160}
                  color={theme.accent}
                  backgroundColor={theme.surface}
                  textColor={theme.textPrimary}
                  secondaryTextColor={theme.textSecondary}
                  target={currentTarget}
                  targetColor={theme.success}
                  showLabels={true}
                  showDots={true}
                  showGradient={true}
                />
              ) : (
                <View style={styles.chartEmpty}>
                  <Ionicons name="bar-chart-outline" size={32} color={theme.textSecondary} />
                  <Text style={styles.chartEmptyText}>
                    Log your meals and activities to see trends
                  </Text>
                </View>
              )}
            </AnimatedCard>
          </FadeInView>

          {/* Today's Progress Section */}
          <FadeInView style={styles.section} delay={150}>
            <View style={styles.progressTitleRow}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Today's Progress</Text>
              <View style={styles.badgeRow}>
                {targetsInfo.isWorkoutDay && (
                  <View style={[styles.personalizedBadge, { backgroundColor: theme.accent + '20', marginRight: 6 }]}>
                    <Ionicons name="barbell" size={10} color={theme.accent} />
                    <Text style={[styles.personalizedBadgeText, { color: theme.accent }]}>Workout Day</Text>
                  </View>
                )}
                {targetsPersonalized ? (
                  <View style={styles.personalizedBadge}>
                    <Ionicons name="person" size={10} color={theme.success} />
                    <Text style={styles.personalizedBadgeText}>Personalized</Text>
                  </View>
                ) : (
                  <Text style={styles.defaultTargetsHint}>Default targets</Text>
                )}
              </View>
            </View>
            {/* Activity and Phase Info */}
            {targetsPersonalized && targetsInfo.activityLevel && (
              <View style={styles.activityInfoRow}>
                <Text style={styles.activityInfoText}>
                  {targetsInfo.phase === 'bulk' ? '🎯 Bulking' : targetsInfo.phase === 'cut' ? '✂️ Cutting' : '⚖️ Maintaining'}
                  {' • '}
                  {targetsInfo.activityLevel?.replace('_', ' ')}
                  {targetsInfo.tdee ? ` • TDEE: ${targetsInfo.tdee} cal` : ''}
                </Text>
              </View>
            )}
            <View style={styles.progressGrid}>
              <AnimatedCard style={styles.progressCard} delay={170}>
                <View style={styles.progressHeader}>
                  <View style={[styles.progressIconContainer, { backgroundColor: theme.accent + '20' }]}>
                    <Ionicons name="flame-outline" size={18} color={theme.accent} />
                  </View>
                  <Text style={styles.progressLabel}>Calories</Text>
                </View>
                <Text style={styles.progressValue}>
                  {todayProgress.calories.current.toLocaleString()}
                  <Text style={styles.progressTarget}> / {todayProgress.calories.target.toLocaleString()}</Text>
                </Text>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarFill, { width: `${todayProgress.calories.percent}%`, backgroundColor: theme.accent }]} />
                </View>
              </AnimatedCard>

              <AnimatedCard style={styles.progressCard} delay={190}>
                <View style={styles.progressHeader}>
                  <View style={[styles.progressIconContainer, { backgroundColor: theme.success + '20' }]}>
                    <Ionicons name="nutrition-outline" size={18} color={theme.success} />
                  </View>
                  <Text style={styles.progressLabel}>Protein</Text>
                </View>
                <Text style={styles.progressValue}>
                  {todayProgress.protein.current}g
                  <Text style={styles.progressTarget}> / {todayProgress.protein.target}g</Text>
                </Text>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarFill, { width: `${todayProgress.protein.percent}%`, backgroundColor: theme.success }]} />
                </View>
              </AnimatedCard>

              <AnimatedCard style={styles.progressCard} delay={210}>
                <View style={styles.progressHeader}>
                  <View style={[styles.progressIconContainer, { backgroundColor: '#4FC3F7' + '20' }]}>
                    <Ionicons name="water-outline" size={18} color="#4FC3F7" />
                  </View>
                  <Text style={styles.progressLabel}>Water</Text>
                </View>
                <Text style={styles.progressValue}>
                  {todayProgress.water.current} oz
                  <Text style={styles.progressTarget}> / {todayProgress.water.target} oz</Text>
                </Text>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarFill, { width: `${todayProgress.water.percent}%`, backgroundColor: '#4FC3F7' }]} />
                </View>
              </AnimatedCard>

              <AnimatedCard style={styles.progressCard} delay={230}>
                <View style={styles.progressHeader}>
                  <View style={[styles.progressIconContainer, { backgroundColor: theme.warning + '20' }]}>
                    <Ionicons name="barbell-outline" size={18} color={theme.warning} />
                  </View>
                  <Text style={styles.progressLabel}>Workout</Text>
                </View>
                <Text style={styles.progressValue}>
                  {todayProgress.workouts.current}
                  <Text style={styles.progressTarget}> / {todayProgress.workouts.target}</Text>
                </Text>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarFill, { width: `${todayProgress.workouts.percent}%`, backgroundColor: theme.warning }]} />
                </View>
              </AnimatedCard>
            </View>
          </FadeInView>

          {/* Weekly Summary Section */}
          <FadeInView style={styles.section} delay={250}>
            <Text style={styles.sectionTitle}>This Week</Text>
            <AnimatedCard style={styles.weeklySummaryCard} delay={280}>
              <View style={styles.weeklyStatsGrid}>
                <View style={styles.weeklyStat}>
                  <Text style={styles.weeklyStatValue}>{weeklyStats.avgCalories.toLocaleString()}</Text>
                  <Text style={styles.weeklyStatLabel}>Avg Calories</Text>
                </View>
                <View style={styles.weeklyStatDivider} />
                <View style={styles.weeklyStat}>
                  <Text style={styles.weeklyStatValue}>{weeklyStats.avgProtein}g</Text>
                  <Text style={styles.weeklyStatLabel}>Avg Protein</Text>
                </View>
                <View style={styles.weeklyStatDivider} />
                <View style={styles.weeklyStat}>
                  <Text style={styles.weeklyStatValue}>{weeklyStats.totalWorkouts}</Text>
                  <Text style={styles.weeklyStatLabel}>Workouts</Text>
                </View>
                <View style={styles.weeklyStatDivider} />
                <View style={styles.weeklyStat}>
                  <Text style={styles.weeklyStatValue}>{weeklyStats.avgSleep}h</Text>
                  <Text style={styles.weeklyStatLabel}>Avg Sleep</Text>
                </View>
              </View>
              <View style={styles.weeklyFooter}>
                <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
                <Text style={styles.weeklyFooterText}>
                  {weeklyStats.daysLogged} of 7 days logged
                </Text>
              </View>
            </AnimatedCard>
          </FadeInView>

          {/* Insights Summary - only show if we have meaningful data */}
          {derivatives?.has_data === true && (
            <FadeInView style={styles.section} delay={300}>
              <Text style={styles.sectionTitle}>Insights</Text>
              <AnimatedCard style={styles.insightsSummaryCard} delay={320}>
                <View style={styles.insightsSummaryRow}>
                  <View style={styles.insightsSummaryItem}>
                    <Ionicons name="calendar-outline" size={20} color={theme.accent} />
                    <Text style={styles.insightsSummaryValue}>{derivatives.days_analyzed}</Text>
                    <Text style={styles.insightsSummaryLabel}>days analyzed</Text>
                  </View>
                  <View style={styles.insightsSummaryDivider} />
                  <View style={styles.insightsSummaryItem}>
                    <Ionicons name="analytics-outline" size={20} color={theme.success} />
                    <Text style={styles.insightsSummaryValue}>{derivatives.data_points}</Text>
                    <Text style={styles.insightsSummaryLabel}>data points</Text>
                  </View>
                  <View style={styles.insightsSummaryDivider} />
                  <View style={styles.insightsSummaryItem}>
                    <Ionicons name="trending-up" size={20} color={theme.warning} />
                    <Text style={styles.insightsSummaryValue}>
                      {derivatives.composite?.physiological_momentum?.symbol ?? '→'}
                    </Text>
                    <Text style={styles.insightsSummaryLabel}>trend</Text>
                  </View>
                </View>
                {derivatives.recovery_patterns?.description && (
                  <View style={styles.recoveryPatternRow}>
                    <Ionicons name="fitness-outline" size={16} color={theme.textSecondary} />
                    <Text style={styles.recoveryPatternText}>
                      {derivatives.recovery_patterns.description}
                    </Text>
                  </View>
                )}
              </AnimatedCard>
            </FadeInView>
          )}

          {/* HealthKit Sleep Section - show when we have HealthKit data */}
          {healthKitService.isHealthKitAvailable() && healthKitAuthorized && healthKitSleep?.hasData && (
            <FadeInView style={styles.section} delay={350}>
              <View style={styles.progressTitleRow}>
                <Text style={styles.sectionTitle}>Sleep Analysis</Text>
                <View style={styles.healthKitBadge}>
                  <Ionicons name="heart" size={10} color="#FF2D55" />
                  <Text style={styles.healthKitBadgeText}>HealthKit</Text>
                </View>
              </View>
              <AnimatedCard style={styles.sleepCard} delay={370}>
                <View style={styles.sleepMainRow}>
                  <View style={styles.sleepDurationContainer}>
                    <Ionicons name="bed-outline" size={24} color={theme.accent} />
                    <View style={styles.sleepDurationInfo}>
                      <Text style={styles.sleepDurationValue}>
                        {healthKitSleep.totalSleepHours.toFixed(1)}h
                      </Text>
                      <Text style={styles.sleepDurationLabel}>Total Sleep</Text>
                    </View>
                  </View>
                  <View style={styles.sleepQualityContainer}>
                    <Text style={styles.sleepQualityValue}>
                      {healthKitService.calculateSleepQuality(healthKitSleep)}
                    </Text>
                    <Text style={styles.sleepQualityLabel}>Sleep Score</Text>
                  </View>
                </View>

                {/* Sleep Stages */}
                <View style={styles.sleepStagesRow}>
                  <View style={styles.sleepStage}>
                    <View style={[styles.sleepStageDot, { backgroundColor: '#5E35B1' }]} />
                    <Text style={styles.sleepStageLabel}>Deep</Text>
                    <Text style={styles.sleepStageValue}>{healthKitSleep.deepSleepHours.toFixed(1)}h</Text>
                  </View>
                  <View style={styles.sleepStage}>
                    <View style={[styles.sleepStageDot, { backgroundColor: '#7E57C2' }]} />
                    <Text style={styles.sleepStageLabel}>REM</Text>
                    <Text style={styles.sleepStageValue}>{healthKitSleep.remSleepHours.toFixed(1)}h</Text>
                  </View>
                  <View style={styles.sleepStage}>
                    <View style={[styles.sleepStageDot, { backgroundColor: '#9575CD' }]} />
                    <Text style={styles.sleepStageLabel}>Core</Text>
                    <Text style={styles.sleepStageValue}>{healthKitSleep.coreSleepHours.toFixed(1)}h</Text>
                  </View>
                  <View style={styles.sleepStage}>
                    <View style={[styles.sleepStageDot, { backgroundColor: theme.textSecondary }]} />
                    <Text style={styles.sleepStageLabel}>Efficiency</Text>
                    <Text style={styles.sleepStageValue}>{Math.round(healthKitSleep.sleepEfficiency)}%</Text>
                  </View>
                </View>

                {/* Bed/Wake times */}
                {healthKitSleep.bedTime && healthKitSleep.wakeTime && (
                  <View style={styles.sleepTimesRow}>
                    <View style={styles.sleepTime}>
                      <Ionicons name="moon-outline" size={14} color={theme.textSecondary} />
                      <Text style={styles.sleepTimeLabel}>Bedtime</Text>
                      <Text style={styles.sleepTimeValue}>
                        {new Date(healthKitSleep.bedTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={styles.sleepTime}>
                      <Ionicons name="sunny-outline" size={14} color={theme.textSecondary} />
                      <Text style={styles.sleepTimeLabel}>Wake</Text>
                      <Text style={styles.sleepTimeValue}>
                        {new Date(healthKitSleep.wakeTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                )}
              </AnimatedCard>
            </FadeInView>
          )}

          {/* HealthKit Heart Metrics - show HRV and RHR when available */}
          {healthKitService.isHealthKitAvailable() && healthKitAuthorized && healthSummary && (healthSummary.latestHRV || healthSummary.latestRestingHeartRate) && (
            <FadeInView style={styles.section} delay={400}>
              <Text style={styles.sectionTitle}>Heart Metrics</Text>
              <View style={styles.heartMetricsRow}>
                {healthSummary.latestHRV && (
                  <AnimatedCard style={styles.heartMetricCard} delay={420}>
                    <View style={[styles.heartMetricIcon, { backgroundColor: '#FF2D5520' }]}>
                      <Ionicons name="pulse" size={18} color="#FF2D55" />
                    </View>
                    <Text style={styles.heartMetricValue}>{Math.round(healthSummary.latestHRV.hrvMs)} ms</Text>
                    <Text style={styles.heartMetricLabel}>HRV</Text>
                    <Text style={[styles.heartMetricAssessment, { color: healthKitService.assessHRV(healthSummary.latestHRV.hrvMs) === 'excellent' ? theme.success : healthKitService.assessHRV(healthSummary.latestHRV.hrvMs) === 'good' ? theme.accent : theme.textSecondary }]}>
                      {healthKitService.assessHRV(healthSummary.latestHRV.hrvMs).charAt(0).toUpperCase() + healthKitService.assessHRV(healthSummary.latestHRV.hrvMs).slice(1)}
                    </Text>
                  </AnimatedCard>
                )}
                {healthSummary.latestRestingHeartRate && (
                  <AnimatedCard style={styles.heartMetricCard} delay={440}>
                    <View style={[styles.heartMetricIcon, { backgroundColor: '#FF2D5520' }]}>
                      <Ionicons name="heart" size={18} color="#FF2D55" />
                    </View>
                    <Text style={styles.heartMetricValue}>{Math.round(healthSummary.latestRestingHeartRate.bpm)} bpm</Text>
                    <Text style={styles.heartMetricLabel}>Resting HR</Text>
                    <Text style={[styles.heartMetricAssessment, { color: healthKitService.assessRestingHeartRate(healthSummary.latestRestingHeartRate.bpm) === 'athletic' || healthKitService.assessRestingHeartRate(healthSummary.latestRestingHeartRate.bpm) === 'excellent' ? theme.success : theme.textSecondary }]}>
                      {healthKitService.assessRestingHeartRate(healthSummary.latestRestingHeartRate.bpm).charAt(0).toUpperCase() + healthKitService.assessRestingHeartRate(healthSummary.latestRestingHeartRate.bpm).slice(1)}
                    </Text>
                  </AnimatedCard>
                )}
              </View>
            </FadeInView>
          )}

          {/* HealthKit Connect Prompt - show if HealthKit available but not authorized */}
          {healthKitService.isHealthKitAvailable() && !healthKitAuthorized && (
            <FadeInView style={styles.section} delay={350}>
              <AnimatedCard style={styles.healthKitPromptCard} delay={370}>
                <View style={styles.healthKitPromptContent}>
                  <View style={[styles.healthKitPromptIcon, { backgroundColor: '#FF2D5520' }]}>
                    <Ionicons name="heart" size={24} color="#FF2D55" />
                  </View>
                  <View style={styles.healthKitPromptText}>
                    <Text style={styles.healthKitPromptTitle}>Connect Apple Health</Text>
                    <Text style={styles.healthKitPromptSubtitle}>Get real sleep, HRV, and heart rate data from your Apple Watch</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.healthKitConnectButton}
                  onPress={async () => {
                    const authorized = await healthKitService.requestAuthorization();
                    setHealthKitAuthorized(authorized);
                    if (authorized) {
                      fetchHealthKitData();
                    }
                  }}
                >
                  <Text style={styles.healthKitConnectButtonText}>Connect</Text>
                </TouchableOpacity>
              </AnimatedCard>
            </FadeInView>
          )}

          {/* Activity Prompt - only show when no data */}
          {derivatives?.has_data !== true && (
            <FadeInView style={styles.section} delay={450}>
              <AnimatedCard style={styles.activityCard} delay={470}>
                <View style={styles.activityContent}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.textSecondary} />
                  <Text style={styles.activityText}>
                    Chat with Delta about your meals, workouts, and sleep to see personalized insights
                  </Text>
                </View>
              </AnimatedCard>
            </FadeInView>
          )}
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
                    progress={progressPercentage}
                    height={8}
                    backgroundColor={theme.border}
                    fillColor={theme.success}
                    style={styles.progressBar}
                  />
                  <Text style={styles.progressText}>{progressPercentage}%</Text>
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
        <Animated.View entering={FadeInUp.duration(300)}>
          {renderCalendar()}
          {renderSelectedDayDetails()}
        </Animated.View>
      ) : null}

      {/* Period Logging Modal */}
      <Modal
        visible={showPeriodModal === true}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePeriodModal}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log Period Start</Text>
            <TouchableOpacity onPress={closePeriodModal} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDate}>
              {periodModalDate && new Date(periodModalDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>

            {/* Flow Intensity */}
            <Text style={styles.modalSectionTitle}>Flow Intensity</Text>
            <View style={styles.flowOptions}>
              {(['light', 'medium', 'heavy', 'spotting'] as FlowIntensity[]).map((flow) => (
                <TouchableOpacity
                  key={flow}
                  style={[
                    styles.flowOption,
                    selectedFlow === flow && styles.flowOptionSelected,
                  ]}
                  onPress={() => setSelectedFlow(flow)}
                >
                  <View style={[
                    styles.flowDot,
                    { backgroundColor: flow === 'light' ? '#FFB6C1' : flow === 'medium' ? '#E57373' : flow === 'heavy' ? '#C62828' : '#FFCDD2' }
                  ]} />
                  <Text style={[
                    styles.flowOptionText,
                    selectedFlow === flow && styles.flowOptionTextSelected,
                  ]}>
                    {flow.charAt(0).toUpperCase() + flow.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Symptoms */}
            <Text style={styles.modalSectionTitle}>Symptoms (Optional)</Text>
            <View style={styles.symptomOptions}>
              {(['cramps', 'headache', 'bloating', 'mood_changes', 'fatigue', 'breast_tenderness', 'acne', 'back_pain', 'nausea'] as MenstrualSymptom[]).map((symptom) => (
                <TouchableOpacity
                  key={symptom}
                  style={[
                    styles.symptomOption,
                    selectedSymptoms.includes(symptom) && styles.symptomOptionSelected,
                  ]}
                  onPress={() => toggleSymptom(symptom)}
                >
                  <Text style={[
                    styles.symptomOptionText,
                    selectedSymptoms.includes(symptom) && styles.symptomOptionTextSelected,
                  ]}>
                    {symptom.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalSaveButton, isSavingPeriod === true && styles.buttonDisabled]}
              onPress={savePeriodLog}
              disabled={isSavingPeriod === true}
            >
              {isSavingPeriod === true ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalSaveButtonText}>Log Period Start</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function createStyles(theme: Theme, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
    loadingText: { marginTop: 12, fontSize: 16, color: theme.textSecondary },
    header: { paddingHorizontal: 16, paddingTop: topInset + 8, paddingBottom: 8 },
    dateHeader: { fontSize: 28, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
    headerTitle: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, letterSpacing: 1.5 },
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
    avatarSection: { alignItems: 'center', paddingVertical: 8, marginBottom: 8 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginBottom: 12 },
    progressTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    badgeRow: { flexDirection: 'row', alignItems: 'center' },
    personalizedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.success + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
    activityInfoRow: { marginBottom: 12 },
    activityInfoText: { fontSize: 12, color: theme.textSecondary, textTransform: 'capitalize' },
    personalizedBadgeText: { fontSize: 10, color: theme.success, fontWeight: '500' },
    defaultTargetsHint: { fontSize: 10, color: theme.textSecondary, fontStyle: 'italic' },
    activityCard: { backgroundColor: theme.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border },
    activityContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    activityText: { fontSize: 14, color: theme.textPrimary, lineHeight: 20, flex: 1 },
    // Chart styles
    chartMetricScroll: { marginBottom: 12 },
    chartMetricContainer: { flexDirection: 'row', gap: 8 },
    chartCard: { backgroundColor: theme.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
    metricChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: theme.surfaceSecondary },
    metricChipActive: { backgroundColor: theme.accent },
    metricChipText: { fontSize: 13, color: theme.textSecondary, fontWeight: '500' },
    metricChipTextActive: { color: '#fff', fontWeight: '600' },
    chartEmpty: { height: 140, justifyContent: 'center', alignItems: 'center', gap: 8 },
    chartEmptyText: { fontSize: 13, color: theme.textSecondary, textAlign: 'center' },
    // Progress grid styles
    progressGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
    progressCard: { width: '50%', padding: 4 },
    progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    progressIconContainer: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    progressLabel: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
    progressValue: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, marginBottom: 6 },
    progressTarget: { fontSize: 12, fontWeight: '400', color: theme.textSecondary },
    progressBarContainer: { height: 4, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 2 },
    // Weekly summary styles
    weeklySummaryCard: { backgroundColor: theme.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border },
    weeklyStatsGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    weeklyStat: { flex: 1, alignItems: 'center' },
    weeklyStatValue: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
    weeklyStatLabel: { fontSize: 10, color: theme.textSecondary, marginTop: 2, textAlign: 'center' },
    weeklyStatDivider: { width: 1, height: 32, backgroundColor: theme.border },
    weeklyFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border, gap: 6 },
    weeklyFooterText: { fontSize: 12, color: theme.textSecondary },
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
    // Insights summary styles
    insightsSummaryCard: { backgroundColor: theme.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border },
    insightsSummaryRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    insightsSummaryItem: { alignItems: 'center', flex: 1 },
    insightsSummaryValue: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginTop: 6 },
    insightsSummaryLabel: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
    insightsSummaryDivider: { width: 1, height: 40, backgroundColor: theme.border },
    recoveryPatternRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border, gap: 8 },
    recoveryPatternText: { fontSize: 13, color: theme.textSecondary, flex: 1 },
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
    calendarDots: { flexDirection: 'row', justifyContent: 'center', gap: 2, marginTop: 2, minHeight: 4 },
    calendarDot: { width: 4, height: 4, borderRadius: 2 },
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
    // Menstrual tracking calendar styles
    calendarDayPeriod: { backgroundColor: '#E5737330', borderRadius: 20 },
    calendarDayPredictedPeriod: { backgroundColor: '#E5737315', borderRadius: 20, borderWidth: 1, borderColor: '#E5737350', borderStyle: 'dashed' },
    calendarDayTextPeriod: { color: '#C62828', fontWeight: '600' },
    cyclePhaseCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: theme.border },
    cyclePhaseIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    cyclePhaseInfo: { marginLeft: 12, flex: 1 },
    cyclePhaseTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
    cyclePhaseSubtitle: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    calendarLegend: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, gap: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
    legendText: { fontSize: 11, color: theme.textSecondary },
    calendarHint: { fontSize: 11, color: theme.textSecondary, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
    // Period modal styles
    modalContainer: { flex: 1 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: topInset + 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
    modalTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary },
    modalCloseButton: { padding: 8 },
    modalContent: { flex: 1, padding: 16 },
    modalDate: { fontSize: 20, fontWeight: '600', color: theme.textPrimary, marginBottom: 24, textAlign: 'center' },
    modalSectionTitle: { fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 12, marginTop: 16 },
    flowOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    flowOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
    flowOptionSelected: { backgroundColor: '#E5737320', borderColor: '#E57373' },
    flowDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
    flowOptionText: { fontSize: 14, color: theme.textPrimary },
    flowOptionTextSelected: { color: '#C62828', fontWeight: '500' },
    symptomOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    symptomOption: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
    symptomOptionSelected: { backgroundColor: theme.accentLight, borderColor: theme.accent },
    symptomOptionText: { fontSize: 13, color: theme.textPrimary },
    symptomOptionTextSelected: { color: theme.accent, fontWeight: '500' },
    modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: theme.border },
    modalSaveButton: { backgroundColor: '#E57373', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    modalSaveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    // HealthKit styles
    healthKitBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF2D5515', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
    healthKitBadgeText: { fontSize: 10, color: '#FF2D55', fontWeight: '500' },
    sleepCard: { backgroundColor: theme.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border },
    sleepMainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sleepDurationContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    sleepDurationInfo: {},
    sleepDurationValue: { fontSize: 28, fontWeight: '700', color: theme.textPrimary },
    sleepDurationLabel: { fontSize: 12, color: theme.textSecondary },
    sleepQualityContainer: { alignItems: 'center', backgroundColor: theme.accentLight, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
    sleepQualityValue: { fontSize: 24, fontWeight: '700', color: theme.accent },
    sleepQualityLabel: { fontSize: 10, color: theme.textSecondary, marginTop: 2 },
    sleepStagesRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border },
    sleepStage: { alignItems: 'center', flex: 1 },
    sleepStageDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
    sleepStageLabel: { fontSize: 10, color: theme.textSecondary, marginBottom: 2 },
    sleepStageValue: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
    sleepTimesRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
    sleepTime: { alignItems: 'center', gap: 4 },
    sleepTimeLabel: { fontSize: 10, color: theme.textSecondary },
    sleepTimeValue: { fontSize: 13, fontWeight: '500', color: theme.textPrimary },
    heartMetricsRow: { flexDirection: 'row', gap: 12 },
    heartMetricCard: { flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
    heartMetricIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    heartMetricValue: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
    heartMetricLabel: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    heartMetricAssessment: { fontSize: 11, fontWeight: '500', marginTop: 4 },
    healthKitPromptCard: { backgroundColor: theme.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border },
    healthKitPromptContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    healthKitPromptIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    healthKitPromptText: { marginLeft: 12, flex: 1 },
    healthKitPromptTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary },
    healthKitPromptSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
    healthKitConnectButton: { backgroundColor: '#FF2D55', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    healthKitConnectButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    // Health Intelligence styles
    healthDisclaimer: { fontSize: 11, color: theme.textSecondary, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    chainCount: { backgroundColor: theme.accent, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
    chainCountText: { fontSize: 12, color: '#fff', fontWeight: '600' },
    chainPreview: { fontSize: 13, color: theme.textSecondary, fontStyle: 'italic', marginTop: 8 },
  });
}
