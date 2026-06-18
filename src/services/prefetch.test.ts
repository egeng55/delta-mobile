import AsyncStorage from '@react-native-async-storage/async-storage';
import { prefetchAppData } from './prefetch';
import {
  dashboardApi,
  derivativesApi,
  healthIntelligenceApi,
  insightsApi,
  workoutApi,
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
      composite: {},
      recovery_patterns: {},
    });
    mockedDerivativesApi.getCards.mockResolvedValue({
      cards: [{ id: 'card-1' }],
      count: 1,
    });
    mockedDashboardApi.getWeekly.mockResolvedValue({
      weekly_summaries: [{ date: '2026-06-18' }],
      days_count: 1,
    });
    mockedDashboardApi.getDashboard.mockResolvedValue({
      today: { date: '2026-06-18' },
      streak: { current_streak: 1, longest_streak: 2, last_active_date: '2026-06-18' },
      recent_entries: [],
      targets: {
        calories: 2100,
        protein_g: 140,
        water_oz: 80,
        sleep_hours: 8,
      },
      targets_calculated: true,
      targets_source: 'personalized',
      is_workout_day: false,
    });
    mockedHealthIntelligenceApi.getState.mockResolvedValue({
      has_data: true,
      causal_chains: [{ id: 'chain-1' }],
    });
    mockedHealthIntelligenceApi.getModules.mockResolvedValue({
      user_id: 'user-1',
      has_data: true,
      modules: [{ id: 'module-1' }],
    });
    mockedWorkoutApi.getToday.mockResolvedValue({
      workout: { title: 'Easy run' },
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
      cards: [{ id: 'card-1' }],
      modules: [{ id: 'module-1' }],
    });
  });
});
