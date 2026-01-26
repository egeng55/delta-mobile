/**
 * useDesignSystem - Hook for accessing design system with user preferences
 *
 * Provides design tokens that respect user preferences for:
 * - Font family (system, Inter, Manrope, SF Pro)
 * - Font weight preference (normal, light, thin)
 * - Animation speed (normal, fast, reduced)
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  spacing,
  typography,
  fontWeight,
  fontSize,
  borderRadius,
  shadows,
  duration,
  springs,
  animations,
  cardPresets,
  buttonPresets,
  inputPresets,
  layout,
  DesignPreferences,
  DEFAULT_DESIGN_PREFERENCES,
  DESIGN_PREFERENCES_KEY,
  FontPreference,
  FontWeightPreference,
  AnimationSpeed,
} from './designSystem';

// Adjusted font weights based on preference
const WEIGHT_ADJUSTMENTS: Record<FontWeightPreference, Record<string, string>> = {
  normal: {
    thin: '100',
    extraLight: '200',
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extraBold: '800',
    black: '900',
  },
  light: {
    thin: '100',
    extraLight: '100',
    light: '200',
    regular: '300',
    medium: '400',
    semibold: '500',
    bold: '600',
    extraBold: '700',
    black: '800',
  },
  thin: {
    thin: '100',
    extraLight: '100',
    light: '100',
    regular: '200',
    medium: '300',
    semibold: '400',
    bold: '500',
    extraBold: '600',
    black: '700',
  },
};

// Animation duration multipliers
const ANIMATION_MULTIPLIERS: Record<AnimationSpeed, number> = {
  normal: 1,
  fast: 0.6,
  reduced: 2,
};

export interface UseDesignSystemReturn {
  // Core tokens
  spacing: typeof spacing;
  fontSize: typeof fontSize;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  layout: typeof layout;

  // Adjusted for preferences
  fontWeight: typeof fontWeight;
  typography: typeof typography;
  duration: typeof duration;
  springs: typeof springs;
  animations: typeof animations;

  // Presets
  cardPresets: typeof cardPresets;
  buttonPresets: typeof buttonPresets;
  inputPresets: typeof inputPresets;

  // Preferences
  preferences: DesignPreferences;
  updatePreference: <K extends keyof DesignPreferences>(
    key: K,
    value: DesignPreferences[K]
  ) => Promise<void>;
  isLoading: boolean;
}

export function useDesignSystem(): UseDesignSystemReturn {
  const [preferences, setPreferences] = useState<DesignPreferences>(DEFAULT_DESIGN_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const saved = await AsyncStorage.getItem(DESIGN_PREFERENCES_KEY);
        if (saved) {
          setPreferences({ ...DEFAULT_DESIGN_PREFERENCES, ...JSON.parse(saved) });
        }
      } catch {
        // Use defaults
      } finally {
        setIsLoading(false);
      }
    };
    loadPreferences();
  }, []);

  // Update a single preference
  const updatePreference = useCallback(async <K extends keyof DesignPreferences>(
    key: K,
    value: DesignPreferences[K]
  ) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    try {
      await AsyncStorage.setItem(DESIGN_PREFERENCES_KEY, JSON.stringify(updated));
    } catch {
      // Revert on error
      setPreferences(preferences);
    }
  }, [preferences]);

  // Get adjusted font weights
  const adjustedFontWeight = WEIGHT_ADJUSTMENTS[preferences.fontWeight];

  // Get adjusted durations
  const multiplier = ANIMATION_MULTIPLIERS[preferences.animationSpeed];
  const adjustedDuration = {
    instant: Math.round(duration.instant * multiplier),
    fast: Math.round(duration.fast * multiplier),
    normal: Math.round(duration.normal * multiplier),
    slow: Math.round(duration.slow * multiplier),
    slower: Math.round(duration.slower * multiplier),
    slowest: Math.round(duration.slowest * multiplier),
  };

  // Get adjusted springs (reduce stiffness for reduced motion)
  const springMultiplier = preferences.reduceMotion ? 0.5 : 1;
  const adjustedSprings = {
    snappy: { ...springs.snappy, stiffness: springs.snappy.stiffness * springMultiplier },
    default: { ...springs.default, stiffness: springs.default.stiffness * springMultiplier },
    gentle: { ...springs.gentle, stiffness: springs.gentle.stiffness * springMultiplier },
    bouncy: { ...springs.bouncy, stiffness: springs.bouncy.stiffness * springMultiplier },
    smooth: { ...springs.smooth, stiffness: springs.smooth.stiffness * springMultiplier },
  };

  return {
    // Static tokens (don't change with preferences)
    spacing,
    fontSize,
    borderRadius,
    shadows,
    layout,
    cardPresets,
    buttonPresets,
    inputPresets,

    // Adjusted tokens
    fontWeight: adjustedFontWeight as typeof fontWeight,
    typography, // Would need deeper adjustment for font family
    duration: adjustedDuration as typeof duration,
    springs: adjustedSprings as typeof springs,
    animations,

    // Preferences management
    preferences,
    updatePreference,
    isLoading,
  };
}

// Simple access without hook (for non-component code)
export { spacing, typography, fontWeight, fontSize, borderRadius, shadows, duration, springs, layout };
