/**
 * Theme colors for Delta app.
 *
 * SAFETY: All values are explicit strings/numbers.
 * No boolean-like strings ("true"/"false").
 */

// Light theme - clean and modern
export const lightTheme = {
  mode: 'light' as const,
  background: '#f8fafc',       // Clean light gray
  surface: '#ffffff',
  surfaceSecondary: '#f1f5f9', // Subtle secondary
  textPrimary: '#0f172a',      // Dark slate for contrast
  textSecondary: '#64748b',    // Balanced secondary text
  accent: '#6366f1',           // Indigo - more vibrant
  accentLight: '#e0e7ff',
  border: '#e2e8f0',           // Subtle borders
  error: '#ef4444',            // Clean red
  success: '#22c55e',          // Vibrant green
  warning: '#f59e0b',          // Warm orange
  // WHOOP-inspired semantic colors
  recovery: '#22c55e',         // Green for recovery
  strain: '#f59e0b',           // Orange for strain/load
  sleep: '#6366f1',            // Indigo for sleep
  heart: '#ef4444',            // Red for heart rate
};

// Dark theme - WHOOP-inspired true black
export const darkTheme = {
  mode: 'dark' as const,
  background: '#000000',       // True black (WHOOP style)
  surface: '#111111',          // Near black cards
  surfaceSecondary: '#1a1a1a', // Slightly lighter
  textPrimary: '#ffffff',      // Pure white
  textSecondary: '#8b8b8b',    // Muted gray
  accent: '#6366f1',           // Keep indigo consistent
  accentLight: '#1e1b4b',      // Dark indigo
  border: '#2a2a2a',           // Subtle dark borders
  error: '#f87171',            // Bright red
  success: '#4ade80',          // Bright green (recovery)
  warning: '#fbbf24',          // Bright yellow/orange (strain)
  // WHOOP-inspired semantic colors
  recovery: '#4ade80',         // Bright green for recovery
  strain: '#fbbf24',           // Yellow for strain/load
  sleep: '#818cf8',            // Light indigo for sleep
  heart: '#f87171',            // Red for heart rate
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
  // WHOOP-inspired semantic colors
  recovery: string;
  strain: string;
  sleep: string;
  heart: string;
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
