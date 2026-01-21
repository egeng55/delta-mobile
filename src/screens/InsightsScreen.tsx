/**
 * InsightsScreen - Health insights and analytics with real backend.
 *
 * SAFETY DECISIONS:
 * - Explicit loading states
 * - Error handling with fallback data
 * - Explicit types
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { insightsApi, InsightsData } from '../services/api';

interface InsightsScreenProps {
  theme: Theme;
}

interface InsightCard {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export default function InsightsScreen({ theme }: InsightsScreenProps): React.ReactNode {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fetchInsights = async (showRefreshIndicator: boolean = false): Promise<void> => {
    if (showRefreshIndicator === true) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError('');

    try {
      const userId = user?.id ?? 'anonymous';
      const data = await insightsApi.getInsights(userId);
      setInsights(data);
    } catch {
      setError('Could not load insights');
      // Set default data on error
      setInsights({
        user_id: user?.id ?? 'anonymous',
        total_conversations: 0,
        topics_discussed: [],
        wellness_score: 0,
        streak_days: 0,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [user?.id]);

  const onRefresh = (): void => {
    fetchInsights(true);
  };

  // Build insight cards from data
  const insightCards: InsightCard[] = [
    {
      id: '1',
      title: 'Conversations',
      value: String(insights?.total_conversations ?? 0),
      subtitle: 'Total chats with Delta',
      icon: 'chatbubbles-outline',
      color: theme.accent,
    },
    {
      id: '2',
      title: 'Topics Discussed',
      value: String(insights?.topics_discussed?.length ?? 0),
      subtitle: insights?.topics_discussed?.slice(0, 3).join(', ') || 'Start chatting!',
      icon: 'list-outline',
      color: theme.success,
    },
    {
      id: '3',
      title: 'Wellness Score',
      value: String(insights?.wellness_score ?? 0),
      subtitle: 'Based on your habits',
      icon: 'heart-outline',
      color: theme.error,
    },
    {
      id: '4',
      title: 'Streak',
      value: `${insights?.streak_days ?? 0} days`,
      subtitle: insights?.streak_days && insights.streak_days > 0 ? 'Keep it up!' : 'Start your streak!',
      icon: 'flame-outline',
      color: theme.warning,
    },
  ];

  const styles = createStyles(theme, insets.top);

  if (isLoading === true) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading insights...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing === true}
          onRefresh={onRefresh}
          tintColor={theme.accent}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>INSIGHTS</Text>
      </View>

      {error.length > 0 && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.cardsContainer}>
        {insightCards.map(insight => (
          <View key={insight.id} style={styles.card}>
            <View style={[styles.iconContainer, { backgroundColor: insight.color + '20' }]}>
              <Ionicons name={insight.icon} size={24} color={insight.color} />
            </View>
            <Text style={styles.cardTitle}>{insight.title}</Text>
            <Text style={styles.cardValue}>{insight.value}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={2}>{insight.subtitle}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityCard}>
          {insights?.total_conversations && insights.total_conversations > 0 ? (
            <Text style={styles.activityText}>
              You've had {insights.total_conversations} conversation{insights.total_conversations !== 1 ? 's' : ''} with Delta.
              {insights.streak_days && insights.streak_days > 0
                ? ` You're on a ${insights.streak_days}-day streak!`
                : ' Start a streak by chatting daily!'}
            </Text>
          ) : (
            <Text style={styles.activityText}>
              Start chatting with Delta to see your activity and insights here!
            </Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recommendations</Text>
        <View style={styles.recommendationCard}>
          <Ionicons name="bulb" size={20} color={theme.warning} />
          <Text style={styles.recommendationText}>
            Try discussing your sleep patterns with Delta to get personalized tips.
          </Text>
        </View>
        <View style={styles.recommendationCard}>
          <Ionicons name="bulb" size={20} color={theme.warning} />
          <Text style={styles.recommendationText}>
            Set a daily reminder to check in with Delta for consistent health tracking.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(theme: Theme, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.textSecondary,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: topInset + 8,
      paddingBottom: 8,
      backgroundColor: theme.background + 'F0',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.textPrimary,
      letterSpacing: 1,
    },
    errorBanner: {
      backgroundColor: theme.error + '20',
      padding: 12,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 8,
    },
    errorText: {
      color: theme.error,
      fontSize: 14,
      textAlign: 'center',
    },
    cardsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 8,
    },
    card: {
      width: '50%',
      padding: 8,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    cardTitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    cardValue: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    cardSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 12,
    },
    activityCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    activityText: {
      fontSize: 14,
      color: theme.textPrimary,
      lineHeight: 20,
    },
    recommendationCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    recommendationText: {
      flex: 1,
      fontSize: 14,
      color: theme.textPrimary,
      lineHeight: 20,
      marginLeft: 12,
    },
  });
}
