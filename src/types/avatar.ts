/**
 * Avatar Types - Complete avatar system
 *
 * Phase 1: Template-based avatars
 * Phase 2: Camera-based personalization
 * Phase 3: Outfits, animations, achievements
 */

// Body regions for insight tag placement (symbolic, not anatomical)
export type BodyRegion =
  | 'head'      // Sleep, cognitive, rest
  | 'chest'     // Cardio, breathing, heart rate
  | 'stomach'   // Nutrition, meals, digestion-related
  | 'arms'      // Upper body workouts
  | 'legs'      // Lower body workouts, steps, walking
  | 'fullBody'; // General wellness, energy, mood, hydration

// Avatar style options
export type AvatarStyle = 'minimal' | 'geometric' | 'soft';

// Pre-defined body shape categories (deliberately coarse)
export type BodyShape = 'slim' | 'athletic' | 'average' | 'broad' | 'tall' | 'compact';

// Outfit categories
export type OutfitCategory = 'casual' | 'athletic' | 'formal' | 'sleep';

// Outfit definition
export interface AvatarOutfit {
  id: string;
  name: string;
  category: OutfitCategory;
  color: string;
  unlocked: boolean;
  unlockedAt?: string;
  requiredAchievement?: string;
}

// Achievement definition
export interface AvatarAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  unlockedAt?: string;
  progress?: number;
  target?: number;
  category: 'nutrition' | 'fitness' | 'sleep' | 'consistency' | 'milestone';
}

// Animation types for avatar reactions
export type AvatarAnimation =
  | 'idle'
  | 'celebrate'
  | 'wave'
  | 'flex'
  | 'stretch'
  | 'sleep'
  | 'eat'
  | 'run'
  | 'meditate';

// Avatar template definition
export interface AvatarTemplate {
  id: string;
  name: string;
  description: string;
  bodyShape: BodyShape;
  proportions: {
    shoulderWidth: number;
    torsoLength: number;
    hipWidth: number;
    legLength: number;
    armLength: number;
  };
}

// User's saved avatar configuration
export interface UserAvatar {
  templateId: string;
  style: AvatarStyle;
  skinTone: string;
  accentColor: string;
  createdAt: string;
  updatedAt: string;
  // Phase 2: Custom proportions from scan
  customProportions?: {
    shoulderWidth: number;
    torsoLength: number;
    hipWidth: number;
    legLength: number;
    armLength: number;
  };
  scanConfidence?: number;
  // Phase 3: Outfits and customization
  currentOutfitId?: string;
  unlockedOutfits?: string[];
  achievements?: string[];
  animationPreference?: AvatarAnimation;
}

// Insight categories that map to body regions
export type InsightCategory =
  | 'nutrition'
  | 'meals'
  | 'protein'
  | 'calories'
  | 'sleep'
  | 'rest'
  | 'cardio'
  | 'heart_rate'
  | 'upper_body'
  | 'lower_body'
  | 'steps'
  | 'running'
  | 'hydration'
  | 'energy'
  | 'mood'
  | 'wellness';

// Health insight to display on avatar
export interface AvatarInsight {
  id: string;
  text: string;
  shortLabel: string;
  category: InsightCategory;
  sentiment: 'positive' | 'neutral' | 'attention';
  icon: string;
  region: BodyRegion;
}

// Tag position on avatar (relative coordinates 0-1)
export interface TagPosition {
  x: number;
  y: number;
  anchor: 'left' | 'right' | 'center';
}

// Mapping of body regions to display positions
export const REGION_POSITIONS: Record<BodyRegion, TagPosition> = {
  head: { x: 0.65, y: 0.12, anchor: 'left' },
  chest: { x: 0.7, y: 0.32, anchor: 'left' },
  stomach: { x: 0.25, y: 0.42, anchor: 'right' },
  arms: { x: 0.8, y: 0.38, anchor: 'left' },
  legs: { x: 0.25, y: 0.72, anchor: 'right' },
  fullBody: { x: 0.5, y: 0.55, anchor: 'center' },
};

