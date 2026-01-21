/**
 * API Service - Connects to Delta backend on Render.
 *
 * SAFETY DECISIONS:
 * - All responses are explicitly typed
 * - Error handling with explicit checks
 * - No implicit type coercion
 */

const API_BASE_URL = 'https://delta-80ht.onrender.com';

// Response types
export interface User {
  id: string;
  email: string;
  name: string;
  created_at?: string;
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

// Helper to make requests
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.ok !== true) {
    let errorMessage = 'Request failed';
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch {
      // Use default error message
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json() as Promise<T>;
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

  createGuest: async (): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/guest', {
      method: 'POST',
    });
  },
};

// Chat API
export const chatApi = {
  sendMessage: async (userId: string, message: string): Promise<string> => {
    const response = await request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, message }),
    });
    return response.response;
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

// Dashboard API
export const dashboardApi = {
  getDashboard: async (userId: string): Promise<unknown> => {
    return request<unknown>(`/dashboard/${userId}`);
  },

  getWeekly: async (userId: string): Promise<unknown> => {
    return request<unknown>(`/dashboard/${userId}/weekly`);
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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
