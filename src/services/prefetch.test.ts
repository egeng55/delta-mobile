import AsyncStorage from '@react-native-async-storage/async-storage';
import { prefetchAppData } from './prefetch';
import {
  dashboardApi,
  derivativesApi,
  healthIntelligenceApi,
  insightsApi,
  workoutApi,
} from './api';
import type {
  CausalChain,
  DashboardResponse,
  DeltaModule,
  DerivativesData,
  InsightCard,
  WorkoutPlan,
} from './api';
import { readCacheEnvelope } from './storage/cachePolicy';

jest.mock('./api', () => ({
  insightsApi: {
    getInsights: jest.fn(),
  },
  workoutApi: {
    getToday: jest.fn(),
  },
  derivativesApi: {
    getDerivatives: jest.fn(),
    getCards: jest.fn(),
  },
  dashboardApi: {
    getWeekly: jest.fn(),
    getDashboard: jest.fn(),
  },
  healthIntelligenceApi: {
    getState: jest.fn(),
    getModules: jest.fn(),
  },
}));

const mockedInsightsApi = insightsApi as jest.Mocked<typeof insightsApi>;
const mockedWorkoutApi = workoutApi as jest.Mocked<typeof workoutApi>;
const mockedDerivativesApi = derivativesApi as jest.Mocked<typeof derivativesApi>;
const mockedDashboardApi = dashboardApi as jest.Mocked<typeof dashboardApi>;
const mockedHealthIntelligenceApi = healthIntelligenceApi as jest.Mocked<typeof healthIntelligenceApi>;

const insightCard = (id: string): InsightCard => ({
  id,
  title: `Card ${id}`,
  value: 'steady',
  subtitle: 'Fixture insight',
  trend: null,
  confidence: 0.8,
});

const causalChain = (id: string): CausalChain => ({
  chain_type: id,
  cause_event: 'sleep_logged',
  effect_event: 'energy_stable',
  occurrences: 2,
  co_occurrences: 2,
  confidence: 0.7,
  lag_days: 1,
  narrative: 'Fixture causal chain.',
});

const deltaModule = (id: string): DeltaModule => ({
  id,
  type: 'insight',
  layout: 'standard',
  priority: 1,
  brief: `Module ${id}`,
  detail: 'Fixture module.',
  tone: 'neutral',
  icon: 'sparkles',
});

const workoutPlan: WorkoutPlan = {
  plan_id: 'workout-1',
  user_id: 'user-1',
  name: 'Easy run',
  workout_type: 'run',
  scheduled_date: '2026-06-18',
  exercises: [],
  status: 'pending',
  created_at: '2026-06-18T00:00:00.000Z',
  completed_at: null,
};

describe('prefetchAppData', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    mockedInsightsApi.getInsights.mockResolvedValue({
      user_id: 'user-1',
      total_conversations: 2,
      topics_discussed: ['sleep'],
      wellness_score: 75,
      streak_days: 3,
    });
    mockedDerivativesApi.getDerivatives.mockResolvedValue({
      has_data: true,
      days_analyzed: 7,
      data_points: 12,
      date_range: { start: '2026-06-01', end: '2026-06-07' },
      metrics: {},
      composite: {
        physiological_momentum: {
          score: 72,
          label: 'steady',
          symbol: '→',
          confidence: 0.8,
          signals_analyzed: 3,
        },
      },
      recovery_patterns: {
        pattern: 'steady_recovery',
        description: 'Recovery is stable in the fixture data.',
      },
    } satisfies DerivativesData);
    mockedDerivativesApi.getCards.mockResolvedValue({
      cards: Array.from({ length: 12 }, (_, index) => insightCard(`card-${index + 1}`)),
      count: 12,
    });
    mockedDashboardApi.getWeekly.mockResolvedValue({
      weekly_summaries: Array.from({ length: 16 }, (_, index) => ({
        date: `2026-06-${String(index + 1).padStart(2, '0')}`,
        meals: 3,
        calories: 2100,
        protein: 140,
        carbs: 220,
        fat: 70,
        workouts: 1,
        workout_minutes: 35,
        sleep_hours: 8,
        sleep_quality: 82,
        mood_avg: 4,
        water_oz: 80,
        weight: null,
      })),
      days_count: 16,
    });
    mockedDashboardApi.getDashboard.mockResolvedValue({
      today: {
        date: '2026-06-18',
        meals: 3,
        calories: 2100,
        protein: 140,
        carbs: 220,
        fat: 70,
        workouts: 1,
        workout_minutes: 35,
        sleep_hours: 8,
        sleep_quality: 82,
        mood_avg: 4,
        water_oz: 80,
        weight: null,
      },
      streak: { current_streak: 1, longest_streak: 2, last_active_date: '2026-06-18' },
      recent_entries: [],
      targets: {
        calories: 2100,
        protein_g: 140,
        carbs_g: 220,
        fat_g: 70,
        water_oz: 80,
        sleep_hours: 8,
        workouts_per_week: 3,
      },
      targets_calculated: true,
      targets_source: 'profile',
      is_workout_day: false,
    } satisfies DashboardResponse);
    mockedHealthIntelligenceApi.getState.mockResolvedValue({
      has_data: true,
      causal_chains: Array.from({ length: 12 }, (_, index) => causalChain(`chain-${index + 1}`)),
    });
    mockedHealthIntelligenceApi.getModules.mockResolvedValue({
      user_id: 'user-1',
      has_data: true,
      modules: Array.from({ length: 12 }, (_, index) => deltaModule(`module-${index + 1}`)),
    });
    mockedWorkoutApi.getToday.mockResolvedValue({
      workout: workoutPlan,
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('stores generated insights prefetch data in a TTL envelope', async () => {
    await prefetchAppData('user-1');

    const raw = await AsyncStorage.getItem('@delta_insights_analytics_user-1');
    const result = readCacheEnvelope<Record<string, unknown>>(raw);

    expect(result.status).toBe('hit');
    expect(result.envelope?.metadata).toEqual({
      category: 'prefetch_insights_cache',
      key: 'analytics_user-1',
    });
    expect(result.envelope?.expiresAt).toBeGreaterThan(result.envelope?.createdAt ?? 0);
    expect(result.value).toMatchObject({
      targetsPersonalized: true,
    });
    expect(result.value?.cards).toHaveLength(10);
    expect(result.value?.weekly).toHaveLength(14);
    expect(result.value?.causalChains).toHaveLength(10);
    expect(result.value?.modules).toHaveLength(10);
  });
});
