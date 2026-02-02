/**
 * DeltaUIContext — Omniscient UI awareness for Delta.
 *
 * Tracks visible state, user interactions, and learned preferences.
 * Every screen/component registers its state; Delta uses this to
 * deduplicate content, adapt priority, and send context to backend.
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

export interface DeltaUIPreferences {
  neverTapsMealPrompts: boolean;
  prefersDetailedInsights: boolean;
  activeTimeWindows: string[];
  dismissedModuleTypes: string[];
}

export interface DeltaUIState {
  activeTab: 'Today' | 'Dashboard' | 'You';
  chatSheetState: 'hidden' | 'peek' | 'full';
  visibleModules: string[];
  visibleCharts: string[];

  shownGreetings: string[];
  shownCommentary: string[];
  lastGreetingAt: string | null;
  sessionStartedAt: string;

  tappedModules: string[];
  dismissedModules: string[];
  ignoredModules: string[];
  chatOpenedFrom: string | null;

  preferences: DeltaUIPreferences;

  renderErrors: Array<{ moduleId: string; error: string; timestamp: string }>;
}

interface DeltaUIContextValue extends DeltaUIState {
  setActiveTab: (tab: DeltaUIState['activeTab']) => void;
  setChatSheetState: (state: DeltaUIState['chatSheetState']) => void;
  registerVisibleModules: (ids: string[]) => void;
  registerVisibleCharts: (ids: string[]) => void;
  recordShownGreeting: (text: string) => void;
  recordModuleTap: (moduleId: string) => void;
  recordModuleDismiss: (moduleId: string) => void;
  recordModuleIgnored: (moduleId: string) => void;
  recordChatOpenedFrom: (source: string | null) => void;
  recordRenderError: (moduleId: string, error: string) => void;
  clearRenderError: (moduleId: string) => void;
}

const defaultPreferences: DeltaUIPreferences = {
  neverTapsMealPrompts: false,
  prefersDetailedInsights: false,
  activeTimeWindows: [],
  dismissedModuleTypes: [],
};

const defaultState: DeltaUIState = {
  activeTab: 'Today',
  chatSheetState: 'hidden',
  visibleModules: [],
  visibleCharts: [],
  shownGreetings: [],
  shownCommentary: [],
  lastGreetingAt: null,
  sessionStartedAt: new Date().toISOString(),
  tappedModules: [],
  dismissedModules: [],
  ignoredModules: [],
  chatOpenedFrom: null,
  preferences: defaultPreferences,
  renderErrors: [],
};

const DeltaUICtx = createContext<DeltaUIContextValue | null>(null);

const PREFS_KEY_PREFIX = 'delta-ui-prefs-';

const MAX_INTERACTION_LOG = 500;

export function DeltaUIProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<DeltaUIState>(defaultState);
  const interactionLog = useRef<Array<{ type: string; moduleId: string; timestamp: number }>>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load persisted preferences on mount
  useEffect(() => {
    if (!user?.id) return;
    AsyncStorage.getItem(`${PREFS_KEY_PREFIX}${user.id}`)
      .then(raw => {
        if (raw) {
          const prefs = JSON.parse(raw) as DeltaUIPreferences;
          setState(s => ({ ...s, preferences: prefs }));
        }
      })
      .catch(() => {});
  }, [user?.id]);

  // Persist preferences every 5 minutes
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      const prefs = derivePreferences(interactionLog.current, stateRef.current);
      setState(s => ({ ...s, preferences: prefs }));
      AsyncStorage.setItem(`${PREFS_KEY_PREFIX}${user.id}`, JSON.stringify(prefs)).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const setActiveTab = useCallback((tab: DeltaUIState['activeTab']) => {
    setState(s => ({ ...s, activeTab: tab }));
  }, []);

  const setChatSheetState = useCallback((chatSheetState: DeltaUIState['chatSheetState']) => {
    setState(s => ({ ...s, chatSheetState }));
  }, []);

  const lastModuleIds = useRef<string>('');
  const registerVisibleModules = useCallback((ids: string[]) => {
    const key = ids.join(',');
    if (key === lastModuleIds.current) return;
    lastModuleIds.current = key;
    setState(s => ({ ...s, visibleModules: ids }));
  }, []);

  const lastChartIds = useRef<string>('');
  const registerVisibleCharts = useCallback((ids: string[]) => {
    const key = ids.join(',');
    if (key === lastChartIds.current) return;
    lastChartIds.current = key;
    setState(s => ({ ...s, visibleCharts: ids }));
  }, []);

  const recordShownGreeting = useCallback((text: string) => {
    setState(s => {
      if (s.shownGreetings.includes(text)) return s;
      const updated = [...s.shownGreetings, text];
      return {
        ...s,
        shownGreetings: updated.length > 100 ? updated.slice(-100) : updated,
        lastGreetingAt: new Date().toISOString(),
      };
    });
  }, []);

  const recordModuleTap = useCallback((moduleId: string) => {
    interactionLog.current.push({ type: 'tap', moduleId, timestamp: Date.now() });
    if (interactionLog.current.length > MAX_INTERACTION_LOG) interactionLog.current = interactionLog.current.slice(-MAX_INTERACTION_LOG);
    setState(s => {
      if (s.tappedModules.includes(moduleId)) return s;
      const updated = [...s.tappedModules, moduleId];
      return { ...s, tappedModules: updated.length > 100 ? updated.slice(-100) : updated };
    });
  }, []);

  const recordModuleDismiss = useCallback((moduleId: string) => {
    interactionLog.current.push({ type: 'dismiss', moduleId, timestamp: Date.now() });
    if (interactionLog.current.length > MAX_INTERACTION_LOG) interactionLog.current = interactionLog.current.slice(-MAX_INTERACTION_LOG);
    setState(s => {
      if (s.dismissedModules.includes(moduleId)) return s;
      const updated = [...s.dismissedModules, moduleId];
      return { ...s, dismissedModules: updated.length > 100 ? updated.slice(-100) : updated };
    });
  }, []);

  const recordModuleIgnored = useCallback((moduleId: string) => {
    interactionLog.current.push({ type: 'ignore', moduleId, timestamp: Date.now() });
    if (interactionLog.current.length > MAX_INTERACTION_LOG) interactionLog.current = interactionLog.current.slice(-MAX_INTERACTION_LOG);
    setState(s => {
      if (s.ignoredModules.includes(moduleId)) return s;
      const updated = [...s.ignoredModules, moduleId];
      return { ...s, ignoredModules: updated.length > 100 ? updated.slice(-100) : updated };
    });
  }, []);

  const recordChatOpenedFrom = useCallback((source: string | null) => {
    setState(s => ({ ...s, chatOpenedFrom: source }));
  }, []);

  const recordRenderError = useCallback((moduleId: string, error: string) => {
    setState(s => ({
      ...s,
      renderErrors: [...s.renderErrors.filter(e => e.moduleId !== moduleId), { moduleId, error, timestamp: new Date().toISOString() }],
    }));
  }, []);

  const clearRenderError = useCallback((moduleId: string) => {
    setState(s => ({
      ...s,
      renderErrors: s.renderErrors.filter(e => e.moduleId !== moduleId),
    }));
  }, []);

  const value: DeltaUIContextValue = {
    ...state,
    setActiveTab,
    setChatSheetState,
    registerVisibleModules,
    registerVisibleCharts,
    recordShownGreeting,
    recordModuleTap,
    recordModuleDismiss,
    recordModuleIgnored,
    recordChatOpenedFrom,
    recordRenderError,
    clearRenderError,
  };

  return <DeltaUICtx.Provider value={value}>{children}</DeltaUICtx.Provider>;
}

export function useDeltaUI(): DeltaUIContextValue {
  const ctx = useContext(DeltaUICtx);
  if (!ctx) throw new Error('useDeltaUI must be used within DeltaUIProvider');
  return ctx;
}

function derivePreferences(
  log: Array<{ type: string; moduleId: string; timestamp: number }>,
  state: DeltaUIState,
): DeltaUIPreferences {
  const mealIds = ['log-breakfast', 'log-lunch', 'log-dinner'];
  const mealDismisses = state.dismissedModules.filter(id => mealIds.includes(id)).length;
  const mealShows = state.visibleModules.filter(id => mealIds.includes(id)).length || 1;

  const tapCount = state.tappedModules.length;
  const totalVisible = state.visibleModules.length || 1;

  // Derive active time windows from log timestamps
  const hourCounts: Record<number, number> = {};
  for (const entry of log) {
    const h = new Date(entry.timestamp).getHours();
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  }
  const peakHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h]) => `${h}:00`);

  // Frequently dismissed module types
  const dismissCounts: Record<string, number> = {};
  for (const id of state.dismissedModules) {
    const type = id.replace(/-\d+$/, '');
    dismissCounts[type] = (dismissCounts[type] || 0) + 1;
  }
  const frequentlyDismissed = Object.entries(dismissCounts)
    .filter(([, count]) => count >= 3)
    .map(([type]) => type);

  return {
    neverTapsMealPrompts: mealDismisses / mealShows > 0.8,
    prefersDetailedInsights: tapCount / totalVisible > 0.5,
    activeTimeWindows: peakHours,
    dismissedModuleTypes: frequentlyDismissed,
  };
}
