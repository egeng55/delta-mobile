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
