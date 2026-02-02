/**
 * API Service - Connects to Delta backend on Render.
 *
 * SAFETY DECISIONS:
 * - All responses are explicitly typed
 * - Error handling with explicit checks
 * - No implicit type coercion
 */

import {
  API_BASE_URL,
  TIMEOUTS,
  RETRY_CONFIG,
} from '../config/constants';
import { recordDecision } from './deltaDecisionLog';
import { supabase } from './supabase';

// Timeouts for Render free tier cold starts
const COLD_START_TIMEOUT = TIMEOUTS.COLD_START;
const NORMAL_TIMEOUT = TIMEOUTS.NORMAL;
const MAX_RETRIES = RETRY_CONFIG.MAX_RETRIES;

// Track if we've successfully connected (server is warm)
let serverIsWarm = false;
let lastSuccessfulRequest = 0;
const WARM_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// Response types
export interface User {
  id: string;
  email: string;
  name: string;
  created_at?: string;
  role?: 'user' | 'developer' | 'admin';
}

export interface AuthResponse {
  status: string;
  user: User;
  session_token: string;
  expires_at: string;
  is_guest?: boolean;
}

export interface ChatResponse {
  response: string;
}

export interface ImageAnalysisResponse {
  description: string;
  components: string[];
  protein_level: string;
  carb_level: string;
  processing_level: string;
  visible_fats: string;
  meal_category: string | null;
  meal_context: string;
  clarification_questions: string[];
  confidence: number;
  response_text: string;
}

export interface ChatWithImageResponse {
  response: string;
  image_analysis: ImageAnalysisResponse | null;
}

export interface InsightsData {
  user_id: string;
  total_conversations: number;
  topics_discussed: string[];
  wellness_score: number;
  streak_days: number;
  last_activity?: string;
}

// API Error class
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// Helper to make requests with timeout and retry logic
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  retries: number = MAX_RETRIES
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  if (serverIsWarm && Date.now() - lastSuccessfulRequest > WARM_TIMEOUT_MS) {
    serverIsWarm = false;
  }
  const timeout = serverIsWarm ? NORMAL_TIMEOUT : COLD_START_TIMEOUT;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Attach Supabase session token for authenticated endpoints
    const authHeaders: Record<string, string> = {};
    let { data: sessionData } = await supabase.auth.getSession();
    // Refresh token if expired or about to expire (within 60s)
    if (sessionData?.session) {
      const expiresAt = sessionData.session.expires_at ?? 0;
      if (expiresAt * 1000 < Date.now() + 60_000) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session) {
          sessionData = refreshed;
        }
      }
    }
    if (sessionData?.session?.access_token) {
      authHeaders['Authorization'] = `Bearer ${sessionData.session.access_token}`;
    }
    if (__DEV__ && endpoint.includes('/modules')) {
      console.log('[API] /modules auth:', sessionData?.session?.access_token ? 'token present' : 'NO TOKEN');
    }

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    // Mark server as warm after successful response
    serverIsWarm = true;
    lastSuccessfulRequest = Date.now();

    if (response.ok !== true) {
      let errorMessage = 'Request failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
      } catch {
        // Use default error message
      }
      throw new ApiError(errorMessage, response.status);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    clearTimeout(timeoutId);

    // Check if this is a timeout or network error that we should retry
    const isRetryableError =
      error instanceof Error &&
      (error.name === 'AbortError' ||
        error.message.includes('Network request failed') ||
        error.message.includes('timeout') ||
        error.message.includes('network'));

    if (isRetryableError) {
      serverIsWarm = false;

      if (retries > 0) {
        // Wait before retrying (exponential backoff)
        const backoffMs = 1000 * (MAX_RETRIES - retries + 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));

        // Retry with warm timeout since we've already waited
        return request<T>(endpoint, options, retries - 1);
      }
    }

    throw error;
  }
}

// Auth API
export const authApi = {
  signup: async (email: string, password: string, name: string): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, device_info: 'delta-mobile-ios' }),
    });
  },

  logout: async (sessionToken: string): Promise<void> => {
    await request<{ status: string }>('/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });
  },

  validate: async (sessionToken: string): Promise<{ status: string; user: User }> => {
    return request<{ status: string; user: User }>('/auth/validate', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });
  },
};

// Chat API
export const chatApi = {
  sendMessage: async (
    userId: string,
    message: string,
    unitSystem?: 'metric' | 'imperial',
    weatherContext?: string,
    clientTimezone?: string
  ): Promise<string> => {
    // Auto-detect timezone if not provided
    const timezone = clientTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const response = await request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        message,
        unit_system: unitSystem,
        weather_context: weatherContext,
        client_timezone: timezone,
      }),
    });
    return response.response;
  },

  sendMessageWithImage: async (
    userId: string,
    message: string | null,
    imageBase64: string | null,
    clientTimezone?: string,
    clientLocalTime?: string,
    unitSystem?: 'metric' | 'imperial',
    weatherContext?: string
  ): Promise<ChatWithImageResponse> => {
    const response = await request<ChatWithImageResponse>('/chat/with-image', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        message,
        image_data: imageBase64,
        client_timezone: clientTimezone,
        client_local_time: clientLocalTime,
        unit_system: unitSystem,
        weather_context: weatherContext,
      }),
    });
    return response;
  },
};

// Viz Zoom API - re-render a visualization at a different zoom level
export interface VizZoomResponse {
  viz_json: string;
}

export const vizApi = {
  zoom: async (
    conversationId: string,
    vizId: string,
    newZoom: string
  ): Promise<VizZoomResponse> => {
    return request<VizZoomResponse>('/chat/viz-zoom', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: conversationId,
        viz_id: vizId,
        new_zoom: newZoom,
      }),
    });
  },
};

// Vision API - for standalone image analysis
export const visionApi = {
  analyzeMeal: async (
    userId: string,
    imageBase64: string,
    clientTimezone?: string,
    clientLocalTime?: string
  ): Promise<ImageAnalysisResponse> => {
    return request<ImageAnalysisResponse>('/vision/analyze-meal', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        image_data: imageBase64,
        client_timezone: clientTimezone,
        client_local_time: clientLocalTime,
      }),
    });
  },
};

// Insights API
export const insightsApi = {
  getInsights: async (userId: string): Promise<InsightsData> => {
    try {
      return await request<InsightsData>(`/insights/${userId}`);
    } catch {
      // Return default data if insights not available
      return {
        user_id: userId,
        total_conversations: 0,
        topics_discussed: [],
        wellness_score: 0,
        streak_days: 0,
      };
    }
  },

  getTimeline: async (userId: string): Promise<unknown[]> => {
    try {
      const response = await request<{ timeline: unknown[] }>(`/insights/${userId}/timeline`);
      return response.timeline || [];
    } catch {
      return [];
    }
  },
};

// Dashboard Insight - generated contextual message from Delta
export interface DashboardInsightResponse {
  message: string;
  context_used: string[];
}

