/**
 * ProactiveCard - Agent-surfaced insights shown above chat input.
 *
 * Delta surfaces 1-2 things it wants to tell the user:
 * - Predictions resolving
 * - Patterns discovered
 * - Data gaps needing attention
 * - Milestones reached
 *
 * Frosted glass aesthetic with confidence indicators.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { Theme } from '../theme/colors';
import { AgentAction } from '../services/api';

interface ProactiveCardProps {
  theme: Theme;
  action: AgentAction;
  onPress: (action: AgentAction) => void;
  onDismiss: (actionId: string) => void;
  index?: number;
}

const TYPE_CONFIG: Record<string, { icon: string; colorKey: keyof Theme }> = {
  prediction_resolving: { icon: 'time-outline', colorKey: 'accent' },
  pattern_discovered: { icon: 'sparkles', colorKey: 'success' },
  data_gap: { icon: 'alert-circle-outline', colorKey: 'warning' },
  milestone: { icon: 'trophy-outline', colorKey: 'accent' },
  insight: { icon: 'bulb-outline', colorKey: 'accent' },
};

export default function ProactiveCard({
  theme,
  action,
  onPress,
  onDismiss,
  index = 0,
}: ProactiveCardProps): React.ReactNode {
  const config = TYPE_CONFIG[action.type] || TYPE_CONFIG.insight;
  const iconColor = theme[config.colorKey] as string;
  const styles = createStyles(theme, iconColor);

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 100).springify()}
      exiting={FadeOutDown.duration(200)}
    >
      <Pressable style={styles.container} onPress={() => onPress(action)}>
        <View style={styles.iconContainer}>
          <Ionicons name={config.icon as any} size={18} color={iconColor} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>{action.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{action.body}</Text>
          {action.action_label && (
            <View style={styles.actionPill}>
              <Text style={styles.actionLabel}>{action.action_label}</Text>
            </View>
          )}
        </View>
        <Pressable
          style={styles.dismissButton}
          onPress={() => onDismiss(action.id)}
          hitSlop={8}
        >
          <Ionicons name="close" size={16} color={theme.textSecondary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

interface ProactiveCardsListProps {
  theme: Theme;
  actions: AgentAction[];
  onActionPress: (action: AgentAction) => void;
  onDismiss: (actionId: string) => void;
}

export function ProactiveCardsList({
  theme,
  actions,
  onActionPress,
  onDismiss,
}: ProactiveCardsListProps): React.ReactNode {
  if (actions.length === 0) return null;

  // Show max 2 cards
  const visibleActions = actions.slice(0, 2);

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
      {visibleActions.map((action, index) => (
        <ProactiveCard
          key={action.id}
          theme={theme}
          action={action}
          onPress={onActionPress}
          onDismiss={onDismiss}
          index={index}
        />
      ))}
    </View>
  );
}

function createStyles(theme: Theme, iconColor: string) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.mode === 'dark' ? '#6366F126' : theme.accentLight,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.mode === 'dark' ? '#6366F120' : theme.border,
    },
    iconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: iconColor + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 2,
    },
    body: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    actionPill: {
      alignSelf: 'flex-start',
      backgroundColor: theme.accent + '20',
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginTop: 8,
    },
    actionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.accent,
    },
    dismissButton: {
      padding: 4,
      marginLeft: 4,
    },
  });
}
