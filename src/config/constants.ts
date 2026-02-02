/**
 * Centralized configuration constants for Delta mobile app.
 *
 * All environment-specific values should be defined here.
 * Import from this file instead of hardcoding values in components.
 */

import Constants from 'expo-constants';

// Environment detection
export const IS_DEV = __DEV__;
export const IS_PROD = !__DEV__;

// API Configuration - sourced from app.config.ts via expo.extra
export const API_BASE_URL: string =
  Constants.expoConfig?.extra?.apiBaseUrl ?? 'https://delta-80ht.onrender.com';

// Supabase Configuration - sourced from app.config.ts via expo.extra
export const SUPABASE_URL: string =
  Constants.expoConfig?.extra?.supabaseUrl ?? '';

export const SUPABASE_ANON_KEY: string =
  Constants.expoConfig?.extra?.supabaseAnonKey ?? '';

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

// Developer access - sourced from env, only used for UI hints
// Actual access control is server-side
const devEmailsRaw: string = Constants.expoConfig?.extra?.developerEmails ?? '';
export const DEVELOPER_EMAILS: readonly string[] = devEmailsRaw
  ? devEmailsRaw.split(',').map((e: string) => e.trim().toLowerCase())
  : [];

/**
 * Check if an email belongs to a developer.
 * Note: This is only for UI purposes. Actual access control is server-side.
 */
export function isDeveloperEmail(email: string | undefined): boolean {
  if (!email) return false;
  return DEVELOPER_EMAILS.includes(email.toLowerCase());
}
