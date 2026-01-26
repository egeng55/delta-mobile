/**
 * RecoveryScreen - Sleep, recovery, and health metrics
 *
 * Shows:
 * - Recovery state from health intelligence
 * - Sleep data (HealthKit or logged)
 * - Heart rate metrics
 * - Weekly trends
 */

import React, { useEffect, useState, useMemo } from 'react';
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
import { StateCard, AlignmentRing } from '../components/HealthState';
import { ChainCard } from '../components/CausalChain';
import healthKitService, { SleepSummary, HealthSummary } from '../services/healthKit';
import healthSyncService from '../services/healthSync';
import { useAuth } from '../context/AuthContext';

interface RecoveryScreenProps {
  theme: Theme;
}

export default function RecoveryScreen({ theme }: RecoveryScreenProps): React.ReactElement {
  const { user } = useAuth();
  const {
    healthState,
    causalChains,
    weeklySummaries,
    analyticsLoading,
    fetchAnalyticsData,
  } = useInsightsData();

  // HealthKit state
  const [healthKitAuthorized, setHealthKitAuthorized] = useState(false);
  const [sleepSummary, setSleepSummary] = useState<SleepSummary | null>(null);
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [showCausalChains, setShowCausalChains] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  useEffect(() => {
    fetchAnalyticsData();
    loadHealthKitData();
  }, [fetchAnalyticsData]);

  // Sync HealthKit data to backend for cross-domain reasoning
  useEffect(() => {
    const syncHealthData = async () => {
      if (!user?.id || !healthKitAuthorized) return;

      const shouldSync = await healthSyncService.shouldSync();
      if (!shouldSync) return;

      setSyncStatus('syncing');
      const result = await healthSyncService.syncHealthData(user.id);
      setSyncStatus(result.synced ? 'synced' : 'error');

      // Refresh analytics to get updated cross-domain insights
      if (result.synced) {
        fetchAnalyticsData();
      }
    };

    syncHealthData();
  }, [user?.id, healthKitAuthorized, fetchAnalyticsData]);

  const loadHealthKitData = async () => {
    if (Platform.OS !== 'ios') return;

    try {
      const authorized = await healthKitService.isAuthorized();
      setHealthKitAuthorized(authorized);

      if (authorized) {
        // Get yesterday's sleep (last night) and today's health summary
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const [sleep, health] = await Promise.all([
          healthKitService.getSleepSummary(yesterday),
          healthKitService.getTodayHealthSummary(),
        ]);
        setSleepSummary(sleep);
        setHealthSummary(health);
      }
    } catch {
      // Silent fail
    }
  };

  const requestHealthKitAccess = async () => {
    try {
      const granted = await healthKitService.requestAuthorization();
      setHealthKitAuthorized(granted);
      if (granted) {
        await loadHealthKitData();
      }
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
            loadHealthKitData();
          }}
          tintColor={theme.accent}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recovery</Text>
        <Text style={styles.headerSubtitle}>Sleep & restoration</Text>
      </View>

      {/* Recovery State */}
      {healthState?.has_data && healthState.recovery && (
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Recovery Status</Text>
          <StateCard
            theme={theme}
            type="recovery"
            state={healthState.recovery.state}
            confidence={healthState.recovery.confidence}
            factors={healthState.recovery.factors}
          />
        </Animated.View>
      )}

      {/* Sleep Card */}
      <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Last Night's Sleep</Text>
          {healthKitAuthorized && (
            <View style={styles.healthKitBadge}>
              <Ionicons name="heart" size={12} color="#FF2D55" />
              <Text style={styles.healthKitBadgeText}>HealthKit</Text>
            </View>
          )}
        </View>

        {sleepSummary && sleepSummary.hasData ? (
          <View style={styles.sleepCard}>
            <View style={styles.sleepMainRow}>
              <View style={styles.sleepDurationContainer}>
                <View style={[styles.sleepIcon, { backgroundColor: theme.accent + '20' }]}>
                  <Ionicons name="moon" size={24} color={theme.accent} />
                </View>
                <View>
                  <Text style={styles.sleepDuration}>
                    {formatHours(sleepSummary.totalSleepHours)}
                  </Text>
                  <Text style={styles.sleepLabel}>Total sleep</Text>
                </View>
              </View>

              {sleepSummary.sleepEfficiency > 0 && (
                <View style={styles.sleepQualityContainer}>
                  <Text style={styles.sleepQualityValue}>
                    {Math.round(sleepSummary.sleepEfficiency)}%
                  </Text>
                  <Text style={styles.sleepQualityLabel}>Efficiency</Text>
                </View>
              )}
            </View>

            {/* Sleep Stages */}
            {(sleepSummary.deepSleepHours > 0 || sleepSummary.remSleepHours > 0) && (
              <View style={styles.sleepStagesRow}>
                {sleepSummary.deepSleepHours > 0 && (
                  <View style={styles.sleepStage}>
                    <View style={[styles.stageDot, { backgroundColor: '#6366F1' }]} />
                    <Text style={styles.stageLabel}>Deep</Text>
                    <Text style={styles.stageValue}>{formatHours(sleepSummary.deepSleepHours)}</Text>
                  </View>
                )}
                {sleepSummary.remSleepHours > 0 && (
                  <View style={styles.sleepStage}>
                    <View style={[styles.stageDot, { backgroundColor: '#8B5CF6' }]} />
                    <Text style={styles.stageLabel}>REM</Text>
                    <Text style={styles.stageValue}>{formatHours(sleepSummary.remSleepHours)}</Text>
                  </View>
                )}
                {sleepSummary.coreSleepHours > 0 && (
                  <View style={styles.sleepStage}>
                    <View style={[styles.stageDot, { backgroundColor: '#A78BFA' }]} />
                    <Text style={styles.stageLabel}>Core</Text>
                    <Text style={styles.stageValue}>{formatHours(sleepSummary.coreSleepHours)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Sleep Times */}
            <View style={styles.sleepTimesRow}>
              <View style={styles.sleepTime}>
                <Ionicons name="bed-outline" size={16} color={theme.textSecondary} />
                <Text style={styles.sleepTimeLabel}>Bedtime</Text>
                <Text style={styles.sleepTimeValue}>{formatSleepTime(sleepSummary.bedTime)}</Text>
              </View>
              <View style={styles.sleepTime}>
                <Ionicons name="sunny-outline" size={16} color={theme.textSecondary} />
                <Text style={styles.sleepTimeLabel}>Wake</Text>
                <Text style={styles.sleepTimeValue}>{formatSleepTime(sleepSummary.wakeTime)}</Text>
              </View>
            </View>
          </View>
        ) : healthKitAuthorized ? (
          <View style={styles.emptyCard}>
            <Ionicons name="moon-outline" size={32} color={theme.textSecondary} />
            <Text style={styles.emptyText}>No sleep data for last night</Text>
          </View>
        ) : Platform.OS === 'ios' ? (
          <TouchableOpacity style={styles.healthKitPrompt} onPress={requestHealthKitAccess}>
            <View style={[styles.healthKitIcon, { backgroundColor: '#FF2D5520' }]}>
              <Ionicons name="heart" size={24} color="#FF2D55" />
            </View>
            <View style={styles.healthKitPromptContent}>
              <Text style={styles.healthKitPromptTitle}>Connect Apple Health</Text>
              <Text style={styles.healthKitPromptSubtitle}>
                Sync sleep and heart data automatically
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="moon-outline" size={32} color={theme.textSecondary} />
            <Text style={styles.emptyText}>Log your sleep via chat</Text>
          </View>
        )}
      </Animated.View>

      {/* Heart Metrics */}
      {healthSummary && (healthSummary.latestRestingHeartRate || healthSummary.latestHRV) && (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Heart Metrics</Text>
          <View style={styles.metricsRow}>
            {healthSummary.latestRestingHeartRate && (
              <View style={styles.metricCard}>
                <View style={[styles.metricIcon, { backgroundColor: '#EF444420' }]}>
                  <Ionicons name="heart" size={20} color="#EF4444" />
                </View>
                <Text style={styles.metricValue}>{healthSummary.latestRestingHeartRate.bpm}</Text>
                <Text style={styles.metricLabel}>Resting HR</Text>
                <Text style={styles.metricUnit}>bpm</Text>
              </View>
            )}
            {healthSummary.latestHRV && (
              <View style={styles.metricCard}>
                <View style={[styles.metricIcon, { backgroundColor: '#8B5CF620' }]}>
                  <Ionicons name="pulse" size={20} color="#8B5CF6" />
                </View>
                <Text style={styles.metricValue}>{Math.round(healthSummary.latestHRV.hrvMs)}</Text>
                <Text style={styles.metricLabel}>HRV</Text>
                <Text style={styles.metricUnit}>ms</Text>
              </View>
            )}
          </View>
        </Animated.View>
      )}

      {/* Alignment */}
      {healthState?.alignment && (
        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Timing Alignment</Text>
          <AlignmentRing
            theme={theme}
            score={healthState.alignment.score}
            confidence={healthState.alignment.confidence}
            chronotype={healthState.alignment.chronotype}
          />
        </Animated.View>
      )}

      {/* Causal Chains */}
      {causalChains.length > 0 && (
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowCausalChains(!showCausalChains)}
          >
            <Text style={styles.sectionTitle}>Patterns Detected</Text>
            <View style={styles.chainBadge}>
              <Text style={styles.chainBadgeText}>{causalChains.length}</Text>
            </View>
            <Ionicons
              name={showCausalChains ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {showCausalChains && (
            <View style={styles.chainsContainer}>
              {causalChains.map((chain, index) => (
                <ChainCard
                  key={chain.chain_type}
                  theme={theme}
                  chain={chain}
                  index={index}
                />
              ))}
            </View>
          )}

          {!showCausalChains && causalChains[0] && (
            <Text style={styles.chainPreview}>{causalChains[0].narrative}</Text>
          )}
        </Animated.View>
      )}

      {/* Weekly Average */}
      {weeklySleepAvg && (
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.weeklyCard}>
          <View style={styles.weeklyHeader}>
            <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
            <Text style={styles.weeklyTitle}>7-Day Average</Text>
          </View>
          <Text style={styles.weeklyValue}>{weeklySleepAvg} hrs</Text>
          <Text style={styles.weeklyLabel}>sleep per night</Text>
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
      ...typography.labelLarge,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      flex: 1,
    },
    healthKitBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FF2D5515',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
      borderRadius: borderRadius.sm,
      gap: 4,
    },
    healthKitBadgeText: {
      fontSize: 10,
      color: '#FF2D55',
      fontWeight: '500',
    },
    sleepCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      ...shadows.sm,
    },
    sleepMainRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    sleepDurationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    sleepIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sleepDuration: {
      ...typography.metric,
      color: theme.textPrimary,
    },
    sleepLabel: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    sleepQualityContainer: {
      alignItems: 'center',
      backgroundColor: theme.accentLight,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
    },
    sleepQualityValue: {
      ...typography.title,
      color: theme.accent,
    },
    sleepQualityLabel: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    sleepStagesRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    sleepStage: {
      alignItems: 'center',
    },
    stageDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginBottom: spacing.xs,
    },
    stageLabel: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    stageValue: {
      ...typography.labelMedium,
      color: theme.textPrimary,
      marginTop: spacing.xxs,
    },
    sleepTimesRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: spacing.md,
    },
    sleepTime: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    sleepTimeLabel: {
      ...typography.caption,
      color: theme.textSecondary,
    },
    sleepTimeValue: {
      ...typography.labelMedium,
      color: theme.textPrimary,
    },
    emptyCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xxl,
      alignItems: 'center',
      ...shadows.sm,
    },
    emptyText: {
      ...typography.bodySmall,
      color: theme.textSecondary,
      marginTop: spacing.md,
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
      width: 48,
      height: 48,
      borderRadius: 24,
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
    metricsRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    metricCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      ...shadows.sm,
    },
    metricIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    metricValue: {
      ...typography.metric,
      color: theme.textPrimary,
    },
    metricLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: spacing.xxs,
    },
    metricUnit: {
      ...typography.caption,
      color: theme.textSecondary,
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
    weeklyCard: {
      backgroundColor: theme.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      ...shadows.sm,
    },
    weeklyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    weeklyTitle: {
      ...typography.labelMedium,
      color: theme.textSecondary,
    },
    weeklyValue: {
      ...typography.displayMedium,
      color: theme.textPrimary,
    },
    weeklyLabel: {
      ...typography.caption,
      color: theme.textSecondary,
      marginTop: spacing.xs,
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