export const dashboardInsightApi = {
  /**
   * Generate a personalized insight message for the dashboard.
   * Uses the user's logged data, weather, time of day, etc. to create
   * a relevant, helpful message from Delta.
   */
  generateInsight: async (
    userId: string,
    weatherContext?: string,
    unitSystem?: 'metric' | 'imperial',
    uiContext?: Record<string, unknown>
  ): Promise<DashboardInsightResponse> => {
    try {
      const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const clientLocalTime = new Date().toISOString();

      const response = await request<DashboardInsightResponse>('/dashboard/insight', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          client_timezone: clientTimezone,
          client_local_time: clientLocalTime,
          weather_context: weatherContext,
          unit_system: unitSystem,
          ui_context: uiContext,
        }),
      });
      recordDecision({
        timestamp: new Date().toISOString(),
        source: 'generateInsight',
        decision: response.message,
        reasoning: `context: ${response.context_used.join(', ')}`,
        raw: response,
      });
      return response;
    } catch {
      // Return a default message if API fails
      return {
        message: "Ready to help you reach your health goals today.",
        context_used: [],
      };
    }
  },
};

// Personalized Targets
export interface DailyTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_oz: number;
  sleep_hours: number;
  workouts_per_week: number;
}

export interface WorkoutDayTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_oz: number;
  note: string;
}

export interface DashboardResponse {
  today: {
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
  } | null;
  streak: {
    current_streak: number;
    longest_streak: number;
    last_active_date: string | null;
  };
  recent_entries: unknown[];
  targets: DailyTargets;
  workout_day_targets?: WorkoutDayTargets | null;
  is_workout_day?: boolean;
  targets_calculated: boolean;
  targets_source: 'default' | 'profile' | 'user_specified' | 'goal';
  activity_level?: string | null;
  phase?: string | null;
  bmr?: number | null;
  tdee?: number | null;
  date?: string; // The date used for the dashboard data (client's local date)
}

export interface TargetsResponse {
  calculated: boolean;
  source: string;
  targets: DailyTargets;
  bmr?: number;
  tdee?: number;
  activity_level?: string;
  profile_data: {
    weight_kg: number | null;
    height_cm: number | null;
    age: number | null;
    sex: string | null;
    phase: string;
  };
  recommendations: string[];
}

// Dashboard API
export const dashboardApi = {
  getDashboard: async (userId: string): Promise<DashboardResponse> => {
    // Get the phone's local date (not UTC)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const localDate = `${year}-${month}-${day}`; // YYYY-MM-DD in phone's timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return request<DashboardResponse>(
      `/dashboard/${userId}?date=${localDate}&timezone=${encodeURIComponent(timezone)}`
    );
  },

  getWeekly: async (userId: string): Promise<unknown> => {
    return request<unknown>(`/dashboard/${userId}/weekly`);
  },

  getTargets: async (userId: string): Promise<TargetsResponse> => {
    return request<TargetsResponse>(`/targets/${userId}`);
  },
};

// Workout Types
export interface Exercise {
  exercise_id: string;
  plan_id: string;
  name: string;
  sets: number | null;
  reps: string | null;
  weight: string | null;
  completed: boolean;
  completed_at: string | null;
  order_index: number;
  rest_seconds?: number;
  notes?: string | null;
}

export interface WorkoutPlan {
  plan_id: string;
  user_id: string;
  name: string;
  workout_type: string;
  scheduled_date: string;
  exercises: Exercise[];
  exercise_details?: Exercise[];
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  created_at: string;
  completed_at: string | null;
  estimated_duration_minutes?: number;
  warmup?: string;
  cooldown?: string;
}

export interface FitnessPreferences {
  user_id: string;
  fitness_level: string | null;
  preferred_workout_types: string[];
  available_equipment: string[];
  goals: string[];
  injuries_limitations: string[];
}

export interface CoachingTips {
  form_cues: string[];
  common_mistakes: string[];
  modifications: string[];
  motivation: string;
}

