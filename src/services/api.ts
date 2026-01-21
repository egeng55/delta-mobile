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
