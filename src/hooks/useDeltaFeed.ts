/**
 * useDeltaFeed - Transforms Delta data into unified feed items.
 *
 * This hook consumes data from useInsightsData and transforms it
 * into FeedItem objects for display in the Delta Feed UI.
 *
 * Priorities:
 * 1. High-confidence patterns (>70%)
 * 2. Caution/rest tone insights
 * 3. Data oversight alerts
 * 4. Regular insights and patterns
 * 5. Milestones and achievements
 */

import { useMemo, useCallback } from 'react';
import {
  FeedItem,
  FeedItemTone,
  transformInsightToFeedItem,
  transformPatternToFeedItem,
} from '../components/Feed/types';
import {
  DeltaInsightsResponse,
  ExplainedPattern,
  ExplainedFactor,
  CausalChain,
} from '../services/api';

export interface UseDeltaFeedOptions {
  maxItems?: number;
  includePatterns?: boolean;
  includeFactors?: boolean;
  includeMilestones?: boolean;
}

export interface UseDeltaFeedResult {
  feedItems: FeedItem[];
  commentary: {
    headline: string;
    body: string;
    tone: FeedItemTone;
  } | null;
  readinessScore: number | null;
  hasData: boolean;
}

const DEFAULT_OPTIONS: UseDeltaFeedOptions = {
  maxItems: 20,
  includePatterns: true,
  includeFactors: true,
  includeMilestones: true,
};

export function useDeltaFeed(
  deltaInsights: DeltaInsightsResponse | null,
  causalChains: CausalChain[] = [],
  options: UseDeltaFeedOptions = {}
): UseDeltaFeedResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Transform patterns to feed items
  const patternItems = useMemo((): FeedItem[] => {
    if (!opts.includePatterns || !deltaInsights?.patterns) {
      return [];
    }

    return deltaInsights.patterns
      .filter((p) => p.confidence >= 0.4) // Filter low-confidence patterns
      .map((pattern) => transformPatternToFeedItem(pattern))
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  }, [deltaInsights?.patterns, opts.includePatterns]);

  // Transform factors to feed items
  const factorItems = useMemo((): FeedItem[] => {
    if (!opts.includeFactors || !deltaInsights?.factors) {
      return [];
    }

    return deltaInsights.factors
      .filter((f) => f.impact !== 'neutral') // Only show impactful factors
      .map((factor) => transformFactorToFeedItem(factor));
  }, [deltaInsights?.factors, opts.includeFactors]);

  // Create commentary feed item
  const commentaryItem = useMemo((): FeedItem | null => {
    if (!deltaInsights?.commentary?.headline) {
      return null;
    }

    return transformInsightToFeedItem(
      {
        headline: deltaInsights.commentary.headline,
        body: deltaInsights.commentary.body,
        tone: deltaInsights.commentary.tone,
      },
      deltaInsights.readiness?.score
    );
  }, [deltaInsights?.commentary, deltaInsights?.readiness?.score]);

  // Create cycle context item if available
  const cycleItem = useMemo((): FeedItem | null => {
    if (!deltaInsights?.cycle_context) {
      return null;
    }

    const { phase, day_in_cycle } = deltaInsights.cycle_context;
    return {
      id: 'cycle-insight',
      type: 'insight',
      priority: 'medium',
      tone: 'neutral',
      timestamp: new Date().toISOString(),
      headline: `Day ${day_in_cycle} of your cycle`,
      body: `Currently in ${formatPhase(phase)} phase`,
      icon: 'flower-outline',
      color: 'sleep',
    };
  }, [deltaInsights?.cycle_context]);

  // Combine and sort all items
  const feedItems = useMemo((): FeedItem[] => {
    const allItems: FeedItem[] = [];

    // Add commentary first (it's the main insight)
    if (commentaryItem) {
      allItems.push(commentaryItem);
    }

    // Add cycle context
    if (cycleItem) {
      allItems.push(cycleItem);
    }

    // Add patterns
    allItems.push(...patternItems);

    // Add factors
    allItems.push(...factorItems);

    // Sort by priority and confidence
    const sorted = allItems.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Secondary sort by confidence
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    });

    // Limit items
    return sorted.slice(0, opts.maxItems);
  }, [commentaryItem, cycleItem, patternItems, factorItems, opts.maxItems]);

  // Extract commentary for separate display
  const commentary = useMemo(() => {
    if (!deltaInsights?.commentary?.headline) {
      return null;
    }
    return {
      headline: deltaInsights.commentary.headline,
      body: deltaInsights.commentary.body,
      tone: deltaInsights.commentary.tone as FeedItemTone,
    };
  }, [deltaInsights?.commentary]);

  return {
    feedItems,
    commentary,
    readinessScore: deltaInsights?.readiness?.score ?? null,
    hasData: deltaInsights?.has_data ?? false,
  };
}

// Helper function to transform factors to feed items
function transformFactorToFeedItem(factor: ExplainedFactor): FeedItem {
  const tone: FeedItemTone = factor.impact === 'positive' ? 'positive' : 'caution';
  const icon = getFactorIcon(factor.key);
  const color = factor.impact === 'positive' ? 'success' : 'warning';

  return {
    id: `factor-${factor.key}`,
    type: 'insight',
    priority: factor.impact === 'negative' ? 'high' : 'medium',
    tone,
    timestamp: new Date().toISOString(),
    headline: `${factor.name}: ${formatState(factor.state)}`,
    body: factor.explanation,
    icon,
    color,
    reasoning: factor.suggestion
      ? [
          {
            type: 'observation',
            content: factor.explanation,
            dataPoint: factor.current_value !== undefined
              ? `Current: ${factor.current_value}${factor.baseline ? `, Baseline: ${factor.baseline}` : ''}`
              : undefined,
          },
          {
            type: 'conclusion',
            content: factor.suggestion,
          },
        ]
      : undefined,
    actions: factor.suggestion
      ? [
          {
            id: 'apply-suggestion',
            label: 'Learn More',
            type: 'secondary',
          },
        ]
      : undefined,
  };
}

function getFactorIcon(key: string): string {
  const icons: Record<string, string> = {
    sleep_hours: 'bed-outline',
    sleep_quality: 'moon-outline',
    energy_level: 'flash-outline',
    stress_level: 'pulse-outline',
    soreness_level: 'fitness-outline',
    alcohol_drinks: 'wine-outline',
    had_workout: 'barbell-outline',
    sleep_debt: 'time-outline',
    hydration: 'water-outline',
    nutrition: 'nutrition-outline',
    recovery: 'heart-outline',
  };
  return icons[key] || 'analytics-outline';
}

function formatState(state: string): string {
  return state
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPhase(phase: string): string {
  const phases: Record<string, string> = {
    menstrual: 'menstrual',
    follicular: 'follicular',
    ovulation: 'ovulation',
    luteal: 'luteal',
  };
  return phases[phase] || phase;
}

export default useDeltaFeed;