// Category to region mapping (rule-based, not ML)
export const CATEGORY_TO_REGION: Record<InsightCategory, BodyRegion> = {
  nutrition: 'stomach',
  meals: 'stomach',
  protein: 'stomach',
  calories: 'stomach',
  sleep: 'head',
  rest: 'head',
  cardio: 'chest',
  heart_rate: 'chest',
  upper_body: 'arms',
  lower_body: 'legs',
  steps: 'legs',
  running: 'legs',
  hydration: 'fullBody',
  energy: 'fullBody',
  mood: 'fullBody',
  wellness: 'fullBody',
};

// Available skin tone options
export const SKIN_TONES = [
  { id: 'tone1', color: '#FFDFC4', name: 'Light' },
  { id: 'tone2', color: '#F0C8A0', name: 'Fair' },
  { id: 'tone3', color: '#D4A574', name: 'Medium' },
  { id: 'tone4', color: '#B8865C', name: 'Tan' },
  { id: 'tone5', color: '#8D5A3C', name: 'Brown' },
  { id: 'tone6', color: '#5C3A21', name: 'Dark' },
];

// Pre-defined avatar templates
export const AVATAR_TEMPLATES: AvatarTemplate[] = [
  {
    id: 'slim',
    name: 'Slim',
    description: 'Lean build',
    bodyShape: 'slim',
    proportions: {
      shoulderWidth: 0.38,
      torsoLength: 0.38,
      hipWidth: 0.32,
      legLength: 0.52,
      armLength: 0.42,
    },
  },
  {
    id: 'athletic',
    name: 'Athletic',
    description: 'Fit build',
    bodyShape: 'athletic',
    proportions: {
      shoulderWidth: 0.52,
      torsoLength: 0.40,
      hipWidth: 0.38,
      legLength: 0.48,
      armLength: 0.44,
    },
  },
  {
    id: 'average',
    name: 'Average',
    description: 'Balanced build',
    bodyShape: 'average',
    proportions: {
      shoulderWidth: 0.45,
      torsoLength: 0.42,
      hipWidth: 0.42,
      legLength: 0.46,
      armLength: 0.40,
    },
  },
  {
    id: 'broad',
    name: 'Broad',
    description: 'Wide build',
    bodyShape: 'broad',
    proportions: {
      shoulderWidth: 0.58,
      torsoLength: 0.44,
      hipWidth: 0.52,
      legLength: 0.44,
      armLength: 0.38,
    },
  },
  {
    id: 'tall',
    name: 'Tall',
    description: 'Long limbs',
    bodyShape: 'tall',
    proportions: {
      shoulderWidth: 0.42,
      torsoLength: 0.45,
      hipWidth: 0.36,
      legLength: 0.55,
      armLength: 0.48,
    },
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Shorter stature',
    bodyShape: 'compact',
    proportions: {
      shoulderWidth: 0.48,
      torsoLength: 0.38,
      hipWidth: 0.45,
      legLength: 0.42,
      armLength: 0.35,
    },
  },
];

// Pre-defined outfits
export const AVATAR_OUTFITS: AvatarOutfit[] = [
  // Default outfits (always unlocked)
  { id: 'casual_default', name: 'Casual', category: 'casual', color: '#6366F1', unlocked: true },
  { id: 'athletic_default', name: 'Workout', category: 'athletic', color: '#22C55E', unlocked: true },

  // Achievement-locked outfits
  { id: 'athletic_gold', name: 'Champion', category: 'athletic', color: '#F59E0B', unlocked: false, requiredAchievement: 'workout_streak_30' },
  { id: 'casual_zen', name: 'Zen Master', category: 'casual', color: '#8B5CF6', unlocked: false, requiredAchievement: 'meditation_streak_7' },
  { id: 'athletic_runner', name: 'Marathon', category: 'athletic', color: '#EF4444', unlocked: false, requiredAchievement: 'steps_100k' },
  { id: 'sleep_cozy', name: 'Well Rested', category: 'sleep', color: '#3B82F6', unlocked: false, requiredAchievement: 'sleep_streak_14' },
  { id: 'formal_executive', name: 'Executive', category: 'formal', color: '#1F2937', unlocked: false, requiredAchievement: 'consistency_90' },
];

