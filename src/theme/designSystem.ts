/**
 * Delta Design System
 *
 * A comprehensive design system inspired by Whoop/Oura aesthetics.
 * Focuses on clean typography, consistent spacing, and smooth animations.
 *
 * Usage:
 * - Import tokens directly: import { spacing, typography } from './designSystem'
 * - Use design presets for consistent component styling
 */

// =============================================================================
// SPACING TOKENS
// =============================================================================

/**
 * Spacing scale based on 4px grid
 * Use these instead of arbitrary numbers for consistent layouts
 */
export const spacing = {
  /** 2px - Hairline spacing */
  xxs: 2,
  /** 4px - Tight spacing */
  xs: 4,
  /** 8px - Compact spacing */
  sm: 8,
  /** 12px - Default small gap */
  md: 12,
  /** 16px - Standard padding */
  lg: 16,
  /** 20px - Section spacing */
  xl: 20,
  /** 24px - Large section spacing */
  xxl: 24,
  /** 32px - Major section breaks */
  xxxl: 32,
  /** 48px - Page-level spacing */
  huge: 48,
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

/**
 * Font families - defaults to system fonts but can be extended
 * with custom fonts like Inter, Manrope, SF Pro Display
 */
export const fontFamily = {
  /** System default - reliable fallback */
  system: undefined, // Uses system font
  /** For headers - bolder weights */
  display: undefined,
  /** For body text - optimized for readability */
  body: undefined,
  /** For numbers/data - tabular figures */
  mono: 'monospace',
} as const;

/**
 * Font weights - mapped to common names
 * Note: React Native uses string weights
 */
export const fontWeight = {
  thin: '100' as const,
  extraLight: '200' as const,
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extraBold: '800' as const,
  black: '900' as const,
};

/**
 * Font sizes with line heights
 * Based on type scale (1.2 ratio)
 */
export const fontSize = {
  /** 10px - Tiny labels, badges */
  xs: { size: 10, lineHeight: 14 },
  /** 12px - Small labels, captions */
  sm: { size: 12, lineHeight: 16 },
  /** 14px - Body text small */
  base: { size: 14, lineHeight: 20 },
  /** 16px - Body text default */
  md: { size: 16, lineHeight: 24 },
  /** 18px - Emphasis text */
  lg: { size: 18, lineHeight: 26 },
  /** 20px - Small headers */
  xl: { size: 20, lineHeight: 28 },
  /** 24px - Section headers */
  xxl: { size: 24, lineHeight: 32 },
  /** 28px - Page titles */
  xxxl: { size: 28, lineHeight: 36 },
  /** 32px - Hero text */
  hero: { size: 32, lineHeight: 40 },
  /** 48px - Display text */
  display: { size: 48, lineHeight: 56 },
} as const;

/**
 * Typography presets for common use cases
 */
export const typography = {
  // Headers
  displayLarge: {
    fontSize: fontSize.display.size,
    lineHeight: fontSize.display.lineHeight,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  },
  displayMedium: {
    fontSize: fontSize.hero.size,
    lineHeight: fontSize.hero.lineHeight,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  headline: {
    fontSize: fontSize.xxxl.size,
    lineHeight: fontSize.xxxl.lineHeight,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  title: {
    fontSize: fontSize.xl.size,
    lineHeight: fontSize.xl.lineHeight,
    fontWeight: fontWeight.semibold,
  },
  subtitle: {
    fontSize: fontSize.lg.size,
    lineHeight: fontSize.lg.lineHeight,
    fontWeight: fontWeight.semibold,
  },

  // Body
  bodyLarge: {
    fontSize: fontSize.md.size,
    lineHeight: fontSize.md.lineHeight,
    fontWeight: fontWeight.regular,
  },
  bodyMedium: {
    fontSize: fontSize.base.size,
    lineHeight: fontSize.base.lineHeight,
    fontWeight: fontWeight.regular,
  },
  bodySmall: {
    fontSize: fontSize.sm.size,
    lineHeight: fontSize.sm.lineHeight,
    fontWeight: fontWeight.regular,
  },

  // Labels
  labelLarge: {
    fontSize: fontSize.base.size,
    lineHeight: fontSize.base.lineHeight,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontSize: fontSize.sm.size,
    lineHeight: fontSize.sm.lineHeight,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.2,
  },
  labelSmall: {
    fontSize: fontSize.xs.size,
    lineHeight: fontSize.xs.lineHeight,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.3,
  },

  // Special
  metric: {
    fontSize: fontSize.xxl.size,
    lineHeight: fontSize.xxl.lineHeight,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  metricLarge: {
    fontSize: fontSize.hero.size,
    lineHeight: fontSize.hero.lineHeight,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  },
  caption: {
    fontSize: fontSize.xs.size,
    lineHeight: fontSize.xs.lineHeight,
    fontWeight: fontWeight.regular,
    letterSpacing: 0.2,
  },
  overline: {
    fontSize: fontSize.xs.size,
    lineHeight: fontSize.xs.lineHeight,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
} as const;

// =============================================================================
// BORDER RADIUS
// =============================================================================

export const borderRadius = {
  /** 4px - Subtle rounding */
  xs: 4,
  /** 8px - Default cards */
  sm: 8,
  /** 12px - Prominent cards */
  md: 12,
  /** 16px - Large cards, buttons */
  lg: 16,
  /** 20px - Extra rounded */
  xl: 20,
  /** 24px - Pills, chips */
  xxl: 24,
  /** 9999px - Full round (circles) */
  full: 9999,
} as const;

// =============================================================================
// SHADOWS & ELEVATION
// =============================================================================

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// =============================================================================
// ANIMATIONS
// =============================================================================

/**
 * Animation durations in milliseconds
 */
export const duration = {
  instant: 100,
  fast: 150,
  normal: 250,
  slow: 400,
  slower: 600,
  slowest: 1000,
} as const;

/**
 * Spring animation configs for react-native-reanimated
 */
export const springs = {
  /** Quick, snappy - for micro interactions */
  snappy: {
    damping: 20,
    stiffness: 300,
    mass: 0.5,
  },
  /** Default - balanced feel */
  default: {
    damping: 15,
    stiffness: 150,
    mass: 0.5,
  },
  /** Gentle - for larger movements */
  gentle: {
    damping: 20,
    stiffness: 100,
    mass: 0.8,
  },
  /** Bouncy - for celebratory animations */
  bouncy: {
    damping: 10,
    stiffness: 200,
    mass: 0.5,
  },
  /** Smooth - for slow reveals */
  smooth: {
    damping: 25,
    stiffness: 80,
    mass: 1,
  },
} as const;

/**
 * Common animation presets
 */
export const animations = {
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
    duration: duration.normal,
  },
  fadeOut: {
    from: { opacity: 1 },
    to: { opacity: 0 },
    duration: duration.fast,
  },
  slideUp: {
    from: { opacity: 0, translateY: 20 },
    to: { opacity: 1, translateY: 0 },
    spring: springs.default,
  },
  slideDown: {
    from: { opacity: 0, translateY: -20 },
    to: { opacity: 1, translateY: 0 },
    spring: springs.default,
  },
  scaleIn: {
    from: { opacity: 0, scale: 0.9 },
    to: { opacity: 1, scale: 1 },
    spring: springs.snappy,
  },
  press: {
    from: { scale: 1 },
    to: { scale: 0.97 },
    duration: duration.instant,
  },
} as const;

// =============================================================================
// COMPONENT PRESETS
// =============================================================================

/**
 * Card style presets
 */
export const cardPresets = {
  /** Default card styling */
  default: {
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadows.sm,
  },
  /** Elevated card with more shadow */
  elevated: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  /** Flat card with border */
  outlined: {
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    ...shadows.none,
  },
  /** Compact card for dense UIs */
  compact: {
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    ...shadows.sm,
  },
} as const;

/**
 * Button style presets (sizes)
 */
export const buttonPresets = {
  large: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.lg,
    ...typography.labelLarge,
  },
  medium: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    ...typography.labelMedium,
  },
  small: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
    ...typography.labelSmall,
  },
} as const;

/**
 * Input field presets
 */
export const inputPresets = {
  default: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    ...typography.bodyMedium,
  },
  compact: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    ...typography.bodySmall,
  },
} as const;