// Workout API
export const workoutApi = {
  getToday: async (userId: string): Promise<{ workout: WorkoutPlan | null; message?: string }> => {
    return request<{ workout: WorkoutPlan | null; message?: string }>(`/workouts/${userId}/today`);
  },

  recommend: async (
    userId: string,
    workoutType?: string,
    scheduledDate?: string
  ): Promise<{ status: string; workout: WorkoutPlan }> => {
    return request<{ status: string; workout: WorkoutPlan }>('/workouts/recommend', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        workout_type: workoutType,
        scheduled_date: scheduledDate,
      }),
    });
  },

  createPlan: async (
    userId: string,
    name: string,
    workoutType: string,
    scheduledDate: string,
    exercises: Array<{ name: string; sets?: number; reps?: string; weight?: string }>
  ): Promise<{ status: string; plan_id: string }> => {
    return request<{ status: string; plan_id: string }>('/workouts/plans', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        name,
        workout_type: workoutType,
        scheduled_date: scheduledDate,
        exercises,
      }),
    });
  },

  getPlan: async (planId: string): Promise<{ plan: WorkoutPlan }> => {
    return request<{ plan: WorkoutPlan }>(`/workouts/plans/${planId}`);
  },

  updateStatus: async (
    planId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  ): Promise<{ status: string; plan_status: string; tracking_entry_id: string | null }> => {
    return request<{ status: string; plan_status: string; tracking_entry_id: string | null }>(
      `/workouts/plans/${planId}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }
    );
  },

  completeExercise: async (
    exerciseId: string,
    weight?: string
  ): Promise<{ status: string; exercise_id: string; completed: boolean }> => {
    return request<{ status: string; exercise_id: string; completed: boolean }>(
      `/workouts/exercises/${exerciseId}/complete`,
      {
        method: 'PUT',
        body: JSON.stringify({ weight }),
      }
    );
  },

  uncompleteExercise: async (
    exerciseId: string
  ): Promise<{ status: string; exercise_id: string; completed: boolean }> => {
    return request<{ status: string; exercise_id: string; completed: boolean }>(
      `/workouts/exercises/${exerciseId}/uncomplete`,
      {
        method: 'PUT',
      }
    );
  },

  getRecent: async (userId: string, limit?: number): Promise<{ workouts: WorkoutPlan[]; count: number }> => {
    const query = limit ? `?limit=${limit}` : '';
    return request<{ workouts: WorkoutPlan[]; count: number }>(`/workouts/${userId}/recent${query}`);
  },
};

// Coaching API
export const coachingApi = {
  getTip: async (
    exerciseName: string,
    userId?: string
  ): Promise<{ exercise: string; tips: CoachingTips }> => {
    return request<{ exercise: string; tips: CoachingTips }>('/coaching/tip', {
      method: 'POST',
      body: JSON.stringify({
        exercise_name: exerciseName,
        user_id: userId,
      }),
    });
  },
};

// Fitness Preferences API
export const fitnessPreferencesApi = {
  get: async (userId: string): Promise<FitnessPreferences> => {
    return request<FitnessPreferences>(`/user/${userId}/fitness-preferences`);
  },

  update: async (
    userId: string,
    preferences: Partial<Omit<FitnessPreferences, 'user_id'>>
  ): Promise<FitnessPreferences & { status: string }> => {
    return request<FitnessPreferences & { status: string }>(`/user/${userId}/fitness-preferences`, {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  },
};

// Profile API - for syncing profile data to Delta's memory
export const profileApi = {
  /**
   * Sync profile from auth profiles to Delta's memory.
   * Call this after updating profile directly in Supabase.
   */
  syncToDelta: async (
    userId: string
  ): Promise<{ status: string; message: string; profile: { name: string | null; age: number | null; sex: string | null } }> => {
    return request<{ status: string; message: string; profile: { name: string | null; age: number | null; sex: string | null } }>(
      `/user/${userId}/sync-profile`,
      { method: 'POST' }
    );
  },
};

// Calendar Types
export interface DailyLog {
  log_id: string;
  user_id: string;
  date: string;
  meals: Array<{ meal: string; description?: string; calories_est?: number }>;
  calories_total: number | null;
  protein_grams: number | null;
  hydration_liters: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  bed_time: string | null;
  wake_time: string | null;
  energy_level: number | null;
  soreness_level: number | null;
  stress_level: number | null;
  alcohol_drinks: number;
  notes: string | null;
  workout_plan_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Goal {
  goal_id: string;
  user_id: string;
  goal_type: 'cut' | 'bulk' | 'maintain' | 'performance' | 'sleep' | 'custom';
  target_value: Record<string, unknown> | null;
  current_value: Record<string, unknown> | null;
  timeframe_weeks: number | null;
  start_date: string;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  created_at: string;
}

export interface WeeklyAssessment {
  assessment_id: string;
  user_id: string;
  week_start: string;
  summary: string;
  goal_progress_pct: number;
  wins: string[];
  blockers: string[];
  recommendations: string[];
  patterns_detected: Array<{
    type: string;
    description: string;
    impact: string;
    confidence: number;
  }> | null;
  created_at: string;
}

export interface GoalProgress {
  goal_id: string;
  goal_type: string;
  progress_pct: number;
  status: string;
  notes: string;
}

// Calendar API
export const calendarApi = {
  getDailyLog: async (
    userId: string,
    date: string
  ): Promise<{ log: DailyLog | null; date: string; message?: string }> => {
    return request<{ log: DailyLog | null; date: string; message?: string }>(
      `/calendar/${userId}/${date}`
    );
  },

  updateDailyLog: async (
    userId: string,
    date: string,
    data: Partial<Omit<DailyLog, 'log_id' | 'user_id' | 'date' | 'created_at' | 'updated_at'>>
  ): Promise<{ status: string; log_id: string; date: string }> => {
    return request<{ status: string; log_id: string; date: string }>(
      `/calendar/${userId}/${date}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  },

  getWeekLogs: async (
    userId: string,
    weekStart: string
  ): Promise<{
    logs: DailyLog[];
    days_count: number;
    week_start: string;
    assessment: WeeklyAssessment | null;
  }> => {
    return request<{
      logs: DailyLog[];
      days_count: number;
      week_start: string;
      assessment: WeeklyAssessment | null;
    }>(`/calendar/${userId}/week/${weekStart}`);
  },

  getMonthLogs: async (
    userId: string,
    year: number,
    month: number
  ): Promise<{ logs: DailyLog[]; days_count: number; year: number; month: number }> => {
    return request<{ logs: DailyLog[]; days_count: number; year: number; month: number }>(
      `/calendar/${userId}/month/${year}/${month}`
    );
  },
};