// Pre-defined achievements
export const AVATAR_ACHIEVEMENTS: AvatarAchievement[] = [
  // Consistency achievements
  { id: 'first_log', name: 'First Step', description: 'Log your first meal or workout', icon: 'footsteps', tier: 'bronze', category: 'milestone', target: 1 },
  { id: 'week_streak', name: 'Week Warrior', description: 'Log something 7 days in a row', icon: 'calendar', tier: 'bronze', category: 'consistency', target: 7 },
  { id: 'month_streak', name: 'Monthly Master', description: 'Log something 30 days in a row', icon: 'trophy', tier: 'silver', category: 'consistency', target: 30 },
  { id: 'consistency_90', name: 'Habit Builder', description: 'Log something 90 days in a row', icon: 'ribbon', tier: 'gold', category: 'consistency', target: 90 },

  // Fitness achievements
  { id: 'workout_first', name: 'Getting Started', description: 'Complete your first workout', icon: 'barbell', tier: 'bronze', category: 'fitness', target: 1 },
  { id: 'workout_streak_7', name: 'Workout Week', description: 'Work out 7 days in a row', icon: 'flame', tier: 'bronze', category: 'fitness', target: 7 },
  { id: 'workout_streak_30', name: 'Iron Will', description: 'Work out 30 days in a row', icon: 'medal', tier: 'gold', category: 'fitness', target: 30 },
  { id: 'steps_100k', name: 'Century Walker', description: 'Walk 100,000 steps total', icon: 'walk', tier: 'silver', category: 'fitness', target: 100000 },

  // Nutrition achievements
  { id: 'protein_goal_7', name: 'Protein Power', description: 'Hit protein goal 7 days in a row', icon: 'nutrition', tier: 'bronze', category: 'nutrition', target: 7 },
  { id: 'hydration_streak_7', name: 'Hydration Hero', description: 'Log water 7 days in a row', icon: 'water', tier: 'bronze', category: 'nutrition', target: 7 },
  { id: 'balanced_week', name: 'Balance Master', description: 'Hit all macro goals for a week', icon: 'pie-chart', tier: 'silver', category: 'nutrition', target: 7 },

  // Sleep achievements
  { id: 'sleep_streak_7', name: 'Sleep Consistent', description: 'Log 7+ hours of sleep for 7 days', icon: 'moon', tier: 'bronze', category: 'sleep', target: 7 },
  { id: 'sleep_streak_14', name: 'Dream Achiever', description: 'Log 7+ hours of sleep for 14 days', icon: 'bed', tier: 'silver', category: 'sleep', target: 14 },

  // Milestone achievements
  { id: 'avatar_created', name: 'Self Portrait', description: 'Create your personalized avatar', icon: 'person', tier: 'bronze', category: 'milestone', target: 1 },
  { id: 'avatar_scanned', name: 'Body Mapped', description: 'Use camera scan for your avatar', icon: 'scan', tier: 'silver', category: 'milestone', target: 1 },
];

// Default avatar for new users
export const DEFAULT_AVATAR: UserAvatar = {
  templateId: 'average',
  style: 'soft',
  skinTone: '#D4A574',
  accentColor: '#6366F1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  currentOutfitId: 'casual_default',
  unlockedOutfits: ['casual_default', 'athletic_default'],
  achievements: [],
};

// Animation triggers based on events
export const ANIMATION_TRIGGERS: Record<string, AvatarAnimation> = {
  goal_achieved: 'celebrate',
  workout_complete: 'flex',
  streak_milestone: 'wave',
  good_sleep: 'stretch',
  meal_logged: 'eat',
  meditation_complete: 'meditate',
  steps_goal: 'run',
};

// =============================================================================
// HEALTH STATE INSIGHTS (Phase: Health Intelligence Integration)
// =============================================================================

// Health state types
export type RecoveryState = 'recovered' | 'neutral' | 'under_recovered';
export type LoadState = 'low' | 'moderate' | 'high';
export type EnergyState = 'depleted' | 'low' | 'moderate' | 'high' | 'peak';

// Health state insight definition
export interface HealthStateInsight {
  region: BodyRegion;
  sentiment: 'positive' | 'neutral' | 'attention';
  label: string;
  description: string;
  minConfidence: number; // Don't show below this confidence
}

