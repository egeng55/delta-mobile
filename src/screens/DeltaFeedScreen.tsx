/**
 * DeltaFeedScreen - Unified view of Delta's intelligence.
 *
 * Replaces fragmented insight views with a single, chronological feed
 * that showcases Delta's reasoning capabilities.
 *
 * Features:
 * - Delta's daily commentary as a voice bubble
 * - Pattern cards with expandable reasoning chains
 * - Factor insights with explanations
 * - Data oversight notifications
 * - Pull-to-refresh
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../theme/colors';
import { useInsightsData } from '../hooks/useInsightsData';
import { useDeltaFeed } from '../hooks/useDeltaFeed';
import {
  DeltaFeedCard,
  DeltaVoiceBubble,
  FeedItemDetailModal,
  FeedItem,
} from '../components/Feed';

interface DeltaFeedScreenProps {
  theme: Theme;
  isFocused?: boolean;
  onOpenToday?: () => void;
  onOpenRecovery?: () => void;
  onOpenHistory?: () => void;
}

export default function DeltaFeedScreen({
  theme,
  isFocused = true,
  onOpenToday,
  onOpenRecovery,
  onOpenHistory,
}: DeltaFeedScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const {
    deltaInsights,
    causalChains,
    analyticsLoading,
    fetchAnalyticsData,
    healthState,
  } = useInsightsData();

  const { feedItems, commentary, readinessScore, hasData } = useDeltaFeed(
    deltaInsights,
    causalChains
  );

  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<FeedItem | null>(null);
  const [showDetail, setShowDetail] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAnalyticsData(true);
    setRefreshing(false);
  }, [fetchAnalyticsData]);

  const handleCardPress = useCallback((item: FeedItem) => {
    // Only show detail modal for items with reasoning
    if (item.reasoning && item.reasoning.length > 0) {
      setSelectedItem(item);
      setShowDetail(true);
    }
  }, []);

  const handleCloseDetail = useCallback(() => {
    setShowDetail(false);
    setSelectedItem(null);
  }, []);

  const handleActionPress = useCallback((actionId: string, item: FeedItem) => {
    // Handle action button presses
    console.log('Action pressed:', actionId, 'on item:', item.id);
    // TODO: Implement action handlers (learn more, undo, etc.)
  }, []);

  const styles = createStyles(theme, insets);

  // Loading state
  if (analyticsLoading && !hasData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading insights...</Text>
      </View>
    );
  }

  // Empty state
  if (!hasData && feedItems.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.emptyContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
          />
        }
      >
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="analytics-outline" size={48} color={theme.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No insights yet</Text>
          <Text style={styles.emptySubtitle}>
            Keep logging your meals, workouts, and wellness data.
            Delta will start finding patterns after a few days.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.accent}
        />
      }
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Delta</Text>
          {readinessScore !== null && (
            <View style={[styles.readinessBadge, { backgroundColor: getReadinessColor(readinessScore, theme) + '20' }]}>
              <Text style={[styles.readinessText, { color: getReadinessColor(readinessScore, theme) }]}>
                {readinessScore}% Ready
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.headerSubtitle}>Your personal health intelligence</Text>

        {/* Quick Access Buttons */}
        <View style={styles.quickAccessRow}>
          {onOpenToday && (
            <TouchableOpacity style={styles.quickAccessButton} onPress={onOpenToday}>
              <Ionicons name="sunny-outline" size={18} color={theme.accent} />
              <Text style={styles.quickAccessText}>Today</Text>
            </TouchableOpacity>
          )}
          {onOpenRecovery && (
            <TouchableOpacity style={styles.quickAccessButton} onPress={onOpenRecovery}>
              <Ionicons name="bed-outline" size={18} color={theme.accent} />
              <Text style={styles.quickAccessText}>Recovery</Text>
            </TouchableOpacity>
          )}
          {onOpenHistory && (
            <TouchableOpacity style={styles.quickAccessButton} onPress={onOpenHistory}>
              <Ionicons name="calendar-outline" size={18} color={theme.accent} />
              <Text style={styles.quickAccessText}>History</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Delta's Commentary */}
      {commentary && (
        <View style={styles.commentarySection}>
          <DeltaVoiceBubble
            theme={theme}
            headline={commentary.headline}
            body={commentary.body}
            tone={commentary.tone}
            showAvatar={true}
            timestamp={new Date().toISOString()}
          />
        </View>
      )}

      {/* Feed Items */}
      <View style={styles.feedSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="sparkles" size={16} color={theme.accent} />
          <Text style={styles.sectionTitle}>Insights & Patterns</Text>
          <Text style={styles.sectionCount}>{feedItems.length}</Text>
        </View>

        {feedItems.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => handleCardPress(item)}
            activeOpacity={item.reasoning && item.reasoning.length > 0 ? 0.7 : 1}
          >
            <DeltaFeedCard
              theme={theme}
              item={item}
              index={index}
              onActionPress={handleActionPress}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Stats Summary */}
      {healthState?.has_data && (
        <Animated.View
          entering={FadeInDown.delay(300).springify()}
          style={styles.quickStats}
        >
          <Text style={styles.quickStatsTitle}>Health State Summary</Text>
          <View style={styles.statsGrid}>
            {healthState.recovery && (
              <QuickStatItem
                theme={theme}
                label="Recovery"
                value={formatState(healthState.recovery.state)}
                confidence={healthState.recovery.confidence}
                color={getStateColor(healthState.recovery.state, theme)}
              />
            )}
            {healthState.energy && (
              <QuickStatItem
                theme={theme}
                label="Energy"
                value={formatState(healthState.energy.state)}
                confidence={healthState.energy.confidence}
                color={getStateColor(healthState.energy.state, theme)}
              />
            )}
            {healthState.load && (
              <QuickStatItem
                theme={theme}
                label="Load"
                value={formatState(healthState.load.state)}
                confidence={healthState.load.confidence}
                color={getStateColor(healthState.load.state, theme)}
              />
            )}
          </View>
        </Animated.View>
      )}

      {/* Footer padding */}
      <View style={{ height: 100 }} />
    </ScrollView>

    {/* Detail Modal - outside ScrollView */}
    <FeedItemDetailModal
      theme={theme}
      item={selectedItem}
      visible={showDetail}
      onClose={handleCloseDetail}
      onActionPress={handleActionPress}
    />
  </>
  );
}