// Goals API
export const goalsApi = {
  getGoals: async (
    userId: string,
    status: string = 'active'
  ): Promise<{ goals: Goal[]; count: number }> => {
    return request<{ goals: Goal[]; count: number }>(`/goals/${userId}?status=${status}`);
  },

  createGoal: async (
    userId: string,
    goalType: string,
    targetValue?: Record<string, unknown>,
    timeframeWeeks?: number
  ): Promise<{ status: string; goal_id: string }> => {
    return request<{ status: string; goal_id: string }>('/goals', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        goal_type: goalType,
        target_value: targetValue,
        timeframe_weeks: timeframeWeeks,
      }),
    });
  },

  updateGoal: async (
    goalId: string,
    data: { current_value?: Record<string, unknown>; status?: string }
  ): Promise<{ status: string; goal_id: string }> => {
    return request<{ status: string; goal_id: string }>(`/goals/${goalId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getProgress: async (
    userId: string
  ): Promise<{ goals: GoalProgress[]; overall_progress: number }> => {
    return request<{ goals: GoalProgress[]; overall_progress: number }>(`/progress/${userId}`);
  },
};

// Assessment API
export const assessmentApi = {
  getCurrent: async (
    userId: string
  ): Promise<{ assessment: WeeklyAssessment | null; message?: string }> => {
    return request<{ assessment: WeeklyAssessment | null; message?: string }>(
      `/assessment/${userId}`
    );
  },

  getRecent: async (
    userId: string,
    limit: number = 4
  ): Promise<{ assessments: WeeklyAssessment[]; count: number }> => {
    return request<{ assessments: WeeklyAssessment[]; count: number }>(
      `/assessment/${userId}/recent?limit=${limit}`
    );
  },

  generate: async (
    userId: string
  ): Promise<{ status: string; assessment: WeeklyAssessment }> => {
    return request<{ status: string; assessment: WeeklyAssessment }>(
      `/assessment/${userId}/generate`,
      { method: 'POST' }
    );
  },
};

// Patterns API
export const patternsApi = {
  analyze: async (
    userId: string,
    days: number = 14
  ): Promise<{
    patterns: Array<{
      type: string;
      description: string;
      impact: string;
      confidence: number;
    }>;
    data_points: number;
    days_analyzed: number;
    message?: string;
  }> => {
    return request<{
      patterns: Array<{
        type: string;
        description: string;
        impact: string;
        confidence: number;
      }>;
      data_points: number;
      days_analyzed: number;
      message?: string;
    }>(`/patterns/${userId}?days=${days}`);
  },
};

// Derivatives Types
export interface InsightCard {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  trend: string | null;
  confidence: number;
  color?: string;
}

export interface MetricDerivative {
  name: string;
  direction: 'improving' | 'declining' | 'stable' | 'volatile';
  symbol: string;
  momentum_pct: number;
  acceleration: string;
  stability: string;
  variance_ratio: number;
  confidence: number;
  vs_baseline: string;
  baseline_delta_pct: number;
  insufficient_data?: boolean;
}

export interface PhysiologicalMomentum {
  score: number;
  label: string;
  symbol: string;
  confidence: number;
  signals_analyzed: number;
}

export interface RecoveryPattern {
  pattern: string;
  avg_days?: number;
  description: string;
  events_analyzed?: number;
  insufficient_data?: boolean;
}

export interface DerivativesData {
  has_data: boolean;
  days_analyzed: number;
  data_points: number;
  date_range: {
    start: string;
    end: string;
  };
  metrics: Record<string, MetricDerivative>;
  composite: {
    physiological_momentum: PhysiologicalMomentum;
  };
  recovery_patterns: RecoveryPattern;
  message?: string;
}

// Derivatives API
export const derivativesApi = {
  getDerivatives: async (
    userId: string,
    days: number = 30
  ): Promise<DerivativesData> => {
    return request<DerivativesData>(`/derivatives/${userId}?days=${days}`);
  },

  getCards: async (
    userId: string,
    days: number = 14
  ): Promise<{ cards: InsightCard[]; count: number }> => {
    return request<{ cards: InsightCard[]; count: number }>(
      `/derivatives/${userId}/cards?days=${days}`
    );
  },

  getSummary: async (
    userId: string,
    days: number = 30
  ): Promise<{ summary: string; days: number }> => {
    return request<{ summary: string; days: number }>(
      `/derivatives/${userId}/summary?days=${days}`
    );
  },
};

// Export Types
export interface ExportRequest {
  start_date?: string;
  end_date?: string;
}

// Helper for fetch with timeout and retry (for non-JSON responses)
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries: number = MAX_RETRIES
): Promise<Response> {
  if (serverIsWarm && Date.now() - lastSuccessfulRequest > WARM_TIMEOUT_MS) {
    serverIsWarm = false;
  }
  const timeout = serverIsWarm ? NORMAL_TIMEOUT : COLD_START_TIMEOUT;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    serverIsWarm = true;
    lastSuccessfulRequest = Date.now();
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    const isRetryableError =
      error instanceof Error &&
      (error.name === 'AbortError' ||
        error.message.includes('Network request failed') ||
        error.message.includes('timeout') ||
        error.message.includes('network'));

    if (isRetryableError) {
      serverIsWarm = false;

      if (retries > 0) {
        const backoffMs = 1000 * (MAX_RETRIES - retries + 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return fetchWithRetry(url, options, retries - 1);
      }
    }

    throw error;
  }
}

// Export API
export const exportApi = {
  /**
   * Export insights as PDF (primary format).
   * Returns a Blob URL for download.
   */
  exportPdf: async (
    userId: string,
    options?: ExportRequest
  ): Promise<Blob> => {
    const url = `${API_BASE_URL}/export/${userId}/pdf`;
    const { data: sessionData } = await supabase.auth.getSession();
    const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionData?.session?.access_token) {
      authHeaders['Authorization'] = `Bearer ${sessionData.session.access_token}`;
    }
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(options || {}),
    });

    if (response.ok !== true) {
      throw new ApiError('Failed to generate PDF', response.status);
    }

    return response.blob();
  },

  /**
   * Export derived metrics as CSV (secondary format).
   * Returns CSV content as string.
   */
  exportCsv: async (
    userId: string,
    options?: ExportRequest
  ): Promise<string> => {
    const url = `${API_BASE_URL}/export/${userId}/csv`;
    const { data: sessionData } = await supabase.auth.getSession();
    const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionData?.session?.access_token) {
      authHeaders['Authorization'] = `Bearer ${sessionData.session.access_token}`;
    }
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(options || {}),
    });

    if (response.ok !== true) {
      throw new ApiError('Failed to generate CSV', response.status);
    }

    return response.text();
  },

  /**
   * Export insights as JSON (secondary format).
   * Returns structured JSON data.
   */
  exportJson: async (
    userId: string,
    options?: ExportRequest
  ): Promise<Record<string, unknown>> => {
    return request<Record<string, unknown>>(`/export/${userId}/json`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  },
};

// Support Types
export interface SupportRequestData {
  user_id: string;
  subject: string;
  message: string;
  user_email?: string;
  metadata?: Record<string, unknown>;
}

export interface SupportResponse {
  status: string;
  request_id: string;
  message: string;
}

export interface SupportHistoryItem {
  request_id: string;
  subject: string;
  status: string;
  created_at: string;
}

// Support API
export const supportApi = {
  /**
   * Submit a support request.
   * Rate limited to 5 requests per hour.
   */
  submit: async (data: SupportRequestData): Promise<SupportResponse> => {
    return request<SupportResponse>('/support/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get support request history for a user.
   */
  getHistory: async (
    userId: string,
    limit: number = 10
  ): Promise<{ user_id: string; requests: SupportHistoryItem[]; count: number }> => {
    return request<{ user_id: string; requests: SupportHistoryItem[]; count: number }>(
      `/support/${userId}/history?limit=${limit}`
    );
  },
};

// Subscription Types
export interface Subscription {
  subscription_id: string;
  user_id: string;
  plan: 'free' | 'premium' | 'pro';
  status: 'active' | 'canceled' | 'expired' | 'trialing' | 'past_due';
  source: 'stripe' | 'apple' | 'google' | 'manual';
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  canceled_at: string | null;
  external_id: string | null;
}

export interface AccessLevel {
  has_access: boolean;
  reason: string;
  plan: string | null;
  role: 'user' | 'developer' | 'admin' | null;
  expires_at: string | null;
}

export interface FeatureAccess {
  allowed: boolean;
  reason: string;
  feature: string;
  redirect_url?: string;
}

// Subscription API
export const subscriptionApi = {
  /**
   * Get subscription status for a user.
   */
  getSubscription: async (
    userId: string
  ): Promise<{ subscription: Subscription | null; access: AccessLevel }> => {
    return request<{ subscription: Subscription | null; access: AccessLevel }>(
      `/subscription/${userId}`
    );
  },

  /**
   * Get access level for a user.
   * Developers (egeng@umich.edu) have perpetual access.
   */
  getAccessLevel: async (userId: string): Promise<AccessLevel> => {
    return request<AccessLevel>(`/access/${userId}`);
  },

  /**
   * Check if user can access a specific feature.
   *
   * Free features: chat_basic, tracking, profile
   * Premium features: insights, coaching, exports, vision, chat_unlimited
   */
  checkFeatureAccess: async (
    userId: string,
    feature: string
  ): Promise<FeatureAccess> => {
    return request<FeatureAccess>(`/access/${userId}/feature/${feature}`);
  },

  /**
   * Cancel subscription.
   * Access continues until period end.
   */
  cancelSubscription: async (
    userId: string
  ): Promise<{ status: string; message: string; subscription: Subscription }> => {
    return request<{ status: string; message: string; subscription: Subscription }>(
      `/subscription/${userId}/cancel`,
      { method: 'PUT' }
    );
  },
};

// Info URL for learning more about features (App Store compliant - no pricing)
export const INFO_URL = 'https://deltahealthintelligence.com/learn-more';

// Menstrual Tracking Types
export type MenstrualEventType = 'period_start' | 'period_end' | 'ovulation' | 'fertile_start' | 'fertile_end' | 'symptom';
export type FlowIntensity = 'light' | 'medium' | 'heavy' | 'spotting';
export type MenstrualSymptom = 'cramps' | 'headache' | 'bloating' | 'mood_changes' | 'fatigue' | 'breast_tenderness' | 'acne' | 'back_pain' | 'nausea';

export interface MenstrualLog {
  id: string;
  user_id: string;
  date: string;
  event_type: MenstrualEventType;
  flow_intensity: FlowIntensity | null;
  symptoms: MenstrualSymptom[];
  notes: string | null;
  created_at: string;
}

export interface MenstrualSettings {
  user_id: string;
  tracking_enabled: boolean;
  average_cycle_length: number;
  average_period_length: number;
  last_period_start: string | null;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CyclePhase {
  phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
  day_in_cycle: number;
  days_until_period: number | null;
  is_fertile_window: boolean;
}

export interface MenstrualCalendarDay {
  date: string;
  is_period: boolean;
  is_predicted_period: boolean;
  is_fertile: boolean;
  is_ovulation: boolean;
  flow_intensity: FlowIntensity | null;
  symptoms: MenstrualSymptom[];
  has_log: boolean;
}

// =============================================================================
// HEALTH INTELLIGENCE TYPES
// =============================================================================

export type RecoveryState = 'recovered' | 'neutral' | 'under_recovered';
export type LoadState = 'low' | 'moderate' | 'high';
export type EnergyState = 'depleted' | 'low' | 'moderate' | 'high' | 'peak';
export type Chronotype = 'early_bird' | 'intermediate' | 'night_owl';

export interface HealthStateFactors {
  [key: string]: string | boolean | number;
}

export interface CausalChain {
  chain_type: string;
  cause_event: string;
  effect_event: string;
  occurrences: number;
  co_occurrences: number;
  confidence: number;
  lag_days: number;
  narrative: string;
}

export interface HealthStateResponse {
  has_data: boolean;
  computed_at?: string;
  days_analyzed?: number;
  recovery?: {
    state: RecoveryState;
    confidence: number;
    factors: HealthStateFactors;
  };
  load?: {
    state: LoadState;
    cumulative: number;
    confidence: number;
  };
  energy?: {
    state: EnergyState;
    confidence: number;
  };
  alignment?: {
    score: number;
    confidence: number;
    chronotype: Chronotype;
    chronotype_confidence: number;
  };
  causal_chains?: CausalChain[];
  narrative?: {
    narrative: string;
    patterns: Array<{ type: string; note?: string; confidence?: number }>;
    metrics_summary: Record<string, number | null>;
  };
  readiness?: {
    score: number;
    recommendation: 'green_light' | 'normal' | 'caution' | 'rest';
    message: string;
    breakdown?: Record<string, { contribution: number; detail: string; recent_avg?: number }>;
    cycle_context?: {
      phase: string;
      day_of_cycle: number;
    };
  };
  disclaimer?: string;
  message?: string;
}

export interface UserBaseline {
  value: number;
  variance: number | null;
  data_points: number;
  confidence: number;
}

export interface BaselinesResponse {
  user_id: string;
  baselines: Record<string, UserBaseline>;
}

export interface AlignmentResponse {
  user_id: string;
  chronotype: {
    chronotype: Chronotype;
    confidence: number;
    avg_wake_hour?: number;
    avg_bed_hour?: number;
    optimal_windows?: {
      optimal_wake: string;
      optimal_sleep: string;
      workout_window: { start: string; end: string };
      focus_window: { start: string; end: string };
    };
  };
  alignment: {
    score: number;
    confidence: number;
    factors: HealthStateFactors;
  };
  optimal_windows?: {
    optimal_wake: string;
    optimal_sleep: string;
    workout_window: { start: string; end: string };
    focus_window: { start: string; end: string };
  };
}

export interface NarrativeResponse {
  user_id: string;
  period: string;
  narrative: string;
  patterns: Array<{ type: string; note?: string; confidence?: number }>;
  metrics_summary: Record<string, number | null>;
}

// Intelligence cache — 5-minute TTL to avoid redundant fetches
const intelligenceCache = new Map<string, { data: unknown; ts: number }>();
const INTEL_CACHE_TTL = 5 * 60 * 1000;

function cachedRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = intelligenceCache.get(key);
  if (cached && Date.now() - cached.ts < INTEL_CACHE_TTL) {
    return Promise.resolve(cached.data as T);
  }
  return fetcher().then((data) => {
    intelligenceCache.set(key, { data, ts: Date.now() });
    if (intelligenceCache.size > 50) {
      const oldestKey = intelligenceCache.keys().next().value;
      if (oldestKey !== undefined) intelligenceCache.delete(oldestKey);
    }
    return data;
  });
}

/** Call to force-clear intelligence cache (e.g. after new data logged). */
export function invalidateIntelligenceCache(): void {
  intelligenceCache.clear();
}

// Health Intelligence API
export const healthIntelligenceApi = {
  getState: async (userId: string): Promise<HealthStateResponse> => {
    return request<HealthStateResponse>(`/health-intelligence/${userId}/state`);
  },

  getBaselines: async (userId: string): Promise<BaselinesResponse> => {
    return request<BaselinesResponse>(`/health-intelligence/${userId}/baselines`);
  },

  getCausalChains: async (
    userId: string,
    days: number = 30
  ): Promise<{ user_id: string; chains: CausalChain[]; days_analyzed: number }> => {
    const res = await request<{ user_id: string; chains: CausalChain[]; days_analyzed: number }>(
      `/health-intelligence/${userId}/causal-chains?days=${days}`
    );
    for (const chain of res.chains) {
      recordDecision({
        timestamp: new Date().toISOString(),
        source: 'causalChains',
        decision: `${chain.cause_event} → ${chain.effect_event}`,
        reasoning: `${Math.round(chain.confidence * 100)}% conf, ${chain.occurrences} occurrences, lag ${chain.lag_days}d`,
        raw: chain,
      });
    }
    return res;
  },

  getAlignment: async (userId: string): Promise<AlignmentResponse> => {
    return request<AlignmentResponse>(`/health-intelligence/${userId}/alignment`);
  },

  getNarrative: async (
    userId: string,
    period: 'weekly' | 'monthly'
  ): Promise<NarrativeResponse> => {
    return request<NarrativeResponse>(`/health-intelligence/${userId}/narrative/${period}`);
  },

  // =========================================================================
  // DELTA INTELLIGENCE - LLM-powered explanations
  // =========================================================================

  /**
   * Get full Delta insights with LLM-generated explanations.
   * This is the main endpoint for Delta's voice.
   */
  getInsights: async (userId: string): Promise<DeltaInsightsResponse> => {
    const res = await request<DeltaInsightsResponse>(`/health-intelligence/${userId}/insights`);
    if (res.commentary?.headline) {
      recordDecision({
        timestamp: new Date().toISOString(),
        source: 'insights',
        decision: res.commentary.headline,
        reasoning: `tone: ${res.commentary.tone}, patterns: ${res.patterns?.length ?? 0}, factors: ${res.factors?.length ?? 0}`,
        raw: res,
      });
    }
    return res;
  },

  /**
   * Get Delta-driven modules for frontend rendering.
   * Backend controls layout, priority, viz, brevity. Frontend is a dumb renderer.
   */
  getModules: async (userId: string): Promise<ModulesResponse> => {
    try {
      const res = await request<ModulesResponse>(
        `/health-intelligence/${userId}/modules`
      );
      if (__DEV__) console.log('[API] /modules response:', JSON.stringify(res).slice(0, 200));
      return res;
    } catch (err) {
      if (__DEV__) console.error('[API] /modules FAILED:', err);
      return { user_id: userId, has_data: false, modules: [] };
    }
  },

  /**
   * Get just Delta's daily commentary (headline + body + tone).
   * Lightweight endpoint for dashboard display.
   */
  getCommentary: async (userId: string): Promise<DeltaCommentaryResponse> => {
    const res = await request<DeltaCommentaryResponse>(`/health-intelligence/${userId}/commentary`);
    if (res.commentary?.headline) {
      recordDecision({
        timestamp: new Date().toISOString(),
        source: 'commentary',
        decision: res.commentary.headline,
        reasoning: `tone: ${res.commentary.tone}, readiness: ${res.readiness_score ?? 'n/a'}`,
        raw: res,
      });
    }
    return res;
  },

  /**
   * Get workout guidance: go/caution/skip with specific modifications.
   */
  getWorkoutGuidance: async (
    userId: string,
    workoutType?: string
  ): Promise<WorkoutGuidanceResponse> => {
    return request<WorkoutGuidanceResponse>(
      `/health-intelligence/${userId}/workout-guidance`,
      {
        method: 'POST',
        body: JSON.stringify({ workout_type: workoutType }),
      }
    );
  },

  /**
   * Get Delta's analysis of sleep data.
   */
  analyzeSleep: async (
    userId: string,
    sleepData: SleepAnalysisInput
  ): Promise<SleepAnalysisResponse> => {
    return request<SleepAnalysisResponse>(
      `/health-intelligence/${userId}/sleep-analysis`,
      {
        method: 'POST',
        body: JSON.stringify(sleepData),
      }
    );
  },

  /**
   * Get Delta's analysis of a metric trend.
   */
  analyzeTrend: async (
    userId: string,
    metric: string,
    days: number = 7
  ): Promise<TrendAnalysisResponse> => {
    return request<TrendAnalysisResponse>(
      `/health-intelligence/${userId}/trend-analysis`,
      {
        method: 'POST',
        body: JSON.stringify({ metric, days }),
      }
    );
  },

  /**
   * Get detailed explanation for a specific causal pattern.
   */
  explainPattern: async (
    userId: string,
    patternId: string
  ): Promise<PatternExplanationResponse> => {
    return request<PatternExplanationResponse>(
      `/health-intelligence/${userId}/pattern/${patternId}/explain`
    );
  },

  getDigestionInsights: async (userId: string): Promise<DigestionInsightsResponse> => {
    return request<DigestionInsightsResponse>(
      `/health-intelligence/${userId}/digestion`
    );
  },

  /**
   * Get proactive agent actions - things Delta wants to tell the user.
   * Predictions resolving, patterns discovered, data gaps, etc.
   */
  getAgentActions: async (userId: string): Promise<AgentActionsResponse> => {
    try {
      return await request<AgentActionsResponse>(
        `/health-intelligence/${userId}/agent-actions`
      );
    } catch (e) {
      console.warn('[Intelligence] getAgentActions failed:', e);
      return { user_id: userId, actions: [] };
    }
  },

  /**
   * Get learned causal chains with full detail.
   */
  getLearnedChains: async (userId: string): Promise<LearnedChainsResponse> => {
    try {
      return await cachedRequest(`chains:${userId}`, () =>
        request<LearnedChainsResponse>(`/health-intelligence/${userId}/learned-chains`)
      );
    } catch (e) {
      console.warn('[Intelligence] getLearnedChains failed:', e);
      return { user_id: userId, chains: [], count: 0 };
    }
  },

  /**
   * Get active predictions - what Delta thinks happens next 24h.
   */
  getPredictions: async (userId: string): Promise<PredictionsResponse> => {
    try {
      return await cachedRequest(`preds:${userId}`, () =>
        request<PredictionsResponse>(`/health-intelligence/${userId}/predictions`)
      );
    } catch (e) {
      console.warn('[Intelligence] getPredictions failed:', e);
      return { user_id: userId, predictions: [], accuracy: null };
    }
  },

  /**
   * Get recent belief updates - what Delta learned, what changed.
   */
  getBeliefUpdates: async (userId: string): Promise<BeliefUpdatesResponse> => {
    try {
      return await cachedRequest(`beliefs:${userId}`, () =>
        request<BeliefUpdatesResponse>(`/health-intelligence/${userId}/belief-updates`)
      );
    } catch (e) {
      console.warn('[Intelligence] getBeliefUpdates failed:', e);
      return { user_id: userId, updates: [] };
    }
  },

  /**
   * Get knowledge gaps - what data Delta needs to improve predictions.
   */
  getUncertainty: async (userId: string): Promise<UncertaintyResponse> => {
    try {
      return await cachedRequest(`uncertainty:${userId}`, () =>
        request<UncertaintyResponse>(`/health-intelligence/${userId}/uncertainty`)
      );
    } catch (e) {
      console.warn('[Intelligence] getUncertainty failed:', e);
      return { user_id: userId, gaps: [], overall_confidence: 0 };
    }
  },

  /**
   * Get overall learning status - how Delta's intelligence is progressing.
   */
  getLearningStatus: async (userId: string): Promise<LearningStatusResponse> => {
    try {
      return await cachedRequest(`status:${userId}`, () =>
        request<LearningStatusResponse>(`/health-intelligence/${userId}/learning-status`)
      );
    } catch (e) {
      console.warn('[Intelligence] getLearningStatus failed:', e);
      return {
        user_id: userId,
        days_of_data: 0,
        patterns_discovered: 0,
        predictions_made: 0,
        predictions_correct: 0,
        status: 'learning',
      };
    }
  },

  /**
   * Get contradictions — beliefs that conflict with each other.
   */
  getContradictions: async (userId: string): Promise<ContradictionsResponse> => {
    try {
      return await cachedRequest(`contradictions:${userId}`, () =>
        request<ContradictionsResponse>(`/health-intelligence/${userId}/contradictions`)
      );
    } catch (e) {
      console.warn('[Intelligence] getContradictions failed:', e);
      return { user_id: userId, total: 0, contradictions: [] };
    }
  },

  /**
   * Combined intelligence summary — single request for all intelligence data.
   * Falls back to individual calls if summary endpoint unavailable.
   */
  getSummary: async (userId: string): Promise<IntelligenceSummaryResponse> => {
    try {
      return await cachedRequest(`summary:${userId}`, () =>
        request<IntelligenceSummaryResponse>(`/health-intelligence/${userId}/summary`)
      );
    } catch (e) {
      console.warn('[Intelligence] getSummary failed, falling back to individual calls:', e);
      // Fallback: call individual endpoints
      const [chainsRes, predsRes, beliefsRes, gapsRes, statusRes] = await Promise.all([
        healthIntelligenceApi.getLearnedChains(userId),
        healthIntelligenceApi.getPredictions(userId),
        healthIntelligenceApi.getBeliefUpdates(userId),
        healthIntelligenceApi.getUncertainty(userId),
        healthIntelligenceApi.getLearningStatus(userId),
      ]);
      return {
        user_id: userId,
        chains: chainsRes,
        predictions: predsRes,
        belief_updates: beliefsRes,
        uncertainty: gapsRes,
        learning_status: statusRes,
      };
    }
  },
};

// =============================================================================
// DELTA INTELLIGENCE TYPES
// =============================================================================

export interface DeltaCommentary {
  headline: string;
  body: string;
  tone: 'positive' | 'neutral' | 'caution' | 'rest';
}

export interface ExplainedPattern {
  cause: string;
  effect: string;
  times_observed: number;
  total_occurrences: number;
  impact_percentage: number;
  confidence: number;
  lag_days: number;
  // LLM-generated explanations
  narrative: string;
  why: string;
  advice: string;
}

export interface ExplainedFactor {
  key: string;
  name: string;
  state: string;
  impact: 'positive' | 'negative' | 'neutral';
  current_value?: number;
  baseline?: number;
  // LLM-generated explanations
  explanation: string;
  suggestion: string | null;
}

export interface FactorInteraction {
  interaction: string;
  net_effect: string;
  priority: string;
}

export interface DeltaInsightsResponse {
  user_id: string;
  has_data: boolean;
  commentary: DeltaCommentary;
  patterns: ExplainedPattern[];
  factors: ExplainedFactor[];
  interaction: FactorInteraction | null;
  readiness: {
    score: number;
    recommendation: string;
  } | null;
  cycle_context: {
    phase: string;
    day_in_cycle: number;
  } | null;
}

export interface DeltaCommentaryResponse {
  user_id: string;
  commentary: DeltaCommentary;
  readiness_score: number | null;
}

export interface WorkoutGuidanceResponse {
  user_id: string;
  readiness_score: number | null;
  recommendation: 'go' | 'caution' | 'skip';
  rationale: string;
  modifications: string | null;
  alternatives: string | null;
}

export interface SleepAnalysisInput {
  duration_hours: number;
  efficiency?: number;
  wake_count?: number;
  bedtime?: string;
  wake_time?: string;
  deep_sleep_pct?: number;
  rem_sleep_pct?: number;
}

export interface SleepAnalysisResponse {
  user_id: string;
  quality_assessment: string;
  issues: string[];
  recommendations: string[];
}

export interface DigestionFactor {
  label: string;
  status: 'good' | 'moderate' | 'concern';
  detail: string;
}

export interface DigestionInsightsResponse {
  user_id: string;
  has_data: boolean;
  summary: string;
  factors: DigestionFactor[];
  suggestions: string[];
}

export interface TrendAnalysisResponse {
  user_id: string;
  metric: string;
  trend: {
    direction: 'improving' | 'declining' | 'stable' | 'volatile';
    change_percent: number;
    days: number;
    values: number[];
  };
  summary: string;
  interpretation: string;
  outlook: string;
}

export interface PatternExplanationResponse {
  user_id: string;
  pattern: CausalChain;
  narrative: string;
  why: string;
  advice: string;
}

// =============================================================================
// AGENT ACTIONS & INTELLIGENCE TYPES (Conversation-first redesign)
// =============================================================================

export interface AgentAction {
  id: string;
  type: 'prediction_resolving' | 'pattern_discovered' | 'data_gap' | 'milestone' | 'insight';
  title: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
  action_label?: string;
  action_type?: 'log' | 'chat' | 'view';
  created_at: string;
  expires_at?: string;
}

export interface AgentActionsResponse {
  user_id: string;
  actions: AgentAction[];
}

export interface LearnedChain {
  id: string;
  cause: string;
  effect: string;
  lag_days: number;
  confidence: number;
  times_verified: number;
  total_occurrences: number;
  narrative: string;
  why?: string;
  advice?: string;
  last_verified?: string;
  belief_history?: Array<{ date: string; confidence: number }>;
}

export interface LearnedChainsResponse {
  user_id: string;
  chains: LearnedChain[];
  count: number;
}

export interface Prediction {
  id: string;
  metric: string;
  predicted_value: string;
  predicted_direction: 'up' | 'down' | 'stable';
  confidence: number;
  reasoning: string;
  resolves_at: string;
  resolved?: boolean;
  actual_value?: string;
  was_correct?: boolean;
}

export interface PredictionsResponse {
  user_id: string;
  predictions: Prediction[];
  accuracy: { correct: number; total: number } | null;
}

export interface BeliefUpdate {
  id: string;
  pattern: string;
  old_confidence: number;
  new_confidence: number;
  reason: string;
  updated_at: string;
}

export interface BeliefUpdatesResponse {
  user_id: string;
  updates: BeliefUpdate[];
}

export interface KnowledgeGap {
  metric: string;
  description: string;
  impact: string;
  days_needed: number;
}

export interface UncertaintyResponse {
  user_id: string;
  gaps: KnowledgeGap[];
  overall_confidence: number;
}

export interface LearningStatusResponse {
  user_id: string;
  days_of_data: number;
  patterns_discovered: number;
  predictions_made: number;
  predictions_correct: number;
  status: 'learning' | 'calibrating' | 'confident';
  contradictions?: number;
  last_computed_at?: string;
}

export interface Contradiction {
  id?: string;
  chain_a: string;
  chain_b: string;
  conflict_type: string;
  description: string;
}

export interface ContradictionsResponse {
  user_id: string;
  total: number;
  contradictions: Contradiction[];
}

export interface IntelligenceSummaryResponse {
  user_id: string;
  chains: LearnedChainsResponse;
  predictions: PredictionsResponse;
  belief_updates: BeliefUpdatesResponse;
  uncertainty: UncertaintyResponse;
  learning_status: LearningStatusResponse;
  contradictions?: ContradictionsResponse;
}

// =============================================================================
// DELTA MODULES TYPES (Backend-driven module system)
// =============================================================================

export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface VizDirective {
  chart_type: 'line' | 'bar' | 'scatter' | 'heatmap' | 'distribution' | 'comparison';
  metric: string;
  title: string;
  zoom: ZoomLevel;
  insight?: string;
}

export interface DeltaModule {
  id: string;
  type: string;
  layout: 'wide' | 'standard' | 'compact';
  priority: number;
  brief: string;
  detail: string;
  tone: 'positive' | 'caution' | 'rest' | 'neutral';
  icon: string;
  chat_prefill?: string;
  metric_value?: string;
  viz?: VizDirective;
}

export interface ModulesResponse {
  user_id: string;
  has_data: boolean;
  modules: DeltaModule[];
}

// =============================================================================
// PROFILE STAT CARDS TYPES
// =============================================================================

export interface StatCard {
  id: string;
  user_id: string;
  card_type: string;
  display_name: string;
  value: string;
  unit: string | null;
  display_order: number;
  is_visible: boolean;
  recorded_at: string | null;
  created_at: string;
}

export interface StatCardInput {
  card_type: string;
  display_name: string;
  value: string;
  unit?: string;
  is_visible?: boolean;
  recorded_at?: string;
}

// Profile Cards API
export const profileCardsApi = {
  getCards: async (
    userId: string
  ): Promise<{ user_id: string; cards: StatCard[]; count: number }> => {
    return request<{ user_id: string; cards: StatCard[]; count: number }>(
      `/profile/${userId}/cards`
    );
  },

  createCard: async (
    userId: string,
    data: StatCardInput
  ): Promise<{ status: string; card: StatCard }> => {
    return request<{ status: string; card: StatCard }>(`/profile/${userId}/cards`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateCard: async (
    userId: string,
    cardId: string,
    data: StatCardInput
  ): Promise<{ status: string; card: StatCard }> => {
    return request<{ status: string; card: StatCard }>(
      `/profile/${userId}/cards/${cardId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  },

  deleteCard: async (
    userId: string,
    cardId: string
  ): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(
      `/profile/${userId}/cards/${cardId}`,
      { method: 'DELETE' }
    );
  },

  reorderCards: async (
    userId: string,
    order: string[]
  ): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(
      `/profile/${userId}/cards/reorder`,
      {
        method: 'PUT',
        body: JSON.stringify({ order }),
      }
    );
  },
};