// Health state insight mappings
export const HEALTH_STATE_INSIGHTS: Record<string, HealthStateInsight> = {
  // Recovery states
  recovery_recovered: {
    region: 'fullBody',
    sentiment: 'positive',
    label: 'Recovered',
    description: 'Your body is well-rested and ready',
    minConfidence: 0.4,
  },
  recovery_neutral: {
    region: 'fullBody',
    sentiment: 'neutral',
    label: 'Neutral',
    description: 'Recovery status is balanced',
    minConfidence: 0.4,
  },
  recovery_under_recovered: {
    region: 'fullBody',
    sentiment: 'attention',
    label: 'Under-recovered',
    description: 'Consider extra rest today',
    minConfidence: 0.4,
  },

  // Load states
  load_low: {
    region: 'arms',
    sentiment: 'positive',
    label: 'Low load',
    description: 'Accumulated strain is low',
    minConfidence: 0.4,
  },
  load_moderate: {
    region: 'arms',
    sentiment: 'neutral',
    label: 'Moderate load',
    description: 'Training load is balanced',
    minConfidence: 0.4,
  },
  load_high: {
    region: 'arms',
    sentiment: 'attention',
    label: 'High load',
    description: 'Consider a lighter day',
    minConfidence: 0.4,
  },

  // Energy states
  energy_peak: {
    region: 'chest',
    sentiment: 'positive',
    label: 'High energy',
    description: 'Energy levels are optimal',
    minConfidence: 0.4,
  },
  energy_high: {
    region: 'chest',
    sentiment: 'positive',
    label: 'Good energy',
    description: 'Energy levels are good',
    minConfidence: 0.4,
  },
  energy_moderate: {
    region: 'chest',
    sentiment: 'neutral',
    label: 'Moderate energy',
    description: 'Energy is balanced',
    minConfidence: 0.4,
  },
  energy_low: {
    region: 'chest',
    sentiment: 'attention',
    label: 'Low energy',
    description: 'Energy may be depleted',
    minConfidence: 0.4,
  },
  energy_depleted: {
    region: 'chest',
    sentiment: 'attention',
    label: 'Depleted',
    description: 'Prioritize rest and recovery',
    minConfidence: 0.4,
  },
};

// Convert health state response to avatar insights
export function healthStateToInsights(
  healthState: {
    recovery?: { state: RecoveryState; confidence: number };
    load?: { state: LoadState; confidence: number };
    energy?: { state: EnergyState; confidence: number };
  },
  confidenceThreshold: number = 0.4
): AvatarInsight[] {
  const insights: AvatarInsight[] = [];

  // Recovery
  if (healthState.recovery && healthState.recovery.confidence >= confidenceThreshold) {
    const key = `recovery_${healthState.recovery.state}`;
    const config = HEALTH_STATE_INSIGHTS[key];
    if (config) {
      insights.push({
        id: key,
        text: config.description,
        shortLabel: config.label,
        category: 'wellness',
        sentiment: config.sentiment,
        icon: config.sentiment === 'positive' ? 'checkmark-circle' : config.sentiment === 'attention' ? 'alert-circle' : 'ellipse',
        region: config.region,
      });
    }
  }

  // Load
  if (healthState.load && healthState.load.confidence >= confidenceThreshold) {
    const key = `load_${healthState.load.state}`;
    const config = HEALTH_STATE_INSIGHTS[key];
    if (config) {
      insights.push({
        id: key,
        text: config.description,
        shortLabel: config.label,
        category: 'upper_body',
        sentiment: config.sentiment,
        icon: config.sentiment === 'positive' ? 'fitness' : config.sentiment === 'attention' ? 'warning' : 'barbell',
        region: config.region,
      });
    }
  }

  // Energy
  if (healthState.energy && healthState.energy.confidence >= confidenceThreshold) {
    const key = `energy_${healthState.energy.state}`;
    const config = HEALTH_STATE_INSIGHTS[key];
    if (config) {
      insights.push({
        id: key,
        text: config.description,
        shortLabel: config.label,
        category: 'energy',
        sentiment: config.sentiment,
        icon: config.sentiment === 'positive' ? 'flash' : config.sentiment === 'attention' ? 'battery-dead' : 'battery-half',
        region: config.region,
      });
    }
  }

  return insights;
}
