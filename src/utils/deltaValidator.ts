/**
 * Delta Validator — Dev-only mismatch detection between
 * Delta's decisions and actual rendered UI state.
 */

import { DeltaDecision, logMismatch } from '../services/deltaDecisionLog';

export interface ValidationResult {
  valid: boolean;
  mismatches: string[];
}

export function validateDeltaIntent(
  decisions: DeltaDecision[],
  renderedModules: string[],
  renderedCharts: string[],
): ValidationResult {
  if (!__DEV__) return { valid: true, mismatches: [] };

  const mismatches: string[] = [];

  // Check commentary
  const commentaryDecision = decisions.find(d => d.source === 'commentary');
  if (commentaryDecision && !renderedModules.includes('commentary')) {
    const msg = `Commentary generated "${commentaryDecision.decision}" but module not rendered`;
    mismatches.push(msg);
    logMismatch(msg);
  }

  // Check causal chains
  const chainDecisions = decisions.filter(d => d.source === 'causalChains');
  if (chainDecisions.length > 0 && !renderedModules.includes('pattern')) {
    const msg = `${chainDecisions.length} causal chain(s) returned but no pattern module rendered`;
    mismatches.push(msg);
    logMismatch(msg);
  }

  // Check chart insights
  const chartInsights = decisions.filter(d => d.source === 'chart-insight');
  for (const ci of chartInsights) {
    const chartId = (ci.raw as Record<string, string>)?.id;
    if (chartId && !renderedCharts.includes(chartId)) {
      const msg = `Chart insight for "${chartId}" but chart not rendered`;
      mismatches.push(msg);
      logMismatch(msg);
    }
  }

  return { valid: mismatches.length === 0, mismatches };
}
