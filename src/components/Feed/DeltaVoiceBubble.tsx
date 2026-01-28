/**
 * DeltaVoiceBubble - Conversational display of Delta's commentary.
 *
 * Shows Delta's insights in a chat-like bubble format,
 * making the AI feel more personal and direct.
 *
 * Supports different tones:
 * - positive: encouraging, celebratory
 * - neutral: informational
 * - caution: gentle warning
 * - rest: recovery-focused advice
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInLeft } from 'react-native-reanimated';
import { Theme } from '../../theme/colors';
import { FeedItemTone } from './types';

interface DeltaVoiceBubbleProps {
  theme: Theme;
  headline: string;
  body?: string;
  tone: FeedItemTone;
  showAvatar?: boolean;
  timestamp?: string;
  animated?: boolean;
}

// Tone configuration
const TONE_CONFIG: Record<FeedItemTone, {
  icon: string;
  colorKey: keyof Theme;
  avatarBg: string;
}> = {
  positive: {
    icon: 'sunny',
    colorKey: 'success',
    avatarBg: '#22c55e20',
  },
  neutral: {
    icon: 'chatbubble-ellipses',
    colorKey: 'accent',
    avatarBg: '#6366f120',
  },
  caution: {
    icon: 'alert-circle',
    colorKey: 'warning',
    avatarBg: '#f59e0b20',
  },
  rest: {
    icon: 'bed',
    colorKey: 'sleep',
    avatarBg: '#a78bfa20',
  },
};

export default function DeltaVoiceBubble({
  theme,
  headline,
  body,
  tone,
  showAvatar = true,
  timestamp,
  animated = true,
}: DeltaVoiceBubbleProps): React.ReactNode {
  const config = TONE_CONFIG[tone];
  const toneColor = theme[config.colorKey] as string;
  const styles = createStyles(theme, toneColor, config.avatarBg);

  const Container = animated ? Animated.View : View;
  const animationProps = animated
    ? { entering: SlideInLeft.springify().damping(15) }
    : {};

  return (
    <Container {...animationProps} style={styles.container}>
      {/* Delta avatar */}
      {showAvatar && (
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>D</Text>
          </View>
          <View style={[styles.toneIndicator, { backgroundColor: toneColor }]} />
        </View>
      )}

      {/* Message bubble */}
      <View style={styles.bubbleContainer}>
        <View style={styles.bubble}>
          {/* Tone icon */}
          <View style={styles.toneIconRow}>
            <Ionicons name={config.icon as any} size={14} color={toneColor} />
            <Text style={[styles.deltaLabel, { color: toneColor }]}>Delta</Text>
          </View>

          {/* Content */}
          <Text style={styles.headline}>{headline}</Text>
          {body && <Text style={styles.body}>{body}</Text>}
        </View>

        {/* Bubble tail */}
        {showAvatar && <View style={styles.bubbleTail} />}

        {/* Timestamp */}
        {timestamp && (
          <Text style={styles.timestamp}>{formatTimestamp(timestamp)}</Text>
        )}
      </View>
    </Container>
  );
}

/**
 * Compact version for dashboard/notifications.
 */
export function DeltaVoiceCompact({
  theme,
  headline,
  tone,
}: {
  theme: Theme;
  headline: string;
  tone: FeedItemTone;
}): React.ReactNode {
  const config = TONE_CONFIG[tone];
  const toneColor = theme[config.colorKey] as string;
  const styles = createCompactStyles(theme, toneColor);

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={config.icon as any} size={16} color={toneColor} />
      </View>
      <Text style={styles.text} numberOfLines={2}>
        {headline}
      </Text>
    </Animated.View>
  );
}

/**
 * Typing indicator for when Delta is "thinking".
 */
export function DeltaTypingIndicator({
  theme,
}: {
  theme: Theme;
}): React.ReactNode {
  const styles = createTypingStyles(theme);

  return (
    <Animated.View entering={FadeIn} style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>D</Text>
      </View>
      <View style={styles.bubble}>
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, styles.dot1]} />
          <Animated.View style={[styles.dot, styles.dot2]} />
          <Animated.View style={[styles.dot, styles.dot3]} />
        </View>
      </View>
    </Animated.View>
  );
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function createStyles(theme: Theme, toneColor: string, avatarBg: string) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    avatarContainer: {
      marginRight: 10,
      alignItems: 'center',
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#ffffff',
    },
    toneIndicator: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: -8,
      marginLeft: 20,
      borderWidth: 2,
      borderColor: theme.background,
    },
    bubbleContainer: {
      flex: 1,
      position: 'relative',
    },
    bubble: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderTopLeftRadius: 4,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    bubbleTail: {
      position: 'absolute',
      left: -6,
      top: 10,
      width: 0,
      height: 0,
      borderRightWidth: 8,
      borderRightColor: theme.surface,
      borderTopWidth: 6,
      borderTopColor: 'transparent',
      borderBottomWidth: 6,
      borderBottomColor: 'transparent',
    },
    toneIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    deltaLabel: {
      fontSize: 11,
      fontWeight: '600',
      marginLeft: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    headline: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textPrimary,
      lineHeight: 20,
    },
    body: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 18,
      marginTop: 6,
    },
    timestamp: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 4,
      marginLeft: 4,
    },
  });
}

function createCompactStyles(theme: Theme, toneColor: string) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    iconContainer: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: toneColor + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    text: {
      flex: 1,
      fontSize: 13,
      color: theme.textPrimary,
      lineHeight: 18,
    },
  });
}

function createTypingStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      paddingHorizontal: 4,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    avatarText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#ffffff',
    },
    bubble: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderTopLeftRadius: 4,
      padding: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    dotsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 20,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.textSecondary,
      marginHorizontal: 2,
    },
    dot1: {
      opacity: 0.4,
    },
    dot2: {
      opacity: 0.6,
    },
    dot3: {
      opacity: 0.8,
    },
  });
}
