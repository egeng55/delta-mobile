/**
 * Centralized configuration constants for Delta mobile app.
 *
 * All environment-specific values should be defined here.
 * Import from this file instead of hardcoding values in components.
 */

// Environment detection
export const IS_DEV = __DEV__;
export const IS_PROD = !__DEV__;

// API Configuration
export const API_BASE_URL = 'https://delta-80ht.onrender.com';

// Supabase Configuration
export const SUPABASE_URL = 'https://fhbfaoowwnzzynhbgcms.supabase.co';

export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYmZhb293d256enluaGJnY21zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NTQxOTcsImV4cCI6MjA4NDUzMDE5N30.tLvdwDBL9ftVq-xb2C9UCm4MXb8r2owNMlSL_G_iM8k';

// Request timeouts (in milliseconds)
export const TIMEOUTS = {
  COLD_START: 45000, // 45 seconds for cold start
  NORMAL: 15000, // 15 seconds for normal requests
  CHAT: 30000, // 30 seconds for chat (AI responses)
  IMAGE_UPLOAD: 60000, // 60 seconds for image uploads
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000, // 1 second
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  DURATION_MS: 5 * 60 * 1000, // 5 minutes
  PREFIX: '@delta_',
} as const;

// Legal document URLs
export const LEGAL_URLS = {
  PRIVACY_POLICY: `${API_BASE_URL}/legal/privacy`,
  TERMS_OF_SERVICE: `${API_BASE_URL}/legal/terms`,
  HIPAA_NOTICE: `${API_BASE_URL}/legal/hipaa`,
} as const;

// Developer access - should be verified server-side
// This is only used for UI hints, actual access is controlled by backend
export const DEVELOPER_EMAILS = [
  'egeng@umich.edu',
  'eric@egeng.co',
  'delta.test@example.com',  // Test account for development
] as const;

/**
 * Check if an email belongs to a developer.
 * Note: This is only for UI purposes. Actual access control is server-side.
 */
export function isDeveloperEmail(email: string | undefined): boolean {
  if (!email) return false;
  return DEVELOPER_EMAILS.includes(email.toLowerCase() as typeof DEVELOPER_EMAILS[number]);
}
