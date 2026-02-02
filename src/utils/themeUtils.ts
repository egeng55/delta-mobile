/**
 * Shared theme utilities — extracted from duplicate implementations.
 */

import { Theme } from '../theme/colors';
import { VizTheme } from '../components/viz/types';

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
