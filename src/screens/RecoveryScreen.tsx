/**
 * RecoveryScreen - Sleep, recovery, and health metrics (WHOOP-style)
 *
 * Shows:
 * - Hero: SleepPerformanceCard
 * - Prominent RecoveryGauge
 * - Factor breakdown with expandable explanations
 * - Heart metrics with vs comparisons
 * - Weekly sleep trend mini-chart
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Theme } from '../theme/colors';
import { spacing, typography, borderRadius, shadows } from '../theme/designSystem';
import { useInsightsData } from '../hooks/useInsightsData';
import { AlignmentRing, FactorBreakdownCard } from '../components/HealthState';
import { ChainCard } from '../components/CausalChain';
import { RecoveryGauge } from '../components/Gauges';
import { SleepPerformanceCard } from '../components/Sleep';
import { MetricComparisonCard } from '../components/Metrics';
import { useHealthKit } from '../context/HealthKitContext';
import { useDayChange } from '../hooks/useDayChange';

interface RecoveryScreenProps {
  theme: Theme;
  isFocused?: boolean;
  onClose?: () => void;
}

export default function RecoveryScreen({ theme, isFocused = true, onClose }: RecoveryScreenProps): React.ReactElement {
  const {
    healthState,
    causalChains,
    weeklySummaries,
    analyticsLoading,
    fetchAnalyticsData,
    deltaInsights,
  } = useInsightsData();

  // Use centralized HealthKit context
  const {
    isAvailable: healthKitAvailable,
    isAuthorized: healthKitAuthorized,
    isEnabled: healthKitEnabled,
    hasWatchData,
    healthData,
    requestAuthorization,
    setEnabled,
    refreshHealthData,
  } = useHealthKit();

  const [showCausalChains, setShowCausalChains] = useState(false);

  const wasFocused = useRef(isFocused);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Refresh data when tab becomes focused
  useEffect(() => {
    if (isFocused && !wasFocused.current) {
      fetchAnalyticsData(true);
      if (healthKitEnabled && healthKitAuthorized) {
        refreshHealthData();
      }
    }
    wasFocused.current = isFocused;
  }, [isFocused, fetchAnalyticsData, healthKitEnabled, healthKitAuthorized, refreshHealthData]);

  // Refresh data when day changes (midnight or app foregrounded on new day)
  useDayChange(() => {
    fetchAnalyticsData(true);
  });

  const requestHealthKitAccess = async () => {
    try {
      await setEnabled(true);
    } catch {
      // Silent fail
    }
  };

  // Calculate weekly sleep average
  const weeklySleepAvg = useMemo(() => {
    const withSleep = weeklySummaries.filter(s => s.sleep_hours !== null && s.sleep_hours > 0);
    if (withSleep.length === 0) return null;
    const total = withSleep.reduce((sum, s) => sum + (s.sleep_hours ?? 0), 0);
    return (total / withSleep.length).toFixed(1);
  }, [weeklySummaries]);

  const formatSleepTime = (timeString: string | null): string => {
    if (!timeString) return '--';
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '--';
    }
  };

  const formatHours = (hours: number): string => {
    const wholeHours = Math.floor(hours);
    const mins = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${mins}m`;
  };

  // Calculate recovery score for gauge (0-100)
  // Use actual backend readiness score when available
  const recoveryScore = useMemo(() => {
    // Prefer actual readiness score from backend
    if (healthState?.readiness?.score !== undefined) {
      return Math.round(healthState.readiness.score);
    }
    // Fall back to state-based mapping
    if (!healthState?.recovery) return 50;
    const stateScores: Record<string, number> = {
      'well_rested': 90,
      'rested': 75,
      'recovered': 70,
      'moderate': 55,
      'neutral': 50,
      'fatigued': 35,
      'exhausted': 20,
      'unknown': 50,
    };
    return stateScores[healthState.recovery.state] ?? 50;
  }, [healthState?.recovery, healthState?.readiness]);

  // Build factors array for FactorBreakdownCard
  const recoveryFactors = useMemo(() => {
    if (!healthState?.recovery?.factors) return [];

    // Map string quality values to numbers
    const qualityMap: Record<string, number> = {
      'excellent': 0.9, 'great': 0.8, 'good': 0.7, 'fair': 0.5, 'poor': 0.3, 'bad': 0.2,
      'high': 0.8, 'medium': 0.5, 'low': 0.3
    };

    const factorsObj = healthState.recovery.factors;
    return Object.entries(factorsObj).map(([key, value]) => {
      // Parse value - handle numbers, booleans, and strings
      let numValue: number;
      let displayValue: string;

      if (typeof value === 'number') {
        numValue = value;
        // If value looks like a score (0-10 range), normalize to 0-1
        if (value > 1 && value <= 10) {
          numValue = value / 10;
          displayValue = `${value}/10`;
        } else if (value >= -1 && value <= 1) {
          displayValue = value > 0 ? `+${Math.round(value * 100)}%` : `${Math.round(value * 100)}%`;
        } else {
          displayValue = String(Math.round(value));
        }
      } else if (typeof value === 'boolean') {
        numValue = value ? 0.7 : 0.3;
        displayValue = value ? 'Yes' : 'No';
      } else if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        numValue = qualityMap[lowerValue] ?? 0.5;
        displayValue = value.charAt(0).toUpperCase() + value.slice(1);
      } else {
        numValue = 0.5;
        displayValue = 'Unknown';
      }

      // Determine impact level based on normalized value
      const impact = numValue >= 0.6 ? 'positive' as const :
                    numValue <= 0.4 ? 'negative' as const : 'neutral' as const;

      // Format key as readable name
      const name = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());

      return {
        name,
        impact,
        contribution: Math.max(0, Math.min(100, numValue * 100)),
        value: displayValue,
      };
    });
  }, [healthState?.recovery?.factors]);

  // Calculate weekly averages for comparisons
  const weeklyHRVAvg = useMemo(() => {
    const withHRV = weeklySummaries.filter(s => (s as any).hrv_ms != null && (s as any).hrv_ms > 0);
    if (withHRV.length === 0) return null;
    return withHRV.reduce((sum, s) => sum + ((s as any).hrv_ms ?? 0), 0) / withHRV.length;
  }, [weeklySummaries]);

  const weeklyRestingHRAvg = useMemo(() => {
    const withHR = weeklySummaries.filter(s => (s as any).resting_hr != null && (s as any).resting_hr > 0);
    if (withHR.length === 0) return null;
    return withHR.reduce((sum, s) => sum + ((s as any).resting_hr ?? 0), 0) / withHR.length;
  }, [weeklySummaries]);

  // Weekly sleep trend data
  const weeklySleepTrend = useMemo(() => {
    return weeklySummaries
      .filter(s => s.sleep_hours !== null && s.sleep_hours > 0)
      .slice(-7)
      .map(s => ({
        day: new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0),
        hours: s.sleep_hours ?? 0,
      }));
  }, [weeklySummaries]);

  const styles = createStyles(theme);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={analyticsLoading}
          onRefresh={() => {
            fetchAnalyticsData(true);
            if (healthKitEnabled && healthKitAuthorized) {
              refreshHealthData();
            }
          }}
          tintColor={theme.accent}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Recovery</Text>
        {hasWatchData && (
          <View style={styles.healthKitBadge}>
            <Ionicons name="watch" size={12} color="#FF2D55" />
            <Text style={styles.healthKitBadgeText}>Apple Watch Connected</Text>
          </View>
        )}
      </View>

      {/* Hero: Sleep Performance Card - Only show Apple Watch features when enabled */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.section}>
        {healthKitEnabled && hasWatchData && healthData.sleep && healthData.sleep.hasData ? (
          <SleepPerformanceCard
            theme={theme}
            data={{
              totalHours: healthData.sleep.totalSleepHours,
              targetHours: 8,
              efficiency: healthData.sleep.sleepEfficiency,
              deepHours: healthData.sleep.deepSleepHours,
              remHours: healthData.sleep.remSleepHours,
              coreHours: healthData.sleep.coreSleepHours,
              bedTime: healthData.sleep.bedTime ?? undefined,
              wakeTime: healthData.sleep.wakeTime ?? undefined,
            }}
          />
        ) : healthKitEnabled && healthKitAuthorized ? (
          <View style={styles.emptyCard}>
            <Ionicons name="moon-outline" size={40} color={theme.textSecondary} />
            <Text style={styles.emptyTitle}>No Sleep Data</Text>
            <Text style={styles.emptyText}>Sleep data will appear here after your next night</Text>
          </View>
        ) : (
          /* When HealthKit is disabled or not available, show log via chat option */
          <View style={styles.emptyCard}>
            <Ionicons name="moon-outline" size={40} color={theme.textSecondary} />
            <Text style={styles.emptyTitle}>Track Your Sleep</Text>
            <Text style={styles.emptyText}>Log your sleep via chat to see insights</Text>
          </View>
        )}
      </Animated.View>

      {/* Recovery Gauge Section */}
      {healthState?.has_data && healthState.recovery && (
        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Recovery Score</Text>
          <View style={styles.gaugeCard}>
            <RecoveryGauge
              score={recoveryScore}
              size={160}
              theme={theme}
              label="Recovery"
              showStateLabel={true}
            />
            <View style={styles.gaugeInfo}>
              <Text style={styles.gaugeInfoText}>
                Based on {Object.keys(healthState.recovery.factors).length} factors including sleep quality, HRV, and activity balance
              </Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Factor Breakdown with Delta Explanations */}
      {(deltaInsights?.factors?.length ?? 0) > 0 ? (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <FactorBreakdownCard
            theme={theme}
            title="What's Affecting Recovery"
            factors={deltaInsights!.factors.map(f => ({
              name: f.name,
              impact: f.impact,
              contribution: f.current_value !== undefined && f.baseline !== undefined
                ? Math.round((f.current_value / f.baseline) * 50 + 25) // Normalize around 50%
                : 50,
              value: f.current_value !== undefined ? String(Math.round(f.current_value)) : f.state,
              description: f.explanation, // LLM-generated explanation
              suggestion: f.suggestion ?? undefined, // LLM-generated suggestion
            }))}
          />
        </Animated.View>
      ) : recoveryFactors.length > 0 && (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <FactorBreakdownCard
            theme={theme}
            title="What's Affecting Recovery"
            factors={recoveryFactors}
          />
        </Animated.View>
      )}

      {/* Heart Metrics with Comparisons - Only show when HealthKit enabled and has data */}
      {healthKitEnabled && hasWatchData && (healthData.hrv || healthData.restingHeartRate) && (
        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Heart Metrics</Text>
          <View style={styles.metricsRow}>
            {healthData.hrv && (
              <View style={styles.metricCardWrapper}>
                <MetricComparisonCard
                  theme={theme}
                  label="HRV"
                  currentValue={Math.round(healthData.hrv.hrvMs)}
                  comparisonValue={weeklyHRVAvg ?? healthData.hrv.hrvMs}
                  comparisonBasis="7-day average"
                  unit="ms"
                  icon="pulse"
                  iconColor="#8B5CF6"
                  higherIsBetter={true}
                  compact={true}
                />
              </View>
            )}
            {healthData.restingHeartRate && (
              <View style={styles.metricCardWrapper}>
                <MetricComparisonCard
                  theme={theme}
                  label="Resting HR"
                  currentValue={healthData.restingHeartRate.bpm}
                  comparisonValue={weeklyRestingHRAvg ?? healthData.restingHeartRate.bpm}
                  comparisonBasis="7-day average"
                  unit="bpm"
                  icon="heart"
                  iconColor="#EF4444"
                  higherIsBetter={false}
                  compact={true}
                />
              </View>
            )}
          </View>
        </Animated.View>
      )}

      {/* Weekly Sleep Trend */}
      {weeklySleepTrend.length > 0 && (
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Sleep Trend</Text>
          <View style={styles.trendCard}>
            <View style={styles.trendBars}>
              {weeklySleepTrend.map((day, index) => {
                const heightPercent = Math.min((day.hours / 10) * 100, 100);
                const isGood = day.hours >= 7;
                const isToday = index === weeklySleepTrend.length - 1;
                return (
                  <View key={index} style={styles.trendBarColumn}>
                    <View style={styles.trendBarContainer}>
                      <View
                        style={[
                          styles.trendBar,
                          {
                            height: `${heightPercent}%`,
                            backgroundColor: isToday ? theme.accent : isGood ? '#22C55E' : '#EAB308',
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.trendLabel, isToday && { color: theme.accent }]}>
                      {day.day}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.trendLegend}>
              <View style={styles.trendLegendItem}>
                <View style={[styles.trendLegendDot, { backgroundColor: '#22C55E' }]} />
                <Text style={styles.trendLegendText}>7+ hours</Text>
              </View>
              <View style={styles.trendLegendItem}>
                <View style={[styles.trendLegendDot, { backgroundColor: '#EAB308' }]} />
                <Text style={styles.trendLegendText}>Under 7 hours</Text>
              </View>
            </View>
            {weeklySleepAvg && (
              <View style={styles.trendAverage}>
                <Text style={styles.trendAverageLabel}>7-day average:</Text>
                <Text style={styles.trendAverageValue}>{weeklySleepAvg}h</Text>
              </View>
            )}
          </View>
        </Animated.View>
      )}

      {/* Alignment */}
      {healthState?.alignment && (
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Timing Alignment</Text>
          <AlignmentRing
            theme={theme}
            score={healthState.alignment.score}
            confidence={healthState.alignment.confidence}
            chronotype={healthState.alignment.chronotype}
          />
        </Animated.View>
      )}

      {/* Causal Chains with Delta Explanations (Collapsible) */}
      {(deltaInsights?.patterns?.length ?? causalChains.length) > 0 && (
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowCausalChains(!showCausalChains)}
          >
            <Text style={styles.sectionTitle}>Patterns Detected</Text>
            <View style={styles.chainBadge}>
              <Text style={styles.chainBadgeText}>
                {deltaInsights?.patterns?.length ?? causalChains.length}
              </Text>
            </View>
            <Ionicons
              name={showCausalChains ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {showCausalChains && (
            <View style={styles.chainsContainer}>
              {deltaInsights?.patterns?.length ? (
                // Use Delta's explained patterns (with why/advice)
                deltaInsights.patterns.map((pattern, index) => (
                  <ChainCard
                    key={`${pattern.cause}-${pattern.effect}`}
                    theme={theme}
                    chain={{
                      chain_type: `${pattern.cause}_${pattern.effect}`,
                      cause_event: pattern.cause,
                      effect_event: pattern.effect,
                      occurrences: pattern.total_occurrences,
                      co_occurrences: pattern.times_observed,
                      confidence: pattern.confidence,
                      lag_days: pattern.lag_days,
                      narrative: pattern.narrative,
                      why: pattern.why,
                      advice: pattern.advice,
                    }}
                    index={index}
                  />
                ))
              ) : (
                // Fall back to raw causal chains
                causalChains.map((chain, index) => (
                  <ChainCard
                    key={chain.chain_type}
                    theme={theme}
                    chain={chain}
                    index={index}
                  />
                ))
              )}
            </View>
          )}

          {!showCausalChains && (deltaInsights?.patterns?.[0] ?? causalChains[0]) && (
            <Text style={styles.chainPreview}>
              {deltaInsights?.patterns?.[0]?.narrative ?? causalChains[0]?.narrative}
            </Text>
          )}
        </Animated.View>
      )}

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          Recovery insights reflect logged patterns only. Not a medical assessment.
        </Text>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    header: {
      paddingBottom: spacing.lg,
    },
    closeButton: {
      position: 'absolute',
      top: 0,
      right: 0,
      padding: spacing.sm,
      zIndex: 10,
    },
    headerTitle: {
      ...typography.headline,
      color: theme.textPrimary,
    },
    headerSubtitle: {
      ...typography.bodyMedium,
      color: theme.textSecondary,
      marginTop: spacing.xs,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '400',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 2,
      flex: 1,
      marginBottom: spacing.md,
    },
    healthKitBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FF2D5515',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
      borderRadius: borderRadius.sm,
      gap: 4,
      marginTop: spacing.sm,
      alignSelf: 'flex-start',
    },
    healthKitBadgeText: {
      fontSize: 10,
      color: '#FF2D55',
      fontWeight: '400',
      letterSpacing: 0.5,
    },
    emptyCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xxl,
      alignItems: 'center',
      ...shadows.sm,
    },
    emptyTitle: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
      fontWeight: '400',
      marginTop: spacing.md,
    },
    emptyText: {
      ...typography.bodySmall,
      color: theme.textSecondary,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    healthKitPrompt: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      ...shadows.sm,
    },
    healthKitIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    healthKitPromptContent: {
      flex: 1,
      marginLeft: spacing.md,
    },
    healthKitPromptTitle: {
      ...typography.bodyMedium,
      color: theme.textPrimary,
      fontWeight: '600',
    },
    healthKitPromptSubtitle: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: spacing.xxs,
    },
    gaugeCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      ...shadows.sm,
    },
    gaugeInfo: {
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      width: '100%',
    },
    gaugeInfoText: {
      ...typography.caption,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    metricsRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    metricCardWrapper: {
      flex: 1,
    },
    trendCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      ...shadows.sm,
    },
    trendBars: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      height: 100,
      marginBottom: spacing.md,
    },
    trendBarColumn: {
      flex: 1,
      alignItems: 'center',
    },
    trendBarContainer: {
      width: 20,
      height: 80,
      justifyContent: 'flex-end',
      marginBottom: spacing.xs,
    },
    trendBar: {
      width: '100%',
      borderRadius: 4,
      minHeight: 4,
    },
    trendLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      fontSize: 10,
    },
    trendLegend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    trendLegendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    trendLegendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    trendLegendText: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    trendAverage: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    trendAverageLabel: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    trendAverageValue: {
      ...typography.labelMedium,
      color: theme.textPrimary,
      fontWeight: '600',
    },
    chainBadge: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
      marginRight: spacing.sm,
    },
    chainBadgeText: {
      ...typography.caption,
      color: '#fff',
      fontWeight: '600',
    },
    chainsContainer: {
      gap: spacing.md,
    },
    chainPreview: {
      ...typography.bodySmall,
      color: theme.textSecondary,
      fontStyle: 'italic',
    },
    disclaimer: {
      paddingVertical: spacing.xl,
    },
    disclaimerText: {
      ...typography.caption,
      color: theme.textSecondary,
      textAlign: 'center',
      fontStyle: 'italic',
    },
  });
}
