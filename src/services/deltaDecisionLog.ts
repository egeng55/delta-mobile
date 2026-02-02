/**
 * Delta Decision Log — Dev-only logging of Delta's runtime decisions.
 *
 * Every API response from Delta's intelligence pipeline gets logged
 * to console and to a JSONL file for inspection during the concurrent
 * development loop.
 */

import * as FileSystem from 'expo-file-system/legacy';

export interface DeltaDecision {
  timestamp: string;
  source: 'commentary' | 'generateInsight' | 'causalChains' | 'insights' | 'chart-insight';
  decision: string;
  reasoning: string;
  uiContext?: Record<string, unknown>;
  raw?: unknown;
}

const LOG_PATH = `${FileSystem.documentDirectory}delta-decisions.jsonl`;

// Serialize writes to avoid races
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(line: string): void {
  writeQueue = writeQueue.then(async () => {
    try {
      const info = await FileSystem.getInfoAsync(LOG_PATH);
      if (info.exists) {
        const existing = await FileSystem.readAsStringAsync(LOG_PATH);
        await FileSystem.writeAsStringAsync(LOG_PATH, existing + line);
      } else {
        await FileSystem.writeAsStringAsync(LOG_PATH, line);
      }
    } catch {
      try {
        await FileSystem.writeAsStringAsync(LOG_PATH, line);
      } catch {
        // Give up silently in dev
      }
    }
  });
}

export function logDeltaDecision(decision: DeltaDecision): void {
  if (!__DEV__) return;

  const tag = `[DELTA] ${decision.source}`;
  console.log(`${tag}: "${decision.decision}" (${decision.reasoning})`);

  enqueueWrite(JSON.stringify(decision) + '\n');
}

export function logModulePriority(modules: Array<{ id: string; priority: number }>): void {
  if (!__DEV__) return;
  const summary = modules.map(m => `${m.id}=${m.priority}`).join(', ');
  console.log(`[DELTA] module-priority: ${summary}`);
}

export function logUIContext(context: Record<string, unknown>): void {
  if (!__DEV__) return;
  const keys = Object.entries(context).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
  console.log(`[DELTA] ui-context: ${keys}`);
}

export function logMismatch(message: string): void {
  if (!__DEV__) return;
  console.warn(`[DELTA-MISMATCH] ${message}`);
}

export function logError(moduleId: string, error: string): void {
  if (!__DEV__) return;
  console.error(`[DELTA-ERROR] Module "${moduleId}" threw: ${error}`);
}

/**
 * Accumulated decisions for the current session, used by deltaValidator
 * to compare intent vs rendered state.
 */
const sessionDecisions: DeltaDecision[] = [];

export function recordDecision(decision: DeltaDecision): void {
  if (!__DEV__) return;
  logDeltaDecision(decision);
  sessionDecisions.push(decision);
  if (sessionDecisions.length > 500) {
    sessionDecisions.splice(0, sessionDecisions.length - 500);
  }
}

export function getSessionDecisions(): DeltaDecision[] {
  return sessionDecisions;
}

export function clearSessionDecisions(): void {
  sessionDecisions.length = 0;
}