// Quick stat item component
interface QuickStatItemProps {
  theme: Theme;
  label: string;
  value: string;
  confidence: number;
  color: string;
}

function QuickStatItem({
  theme,
  label,
  value,
  confidence,
  color,
}: QuickStatItemProps): React.ReactElement {
  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 12,
      marginHorizontal: 4,
      borderWidth: 1,
      borderColor: theme.border,
    }}>
      <Text style={{
        fontSize: 11,
        color: theme.textSecondary,
        marginBottom: 4,
      }}>
        {label}
      </Text>
      <Text style={{
        fontSize: 15,
        fontWeight: '600',
        color: color,
        marginBottom: 2,
      }}>
        {value}
      </Text>
      <Text style={{
        fontSize: 10,
        color: theme.textSecondary,
      }}>
        {Math.round(confidence * 100)}% confidence
      </Text>
    </View>
  );
}

// Helper functions
function getReadinessColor(score: number, theme: Theme): string {
  if (score >= 70) return theme.success;
  if (score >= 40) return theme.warning;
  return theme.error;
}

function getStateColor(state: string, theme: Theme): string {
  const positiveStates = ['recovered', 'peak', 'high', 'low']; // low load is good
  const neutralStates = ['neutral', 'moderate'];

  if (positiveStates.includes(state)) return theme.success;
  if (neutralStates.includes(state)) return theme.warning;
  return theme.error;
}

function formatState(state: string): string {
  return state
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function createStyles(theme: Theme, insets: { top: number; bottom: number }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: insets.top + 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.textSecondary,
    },
    emptyContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyState: {
      alignItems: 'center',
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    header: {
      marginBottom: 20,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    readinessBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    readinessText: {
      fontSize: 13,
      fontWeight: '600',
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
    },
    quickAccessRow: {
      flexDirection: 'row',
      marginTop: 12,
      gap: 8,
    },
    quickAccessButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
    },
    quickAccessText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textPrimary,
    },
    commentarySection: {
      marginBottom: 20,
    },
    feedSection: {
      marginBottom: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
      marginLeft: 8,
    },
    sectionCount: {
      fontSize: 12,
      color: theme.textSecondary,
      marginLeft: 'auto',
      backgroundColor: theme.surface,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    quickStats: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    quickStatsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 12,
    },
    statsGrid: {
      flexDirection: 'row',
      marginHorizontal: -4,
    },
  });
}
