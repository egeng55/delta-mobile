/**
 * DashboardScreen — Delta-curated trend visualizations (Tab 2: Dashboard).
 *
 * Renders viz modules from backend /modules endpoint.
 * No hardcoded chart building — Delta controls which charts to show via viz directives.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../theme/colors';
import VizContainer from '../components/viz/VizContainer';
import { useAuth } from '../context/AuthContext';
import { useInsightsData } from '../hooks/useInsightsData';
import { useDeltaUI } from '../context/DeltaUIContext';
import ModuleRenderer from '../components/ModuleRenderer';
import { themeToVizTheme } from '../utils/themeUtils';

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

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalyticsData(true);
    setRefreshing(false);
  };

  const styles = useMemo(() => createStyles(theme, insets.top), [theme, insets.top]);

  // Filter modules: viz modules for charts, interaction module for Delta's Take
  const vizModules = modules.filter(m => m.viz != null);
  const interactionModule = modules.find(m => m.type === 'interaction');

  // Register visible charts with DeltaUIContext — use stable key to avoid loops
  const vizIds = useMemo(() => vizModules.map(m => m.id), [vizModules]);
  const vizIdsKey = vizIds.join(',');
  useEffect(() => {
    deltaUI.registerVisibleCharts(vizIds);
  }, [vizIdsKey]);

  const hasData = vizModules.length > 0;

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

        {modulesLoading ? (
          <>
            <VizContainer title="" theme={vizTheme} loading>{null}</VizContainer>
            <VizContainer title="" theme={vizTheme} loading>{null}</VizContainer>
          </>
        ) : hasData ? (
          vizModules.map((mod, i) => (
            <ModuleRenderer
              key={mod.id}
              module={{ ...mod, layout: 'wide' }}
              weeklySummaries={weeklySummaries}
              theme={theme}
              index={i}
              chartWidth={chartWidth}
            />
          ))
        ) : (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center' }}>
              No viz modules from backend.{'\n'}
              /modules endpoint may not be deployed.
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
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