// Conversation types
export interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

// Conversation API
export const conversationsApi = {
  getAll: async (userId: string): Promise<{ conversations: Conversation[] }> => {
    return request<{ conversations: Conversation[] }>(`/conversations/${userId}`);
  },

  create: async (
    userId: string,
    id: string,
    title: string
  ): Promise<Conversation> => {
    return request<Conversation>(`/conversations/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ id, title }),
    });
  },

  updateTitle: async (
    userId: string,
    conversationId: string,
    title: string
  ): Promise<{ id: string; title: string; updated_at: number }> => {
    return request<{ id: string; title: string; updated_at: number }>(
      `/conversations/${userId}/${conversationId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ title }),
      }
    );
  },

  delete: async (
    userId: string,
    conversationId: string
  ): Promise<{ status: string }> => {
    return request<{ status: string }>(
      `/conversations/${userId}/${conversationId}`,
      { method: 'DELETE' }
    );
  },

  sync: async (
    userId: string,
    conversations: Array<{
      id: string;
      title: string;
      created_at?: number;
      updated_at?: number;
    }>
  ): Promise<{ conversations: Conversation[] }> => {
    return request<{ conversations: Conversation[] }>(
      `/conversations/${userId}/sync`,
      {
        method: 'POST',
        body: JSON.stringify({ conversations }),
      }
    );
  },
};

