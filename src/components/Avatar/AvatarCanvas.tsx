/**
 * AvatarCanvas - Main avatar display with insight tags
 *
 * This is a VISUAL CANVAS for displaying health insights.
 * All insights come from user-logged data, NOT from body analysis.
 *
 * The avatar is representational and symbolic - not a medical tool.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import AvatarBody from './AvatarBody';
import InsightTag from './InsightTag';
import {
  UserAvatar,
  AvatarInsight,
  REGION_POSITIONS,
  CATEGORY_TO_REGION,
  InsightCategory,
  DEFAULT_AVATAR,
  healthStateToInsights,
  RecoveryState,
  LoadState,
  EnergyState,
} from '../../types/avatar';
import { Theme } from '../../theme/colors';

// Health state response type
export interface HealthStateForAvatar {
  recovery?: { state: RecoveryState; confidence: number };
  load?: { state: LoadState; confidence: number };
  energy?: { state: EnergyState; confidence: number };
}

interface AvatarCanvasProps {
  avatar?: UserAvatar;
  insights: AvatarInsight[];
  healthState?: HealthStateForAvatar; // Health intelligence state
  theme: Theme;
  size?: number;
  onInsightPress?: (insight: AvatarInsight) => void;
  onCustomizePress?: () => void;
  showCustomizeButton?: boolean;
  showHealthDisclaimer?: boolean; // Show disclaimer when health state is displayed
  maxVisibleTags?: number;
}

// Helper to map raw insight data to AvatarInsight format
export function mapToAvatarInsight(
  id: string,
  text: string,
  shortLabel: string,
  category: InsightCategory,
  sentiment: 'positive' | 'neutral' | 'attention',
  icon: string = 'information-circle'
): AvatarInsight {
  return {
    id,
    text,
    shortLabel,
    category,
    sentiment,
    icon,
    region: CATEGORY_TO_REGION[category],
  };
}

export default function AvatarCanvas({
  avatar = DEFAULT_AVATAR,
  insights,
  healthState,
  theme,
  size = 300,
  onInsightPress,
  onCustomizePress,
  showCustomizeButton = true,
  showHealthDisclaimer = false,
  maxVisibleTags = 4,
}: AvatarCanvasProps): React.ReactElement {
  // Merge health state insights with regular insights
  const allInsights = useMemo(() => {
    const healthInsights = healthState ? healthStateToInsights(healthState) : [];
    return [...insights, ...healthInsights];
  }, [insights, healthState]);

  // Show disclaimer if health state insights are present
  const hasHealthInsights = healthState && (
    healthState.recovery || healthState.load || healthState.energy
  );

  // Limit visible tags and prioritize by sentiment
  const visibleInsights = useMemo(() => {
    // Sort: attention first, then positive, then neutral
    const sorted = [...allInsights].sort((a, b) => {
      const priority = { attention: 0, positive: 1, neutral: 2 };
      return priority[a.sentiment] - priority[b.sentiment];
    });

    // Take only unique regions (one tag per region)
    const seen = new Set<string>();
    const unique: AvatarInsight[] = [];

    for (const insight of sorted) {
      if (!seen.has(insight.region) && unique.length < maxVisibleTags) {
        seen.add(insight.region);
        unique.push(insight);
      }
    }

    return unique;
  }, [allInsights, maxVisibleTags]);

  // Container needs extra padding for tags
  const containerSize = size + 100;

  return (
    <View style={[styles.container, { width: containerSize, height: containerSize }]}>
      {/* Background gradient */}
      <Animated.View
        entering={FadeIn.duration(500)}
        style={[
          styles.background,
          { backgroundColor: theme.surface },
        ]}
      />

      {/* Avatar body centered */}
      <View style={[styles.avatarContainer, { left: 50, top: 20 }]}>
        <AvatarBody
          templateId={avatar.templateId}
          style={avatar.style}
          skinTone={avatar.skinTone}
          size={size}
          showGlow={insights.length > 0}
        />
      </View>

      {/* Insight tags positioned around avatar */}
      {visibleInsights.map((insight, index) => (
        <InsightTag
          key={insight.id}
          insight={insight}
          position={REGION_POSITIONS[insight.region]}
          containerSize={size}
          theme={theme}
          onPress={onInsightPress}
          index={index}
        />
      ))}

      {/* Empty state */}
      {insights.length === 0 && (
        <Animated.View
          entering={FadeIn.delay(300).duration(300)}
          style={styles.emptyState}
        >
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Log your meals, workouts, and sleep to see insights here
          </Text>
        </Animated.View>
      )}

      {/* Customize button */}
      {showCustomizeButton && (
        <Pressable
          style={[styles.customizeButton, { backgroundColor: theme.surface }]}
          onPress={onCustomizePress}
        >
          <Ionicons name="color-palette-outline" size={16} color={theme.accent} />
          <Text style={[styles.customizeText, { color: theme.accent }]}>
            Customize
          </Text>
        </Pressable>
      )}

      {/* Attribution - insights source */}
      <Text style={[styles.attribution, { color: theme.textSecondary }]}>
        {(showHealthDisclaimer && hasHealthInsights)
          ? 'Reflects logged patterns, not medical assessment'
          : 'Insights from your logged data'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignSelf: 'center',
  },
  background: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 40,
    borderRadius: 24,
    opacity: 0.5,
  },
  avatarContainer: {
    position: 'absolute',
  },
  emptyState: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  customizeButton: {
    position: 'absolute',
    bottom: 45,
    right: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  customizeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  attribution: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    fontSize: 10,
    textAlign: 'center',
  },
});