// =============================================================================
// LAYOUT PRESETS
// =============================================================================

export const layout = {
  /** Standard screen padding */
  screenPadding: spacing.lg,
  /** Standard section gap */
  sectionGap: spacing.xxl,
  /** Standard item gap in lists */
  itemGap: spacing.md,
  /** Header height */
  headerHeight: 56,
  /** Tab bar height */
  tabBarHeight: 84,
  /** Bottom sheet handle area */
  sheetHandleHeight: 24,
} as const;

// =============================================================================
// USER PREFERENCES (stored in AsyncStorage)
// =============================================================================

export type FontPreference = 'system' | 'inter' | 'manrope' | 'sf-pro';
export type FontWeightPreference = 'normal' | 'light' | 'thin';
export type AnimationSpeed = 'normal' | 'fast' | 'reduced';

export interface DesignPreferences {
  fontFamily: FontPreference;
  fontWeight: FontWeightPreference;
  animationSpeed: AnimationSpeed;
  reduceMotion: boolean;
}

export const DEFAULT_DESIGN_PREFERENCES: DesignPreferences = {
  fontFamily: 'system',
  fontWeight: 'normal',
  animationSpeed: 'normal',
  reduceMotion: false,
};

// Storage key for preferences
export const DESIGN_PREFERENCES_KEY = '@delta:designPreferences';