// =============================================================================
// DATA OVERSIGHT TYPES & API
// =============================================================================

export interface DataIssue {
  type: 'duplicate' | 'anomaly' | 'impossible_value';
  severity: 'low' | 'medium' | 'high' | 'critical';
  entry_ids: string[];
  field?: string;
  current_value?: number;
  expected_range?: { min: number; max: number };
  similarity_score?: number;
  explanation: string;
  recommended_action?: string;
}

export interface AuditLogEntry {
  audit_id: string;
  action_type: 'entry_created' | 'entry_updated' | 'entry_deleted' | 'entries_merged' | 'batch_deleted' | 'value_corrected';
  actor: 'user' | 'delta_auto' | 'delta_suggested' | 'system';
  affected_entry_ids: string[];
  affected_count: number;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  reason: string;
  delta_explanation?: string;
  created_at: string;
  is_reversible: boolean;
  reversed_at?: string;
}

export interface DataHealthResponse {
  user_id: string;
  has_issues: boolean;
  issue_count: number;
  issues: DataIssue[];
  recent_actions: AuditLogEntry[];
  summary: {
    duplicates_found: number;
    anomalies_found: number;
    impossible_values_found: number;
  };
}

export interface AuditLogResponse {
  user_id: string;
  entries: AuditLogEntry[];
  count: number;
  limit: number;
  offset: number;
}

