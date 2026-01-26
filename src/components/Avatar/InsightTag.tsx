/**
 * InsightTag - Minimal dot indicator on avatar body regions
 *
 * Small colored dot that expands to show text only when tapped.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AvatarInsight, TagPosition } from '../../types/avatar';
import { Theme } from '../../theme/colors';

interface InsightTagProps {
  insight: AvatarInsight;
  position: TagPosition;
  containerSize: number;
  theme: Theme;
  onPress?: (insight: AvatarInsight) => void;
  index?: number;
}

const SENTIMENT_COLORS = {
  positive: '#22C55E',
  neutral: '#6366F1',
  attention: '#F59E0B',
};

export default function InsightTag({
  insight,
  position,
  containerSize,
  theme,
  onPress,
  index = 0,
}: InsightTagProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const pulseScale = useSharedValue(1);

  // Pulse animation for attention items
  React.useEffect(() => {
    if (insight.sentiment === 'attention') {
      pulseScale.value = withRepeat(
        withTiming(1.4, { duration: 800 }),
        -1,
        true
      );
    }
  }, [insight.sentiment]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: 2 - pulseScale.value, // Fade as it grows
  }));

  const color = SENTIMENT_COLORS[insight.sentiment];

  // Calculate position - center the dot on the coordinate
  const left = position.x * containerSize - 5;
  const top = position.y * containerSize - 5;

  const handlePress = () => {
    setExpanded(!expanded);
    onPress?.(insight);
  };

  return (
    <Animated.View
      entering={FadeIn.delay(index * 80).duration(200)}
      style={[styles.container, { left, top }]}
    >
      <Pressable onPress={handlePress} hitSlop={12}>
        {/* Pulse ring for attention */}
        {insight.sentiment === 'attention' && (
          <Animated.View
            style={[
              styles.pulseRing,
              { borderColor: color },
              pulseStyle,
            ]}
          />
        )}

        {/* Dot */}
        <View style={[styles.dot, { backgroundColor: color }]} />

        {/* Expanded label */}
        {expanded && (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(100)}
            style={[
              styles.label,
              {
                backgroundColor: theme.surface,
                borderColor: color,
                [position.anchor === 'right' ? 'right' : 'left']: 14,
              },
            ]}
          >
            <Ionicons name={insight.icon as any} size={11} color={color} />
            <Text style={[styles.labelText, { color: theme.textPrimary }]} numberOfLines={2}>
              {insight.shortLabel}
            </Text>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  pulseRing: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  label: {
    position: 'absolute',
    top: -6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
    maxWidth: 120,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '500',
    flex: 1,
  },
});
