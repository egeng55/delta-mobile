/**
 * Tooltip — Shared tooltip overlay for chart data points.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { VizTheme } from './types';

export interface TooltipState {
  x: number;
  y: number;
  value: number;
  label: string;
  color: string;
}

interface TooltipProps extends TooltipState {
  theme: VizTheme;
}

export default function Tooltip({ x, y, value, label, color, theme }: TooltipProps): React.ReactElement {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 150 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const formattedValue = Number.isInteger(value) ? value.toString() : value.toFixed(1);

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        {
          left: Math.max(4, Math.min(x - 40, 240)),
          top: Math.max(0, y - 36),
          backgroundColor: theme.surface,
          borderColor: color,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.value, { color: theme.textPrimary }]}>{formattedValue}</Text>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    zIndex: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  value: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 9,
  },
});