export interface DataActionResponse {
  success: boolean;
  message: string;
  audit_id?: string;
  error?: string;
}

export interface DataScanResponse {
  user_id: string;
  scan_complete: boolean;
  issues_found: number;
  duplicates: number;
  anomalies: number;
  impossible_values: number;
}

// Data Oversight API
export const dataOversightApi = {
  /**
   * Get data health status - issues, recent actions, summary.
   */
  getHealth: async (userId: string): Promise<DataHealthResponse> => {
    return request<DataHealthResponse>(`/data-health/${userId}`);
  },

  /**
   * Get audit log history - all data modifications by Delta.
   */
  getAuditLog: async (
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AuditLogResponse> => {
    return request<AuditLogResponse>(
      `/data-audit/${userId}?limit=${limit}&offset=${offset}`
    );
  },

  /**
   * Approve or reject a suggested data correction.
   */
  approveAction: async (
    userId: string,
    action: 'approve' | 'reject',
    issueType: string,
    entryIds: string[],
    reason?: string
  ): Promise<DataActionResponse> => {
    return request<DataActionResponse>(
      `/data-oversight/${userId}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({
          action,
          issue_type: issueType,
          entry_ids: entryIds,
          reason,
        }),
      }
    );
  },

  /**
   * Undo a previous data modification.
   */
  undoAction: async (
    userId: string,
    auditId: string
  ): Promise<DataActionResponse> => {
    return request<DataActionResponse>(
      `/data-oversight/${userId}/undo/${auditId}`,
      { method: 'POST' }
    );
  },

  /**
   * Trigger a manual data health scan.
   */
  triggerScan: async (userId: string): Promise<DataScanResponse> => {
    return request<DataScanResponse>(
      `/data-oversight/${userId}/scan`,
      { method: 'POST' }
    );
  },
};
