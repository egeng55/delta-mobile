/**
 * Theme colors for Delta app.
 *
 * SAFETY: All values are explicit strings/numbers.
 * No boolean-like strings ("true"/"false").
 */

// Light theme - slightly darker, higher contrast
export const lightTheme = {
  mode: 'light' as const,
  background: '#f1f5f9',      // Darker background
  surface: '#ffffff',
  surfaceSecondary: '#e2e8f0', // Darker secondary
  textPrimary: '#020617',      // Near black for max contrast
  textSecondary: '#475569',    // Darker secondary text
  accent: '#6366f1',           // Indigo - more vibrant
  accentLight: '#e0e7ff',
  border: '#cbd5e1',           // More visible borders
  error: '#dc2626',            // Deeper red
  success: '#16a34a',          // Deeper green
  warning: '#d97706',          // Deeper orange
};

// Dark theme - true dark, high contrast
export const darkTheme = {
  mode: 'dark' as const,
  background: '#030712',       // Near black
  surface: '#0f172a',          // Very dark blue
  surfaceSecondary: '#1e293b', // Dark slate
  textPrimary: '#f8fafc',      // Bright white
  textSecondary: '#94a3b8',    // Visible gray
  accent: '#818cf8',           // Brighter indigo
  accentLight: '#1e1b4b',      // Dark indigo
  border: '#1e293b',           // Subtle borders
  error: '#f87171',            // Bright red
  success: '#4ade80',          // Bright green
  warning: '#fbbf24',          // Bright yellow
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
