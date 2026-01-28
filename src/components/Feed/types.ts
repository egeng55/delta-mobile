/**
 * Feed Types - Data structures for Delta's unified feed.
 *
 * The feed combines insights, patterns, recommendations, and alerts
 * into a single, chronological stream that showcases Delta's reasoning.
 */

export type FeedItemType =
  | 'insight'        // Delta's observations about your data
  | 'pattern'        // Detected cause-effect relationships
  | 'recommendation' // Actionable advice
  | 'alert'          // Important notifications (anomalies, corrections)
  | 'data_update'    // Updates about data changes from oversight
  | 'milestone';     // Achievement or progress marker

export type FeedItemPriority = 'high' | 'medium' | 'low';

export type FeedItemTone =
  | 'positive'   // Good news, achievements
  | 'neutral'    // Informational
  | 'caution'    // Needs attention
  | 'rest';      // Recovery-focused

// Base feed item structure
export interface FeedItem {
  id: string;
  type: FeedItemType;
  priority: FeedItemPriority;
  tone: FeedItemTone;
  timestamp: string;

  // Content
  headline: string;
  body?: string;

  // Optional reasoning chain (Delta's thought process)
  reasoning?: ReasoningStep[];

  // Confidence in the insight (0-1)
  confidence?: number;

  // Data source attribution
  sources?: string[];

  // Actions the user can take
  actions?: FeedItemAction[];

  // For patterns: cause-effect relationship
  pattern?: {
    cause: string;
    effect: string;
    lagDays: number;
    occurrences: number;
  };

  // For data updates: what changed
  dataChange?: {
    actionType: 'merged' | 'corrected' | 'deleted' | 'created';
    affectedCount: number;
    canUndo: boolean;
    auditId?: string;
  };

  // Visual customization
  icon?: string;
  color?: 'success' | 'warning' | 'error' | 'accent' | 'recovery' | 'strain' | 'sleep';
}

// A step in Delta's reasoning process
export interface ReasoningStep {
  type: 'observation' | 'analysis' | 'inference' | 'conclusion';
  content: string;
  dataPoint?: string;
  confidence?: number;
}

// Action button for feed items
export interface FeedItemAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'destructive';
  onPress?: () => void;
}

// Transforms API responses to feed items
export function transformInsightToFeedItem(
  insight: {
    headline: string;
    body: string;
    tone: 'positive' | 'neutral' | 'caution' | 'rest';
  },
  readinessScore?: number | null
): FeedItem {
  return {
    id: `insight-${Date.now()}`,
    type: 'insight',
    priority: insight.tone === 'caution' || insight.tone === 'rest' ? 'high' : 'medium',
    tone: insight.tone,
    timestamp: new Date().toISOString(),
    headline: insight.headline,
    body: insight.body,
    confidence: readinessScore ? readinessScore / 100 : undefined,
    icon: getToneIcon(insight.tone),
    color: getToneColor(insight.tone),
  };
}

export function transformPatternToFeedItem(pattern: {
  cause: string;
  effect: string;
  times_observed: number;
  total_occurrences: number;
  confidence: number;
  lag_days: number;
  narrative: string;
  why: string;
  advice: string;
}): FeedItem {
  return {
    id: `pattern-${pattern.cause}-${pattern.effect}-${Date.now()}`,
    type: 'pattern',
    priority: pattern.confidence >= 0.7 ? 'high' : 'medium',
    tone: 'neutral',
    timestamp: new Date().toISOString(),
    headline: pattern.narrative,
    body: pattern.why,
    confidence: pattern.confidence,
    pattern: {
      cause: pattern.cause,
      effect: pattern.effect,
      lagDays: pattern.lag_days,
      occurrences: pattern.times_observed,
    },
    reasoning: [
      {
        type: 'observation',
        content: `Observed ${pattern.times_observed} out of ${pattern.total_occurrences} times`,
        confidence: pattern.confidence,
      },
      {
        type: 'inference',
        content: pattern.why,
      },
      {
        type: 'conclusion',
        content: pattern.advice,
      },
    ],
    actions: pattern.advice
      ? [
          {
            id: 'learn-more',
            label: 'Learn More',
            type: 'secondary',
          },
        ]
      : undefined,
    icon: 'git-branch-outline',
    color: pattern.confidence >= 0.7 ? 'success' : 'warning',
  };
}

export function transformDataUpdateToFeedItem(update: {
  actionType: 'merged' | 'corrected' | 'deleted' | 'created';
  affectedCount: number;
  reason: string;
  explanation?: string;
  auditId?: string;
  canUndo?: boolean;
}): FeedItem {
  const headlines: Record<string, string> = {
    merged: `Merged ${update.affectedCount} duplicate entries`,
    corrected: `Corrected ${update.affectedCount} data point${update.affectedCount > 1 ? 's' : ''}`,
    deleted: `Removed ${update.affectedCount} invalid entries`,
    created: `Logged ${update.affectedCount} new entries`,
  };

  return {
    id: `data-update-${update.auditId || Date.now()}`,
    type: 'data_update',
    priority: 'low',
    tone: 'neutral',
    timestamp: new Date().toISOString(),
    headline: headlines[update.actionType] || 'Updated your data',
    body: update.explanation || update.reason,
    dataChange: {
      actionType: update.actionType,
      affectedCount: update.affectedCount,
      canUndo: update.canUndo ?? true,
      auditId: update.auditId,
    },
    actions: update.canUndo
      ? [
          {
            id: 'undo',
            label: 'Undo',
            type: 'secondary',
          },
        ]
      : undefined,
    icon: getDataUpdateIcon(update.actionType),
    color: 'accent',
  };
}

function getToneIcon(tone: FeedItemTone): string {
  switch (tone) {
    case 'positive':
      return 'sunny-outline';
    case 'caution':
      return 'warning-outline';
    case 'rest':
      return 'bed-outline';
    default:
      return 'information-circle-outline';
  }
}

function getToneColor(
  tone: FeedItemTone
): 'success' | 'warning' | 'error' | 'accent' | 'recovery' | 'strain' | 'sleep' {
  switch (tone) {
    case 'positive':
      return 'success';
    case 'caution':
      return 'warning';
    case 'rest':
      return 'sleep';
    default:
      return 'accent';
  }
}

function getDataUpdateIcon(actionType: string): string {
  switch (actionType) {
    case 'merged':
      return 'git-merge-outline';
    case 'corrected':
      return 'pencil-outline';
    case 'deleted':
      return 'trash-outline';
    case 'created':
      return 'add-circle-outline';
    default:
      return 'sync-outline';
  }
}
