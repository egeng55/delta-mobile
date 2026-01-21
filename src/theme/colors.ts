/**
 * Theme colors for Delta app.
 *
 * SAFETY: All values are explicit strings/numbers.
 * No boolean-like strings ("true"/"false").
 */

export const lightTheme = {
  mode: 'light' as const,
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceSecondary: '#f1f5f9',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  accent: '#3b82f6',
  accentLight: '#eff6ff',
  border: '#e2e8f0',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
};

export const darkTheme = {
  mode: 'dark' as const,
  background: '#0f172a',
  surface: '#1e293b',
  surfaceSecondary: '#334155',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  accent: '#60a5fa',
  accentLight: '#1e3a5f',
  border: '#334155',
  error: '#f87171',
  success: '#4ade80',
  warning: '#fbbf24',
};

// Theme type that works for both light and dark
export interface Theme {
  mode: 'light' | 'dark';
  background: string;
  surface: string;
  surfaceSecondary: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentLight: string;
  border: string;
  error: string;
  success: string;
  warning: string;
}

/**
 * Get theme based on color scheme.
 * SAFETY: Explicit comparison, returns concrete theme object.
 */
export function getTheme(colorScheme: string | null | undefined): Theme {
  // Explicit string comparison - never rely on truthiness
  if (colorScheme === 'dark') {
    return darkTheme;
  }
  return lightTheme;
}
