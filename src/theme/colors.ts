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

// Dark theme - Conversation-first, Delta intelligence aesthetic
export const darkTheme = {
  mode: 'dark' as const,
  background: '#0A0A0F',       // Near-black with slight blue
  surface: '#14141F',          // Dark blue-gray cards
  surfaceSecondary: '#1A1A2E', // Slightly lighter
  textPrimary: '#fafafa',      // Off-white (easier on eyes than pure white)
  textSecondary: '#737373',    // Muted gray
  accent: '#6366F1',           // Indigo - Delta's voice
  accentLight: '#6366F126',    // Delta's voice at 15% opacity
  border: '#1E1E2E',           // Subtle dark borders with blue tint
  error: '#f87171',            // Bright red
  success: '#5EEAD4',          // Muted teal (not bright green)
  warning: '#FBBF24',          // Soft amber (not WHOOP orange)
  // Semantic colors - intelligence-first
  recovery: '#5EEAD4',         // Muted teal
  strain: '#FBBF24',           // Soft amber
  sleep: '#a78bfa',            // Purple
  heart: '#fb7185',            // Rose
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

/**
 * Goal-based color tints.
 * Provides subtle gradient colors based on user's fitness goal.
 *
 * - 'cut' (losing weight): Lighter, cooler tones - airy, light feeling
 * - 'maintain': Balanced, neutral tones
 * - 'bulk' (gaining weight): Darker, warmer tones - grounded, powerful feeling
 */
export type FitnessGoal = 'cut' | 'maintain' | 'bulk';

export interface GoalTints {
  primary: string;      // Main tint color
  secondary: string;    // Secondary tint
  gradient: string[];   // Gradient colors for backgrounds
  glow: string;         // Subtle glow/highlight color
  intensity: number;    // 0-1, how strong the tint effect is
}

// Light theme goal tints
const lightGoalTints: Record<FitnessGoal, GoalTints> = {
  cut: {
    primary: '#e0f2fe',      // Light sky blue - airy, light
    secondary: '#f0f9ff',    // Even lighter blue
    gradient: ['#f0f9ff', '#e0f2fe', '#bae6fd'],
    glow: 'rgba(56, 189, 248, 0.15)',
    intensity: 0.3,
  },
  maintain: {
    primary: '#f3e8ff',      // Light purple - balanced
    secondary: '#faf5ff',    // Very light purple
    gradient: ['#faf5ff', '#f3e8ff', '#e9d5ff'],
    glow: 'rgba(168, 85, 247, 0.12)',
    intensity: 0.25,
  },
  bulk: {
    primary: '#fef3c7',      // Warm amber - grounded, powerful
    secondary: '#fffbeb',    // Light amber
    gradient: ['#fffbeb', '#fef3c7', '#fde68a'],
    glow: 'rgba(245, 158, 11, 0.18)',
    intensity: 0.35,
  },
};

// Dark theme goal tints
const darkGoalTints: Record<FitnessGoal, GoalTints> = {
  cut: {
    primary: '#0c4a6e',      // Deep blue - lean, sharp
    secondary: '#082f49',    // Darker blue
    gradient: ['#000000', '#082f49', '#0c4a6e'],
    glow: 'rgba(56, 189, 248, 0.08)',
    intensity: 0.2,
  },
  maintain: {
    primary: '#3b0764',      // Deep purple - balanced
    secondary: '#1e1b4b',    // Dark indigo
    gradient: ['#000000', '#1e1b4b', '#3b0764'],
    glow: 'rgba(168, 85, 247, 0.08)',
    intensity: 0.15,
  },
  bulk: {
    primary: '#78350f',      // Deep amber - heavy, powerful
    secondary: '#451a03',    // Dark brown
    gradient: ['#000000', '#451a03', '#78350f'],
    glow: 'rgba(245, 158, 11, 0.1)',
    intensity: 0.25,
  },
};

/**
 * Get goal-based color tints for the current theme.
 */
export function getGoalTints(
  goal: FitnessGoal,
  mode: 'light' | 'dark'
): GoalTints {
  if (mode === 'dark') {
    return darkGoalTints[goal];
  }
  return lightGoalTints[goal];
}

/**
 * Get a themed gradient style for backgrounds based on goal.
 * Returns CSS-like gradient string for use with LinearGradient.
 */
export function getGoalGradientColors(
  goal: FitnessGoal,
  mode: 'light' | 'dark'
): string[] {
  const tints = getGoalTints(goal, mode);
  return tints.gradient;
}
