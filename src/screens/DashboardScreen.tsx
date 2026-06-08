/**
 * DashboardScreen — Delta-curated trend visualizations (Tab 2: Dashboard).
 *
 * Renders viz modules from backend /modules endpoint.
 * No hardcoded chart building — Delta controls which charts to show via viz directives.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../theme/colors';
import VizContainer from '../components/viz/VizContainer';
import { useAuth } from '../context/AuthContext';
import { useInsightsData } from '../hooks/useInsightsData';
import { useDeltaUI } from '../context/DeltaUIContext';
import ModuleRenderer from '../components/ModuleRenderer';
import { themeToVizTheme } from '../utils/themeUtils';
import { behavioralOsApi, BehavioralDashboardState, BedroomStatusResponse } from '../services/api';
import { buildBehavioralLoopPresentation } from '../utils/behavioralLoopPresenter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DashboardScreenProps {
  theme: Theme;
}

export default function DashboardScreen({ theme }: DashboardScreenProps): React.ReactNode {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const {
    weeklySummaries,
    analyticsLoading,
    fetchAnalyticsData,
    modules,
    modulesLoading,
  } = useInsightsData();

  const [refreshing, setRefreshing] = useState(false);
  const [behavioralState, setBehavioralState] = useState<BehavioralDashboardState | null>(null);
  const [bedroomStatus, setBedroomStatus] = useState<BedroomStatusResponse | null>(null);
  const [behavioralLoading, setBehavioralLoading] = useState(false);
  const [behavioralError, setBehavioralError] = useState(false);
  const vizTheme = useMemo(() => themeToVizTheme(theme), [theme]);
  const deltaUI = useDeltaUI();
  const chartWidth = SCREEN_WIDTH - 48;

  // Register active tab
  useEffect(() => {
    deltaUI.setActiveTab('Dashboard');
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const fetchBehavioralState = useCallback(async () => {
    if (!user?.id) return;
    setBehavioralLoading(true);
    setBehavioralError(false);
    let nextState: BehavioralDashboardState | null = null;
    let nextStatus: BedroomStatusResponse | null = null;
    try {
      nextState = await behavioralOsApi.getDashboard(user.id);
    } catch (dashboardError) {
      console.warn('[DashboardScreen] Behavioral OS dashboard fetch failed:', dashboardError);
    }
    try {
      nextStatus = await behavioralOsApi.getBedroomStatus(user.id);
    } catch (statusError) {
      console.warn('[DashboardScreen] Bedroom Copilot status fetch failed:', statusError);
    } finally {
      setBehavioralState(nextState);
      setBedroomStatus(nextStatus);
      setBehavioralError(!nextState && !nextStatus);
      setBehavioralLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchBehavioralState();
  }, [fetchBehavioralState]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAnalyticsData(true), fetchBehavioralState()]);
    setRefreshing(false);
  };

  const styles = useMemo(() => createStyles(theme, insets.top), [theme, insets.top]);

  // Separate modules: interaction module for Delta's Take, others for main content
  const interactionModule = modules.find(m => m.type === 'interaction');
  // Show all non-interaction modules (both viz and non-viz)
  const displayModules = modules.filter(m => m.type !== 'interaction');

  // Register visible charts with DeltaUIContext — use stable key to avoid loops
  const vizIds = useMemo(() => displayModules.filter(m => m.viz != null).map(m => m.id), [displayModules]);
  const vizIdsKey = vizIds.join(',');
  useEffect(() => {
    deltaUI.registerVisibleCharts(vizIds);
  }, [vizIdsKey]);

  const hasData = displayModules.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          {weeklySummaries.length > 0
            ? `${weeklySummaries.length} days tracked`
            : 'No data yet'}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />
        }
      >
        {/* Delta's Take — interaction module from backend */}
        {interactionModule && (
          <View style={styles.deltaTake}>
            <Text style={styles.deltaTakeLabel}>Delta's Take</Text>
            <Text style={styles.deltaTakeText}>{interactionModule.detail}</Text>
          </View>
        )}

        <BehavioralOSStatus
          theme={theme}
          state={behavioralState}
          status={bedroomStatus}
          loading={behavioralLoading}
          error={behavioralError}
        />

        {modulesLoading ? (
          <>
            <VizContainer title="" theme={vizTheme} loading>{null}</VizContainer>
            <VizContainer title="" theme={vizTheme} loading>{null}</VizContainer>
          </>
        ) : hasData ? (
          displayModules.map((mod, i) => (
            <ModuleRenderer
              key={mod.id}
              module={{ ...mod, layout: mod.viz ? 'wide' : 'standard' }}
              weeklySummaries={weeklySummaries}
              theme={theme}
              index={i}
              chartWidth={chartWidth}
            />
          ))
        ) : (
          <EmptyDashboard theme={theme} />
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function BehavioralOSStatus({
  theme,
  state,
  status,
  loading,
  error,
}: {
  theme: Theme;
  state: BehavioralDashboardState | null;
  status: BedroomStatusResponse | null;
  loading: boolean;
  error: boolean;
}) {
  const presentation = buildBehavioralLoopPresentation(state, status, {
    backendUnavailable: error,
    loading,
  });
  const systemEntries = Object.entries(state?.system_status ?? {}).slice(0, 4);

  return (
    <View style={{
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            backgroundColor: theme.accent + '16',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name="git-network-outline" size={16} color={theme.accent} />
          </View>
          <View>
            <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '700' }}>
              Bedroom Copilot
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 1 }}>
              {'Observation -> event -> decision -> adaptation'}
            </Text>
          </View>
        </View>
        <View style={{
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 99,
          backgroundColor: error ? '#EF444422' : theme.accent + '14',
        }}>
          <Text style={{ color: error ? '#EF4444' : theme.accent, fontSize: 11, fontWeight: '700' }}>
            {presentation.statusLabel}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <BehaviorMetric theme={theme} label="Events" value={state?.recent_events?.length ?? 0} />
        <BehaviorMetric theme={theme} label="Memory" value={state?.memory_writes?.length ?? 0} />
        <BehaviorMetric theme={theme} label="Decisions" value={state?.interventions?.length ?? status?.recent_interventions?.length ?? 0} />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
          Product demo: {presentation.productDemoStatus}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 17 }}>
          Proof point: {presentation.latestProofPoint}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
          State: {presentation.statePersistence} / {presentation.stateSource}
        </Text>
        <Text style={{ color: theme.textPrimary, fontSize: 13, lineHeight: 18 }}>
          Observation: {presentation.latestTranscript}
        </Text>
        <Text style={{ color: theme.textPrimary, fontSize: 13, lineHeight: 18 }}>
          Event: {presentation.eventLabel} ({presentation.eventDetail})
        </Text>
        <Text style={{ color: theme.textPrimary, fontSize: 13, lineHeight: 18 }}>
          Decision: {presentation.decisionLabel}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 17 }}>
          Copy: {presentation.interventionCopy}
        </Text>
        <Text style={{ color: theme.accent, fontSize: 12, lineHeight: 17 }}>
          Adaptation: {presentation.adaptationSummary}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 17 }}>
          Feedback meaning: {presentation.feedbackExplanation}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 11, lineHeight: 16 }}>
          {presentation.feedbackOptionsSummary}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        <StatePill theme={theme} label="tone" value={presentation.tone} />
        <StatePill theme={theme} label="cooldown" value={presentation.cooldown} />
        <StatePill theme={theme} label="timing" value={presentation.timingOffset} />
        <StatePill theme={theme} label="reduction" value={presentation.reductionLevel} />
        <StatePill theme={theme} label="feedback" value={presentation.feedbackLabel} />
      </View>

      <Text style={{ color: presentation.stateIsSimulated ? '#F59E0B' : theme.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 10 }}>
        {presentation.stateWarning}
      </Text>
      <Text style={{ color: theme.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 4 }}>
        {presentation.readinessLabel}
      </Text>
      <Text style={{ color: theme.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 4 }}>
        Read-only demo visibility. This panel does not start audio capture, notifications, TTS, or persistence mutation.
      </Text>

      {systemEntries.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {systemEntries.map(([layer, status]) => (
            <View
              key={layer}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: theme.background,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Text style={{ color: theme.textSecondary, fontSize: 10 }}>
                {layer.replace(/_/g, ' ')}: {status}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function StatePill({ theme, label, value }: { theme: Theme; label: string; value: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text style={{ color: theme.textSecondary, fontSize: 10 }}>
        {label}: {value}
      </Text>
    </View>
  );
}

function BehaviorMetric({ theme, label, value }: { theme: Theme; label: string; value: number }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.background,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    }}>
      <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 10, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const EXAMPLE_VIZ = [
  { icon: 'trending-up-outline' as const, title: 'Sleep vs. Recovery', type: 'Line chart', color: '#a78bfa' },
  { icon: 'bar-chart-outline' as const, title: 'Weekly Training Load', type: 'Bar chart', color: '#5EEAD4' },
  { icon: 'grid-outline' as const, title: 'Habit Consistency', type: 'Heatmap', color: '#FBBF24' },
  { icon: 'scatter-chart' as const, title: 'Stress × Sleep Quality', type: 'Scatter plot', color: '#fb7185' },
  { icon: 'stats-chart-outline' as const, title: 'Energy Distribution', type: 'Distribution', color: '#6366F1' },
  { icon: 'swap-horizontal-outline' as const, title: 'Rest Days vs. Active', type: 'Comparison', color: '#38BDF8' },
] as const;

const CAPABILITY_TAGS = [
  'Trend detection', 'Cause & effect', 'Anomaly alerts',
  'Weekly summaries', 'Before/after', 'Correlations',
];

function EmptyDashboard({ theme }: { theme: Theme }) {
  return (
    <View style={{ paddingTop: 24 }}>
      {/* Hero message */}
      <View style={{ alignItems: 'center', paddingHorizontal: 24, marginBottom: 28 }}>
        <View style={{
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: theme.accent + '15', alignItems: 'center', justifyContent: 'center',
          marginBottom: 14,
        }}>
          <Ionicons name="analytics-outline" size={28} color={theme.accent} />
        </View>
        <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>
          Your personal analytics
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Delta builds custom visualizations based on your data. Log a few days and these will populate automatically.
        </Text>
      </View>

      {/* Example viz cards */}
      <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, paddingHorizontal: 4 }}>
        Visualizations Delta can generate
      </Text>
      {EXAMPLE_VIZ.map((viz, i) => (
        <View key={i} style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: theme.surface, borderRadius: 12,
          padding: 14, marginBottom: 8,
          borderWidth: 1, borderColor: theme.border,
          opacity: 0.7,
        }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: viz.color + '18', alignItems: 'center', justifyContent: 'center',
            marginRight: 12,
          }}>
            <Ionicons name={viz.icon === 'scatter-chart' ? 'ellipse-outline' : viz.icon} size={18} color={viz.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600' }}>{viz.title}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 1 }}>{viz.type}</Text>
          </View>
          <Ionicons name="lock-closed-outline" size={14} color={theme.textSecondary + '60'} />
        </View>
      ))}

      {/* Capability tags */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16, paddingHorizontal: 4 }}>
        {CAPABILITY_TAGS.map((tag) => (
          <View key={tag} style={{
            paddingHorizontal: 10, paddingVertical: 5,
            borderRadius: 100, backgroundColor: theme.accent + '12',
            borderWidth: 1, borderColor: theme.accent + '20',
          }}>
            <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '500' }}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function createStyles(theme: Theme, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: topInset + 8,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
    },
    deltaTake: {
      backgroundColor: theme.accent + '10',
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.accent + '20',
    },
    deltaTakeLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.accent,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
      marginBottom: 6,
    },
    deltaTakeText: {
      fontSize: 14,
      color: theme.textPrimary,
      lineHeight: 20,
    },
  });
}
