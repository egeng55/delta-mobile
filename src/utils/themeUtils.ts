/**
 * Shared theme utilities — extracted from duplicate implementations.
 */

import { Theme } from '../theme/colors';
import { VizTheme } from '../components/viz/types';

/**
 * Format a date string for chart labels.
 * Converts "2024-01-15" to "1/15" (slashes, no leading zeros).
 */
export function formatDateLabel(dateStr: string): string {
  // Handle ISO date strings (YYYY-MM-DD)
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    return `${month}/${day}`;
  }
  // Handle MM-DD format
  if (parts.length === 2) {
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    return `${month}/${day}`;
  }
  // Fallback: return as-is but replace dashes with slashes
  return dateStr.replace(/-/g, '/');
}

export function getToneColor(tone: string, theme: Theme): string {
  switch (tone) {
    case 'positive': return theme.success;
    case 'caution': return theme.warning;
    case 'rest': return theme.sleep;
    default: return theme.accent;
  }
}

export function themeToVizTheme(theme: Theme): VizTheme {
  return {
    background: theme.background,
    surface: theme.surface,
    textPrimary: theme.textPrimary,
    textSecondary: theme.textSecondary,
    accent: theme.accent,
    border: theme.border,
    warning: theme.warning,
    success: theme.success,
    error: theme.error,
    sleep: theme.sleep,
    heart: theme.heart,
  };
}
