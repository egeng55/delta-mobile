/**
 * QuickLog - 1-tap logging for mood, energy, stress, water.
 *
 * Horizontal scrolling cards with 1-5 scale.
 * No scores, no gauges - just fast input.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, withSpring, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Theme } from '../theme/colors';

type QuickLogMetric = 'mood' | 'energy' | 'stress' | 'water';

interface QuickLogProps {
  theme: Theme;
  onLog: (metric: QuickLogMetric, value: number) => Promise<void>;
  currentValues?: Partial<Record<QuickLogMetric, number | null>>;
}

const METRICS: Array<{
  key: QuickLogMetric;
  label: string;
  icon: string;
  colorKey: keyof Theme;
  scale: string[];
}> = [
  {
    key: 'mood',
    label: 'Mood',
    icon: 'happy-outline',
    colorKey: 'accent',
    scale: ['Awful', 'Bad', 'Okay', 'Good', 'Great'],
  },
  {
    key: 'energy',
    label: 'Energy',
    icon: 'flash-outline',
    colorKey: 'warning',
    scale: ['Empty', 'Low', 'Mid', 'High', 'Peak'],
  },
  {
    key: 'stress',
    label: 'Stress',
    icon: 'pulse-outline',
    colorKey: 'error',
    scale: ['None', 'Low', 'Some', 'High', 'Max'],
  },
  {
    key: 'water',
    label: 'Water',
    icon: 'water-outline',
    colorKey: 'sleep',
    scale: ['0', '1-2', '3-4', '5-6', '7+'],
  },
];

export default function QuickLog({
  theme,
  onLog,
  currentValues = {},
}: QuickLogProps): React.ReactNode {
  const [loadingMetric, setLoadingMetric] = useState<string | null>(null);
  const styles = createStyles(theme);

  const handleLog = async (metric: QuickLogMetric, value: number): Promise<void> => {
    setLoadingMetric(metric);
    try {
      await onLog(metric, value);
    } finally {
      setLoadingMetric(null);
    }
  };

  return (
    <View style={styles.container}>
      {METRICS.map((metric, metricIndex) => {
        const currentVal = currentValues[metric.key];
        const metricColor = theme[metric.colorKey] as string;

        return (
          <Animated.View
            key={metric.key}
            entering={FadeInDown.delay(metricIndex * 50).springify()}
            style={styles.metricCard}
          >
            <View style={styles.metricHeader}>
              <View style={[styles.metricIcon, { backgroundColor: metricColor + '20' }]}>
                <Ionicons name={metric.icon as any} size={16} color={metricColor} />
              </View>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              {currentVal !== null && currentVal !== undefined && (
                <View style={[styles.loggedBadge, { backgroundColor: metricColor + '20' }]}>
                  <Text style={[styles.loggedText, { color: metricColor }]}>
                    {metric.scale[currentVal - 1] || currentVal}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.scaleRow}>
              {[1, 2, 3, 4, 5].map((value) => {
                const isSelected = currentVal === value;
                const isLoading = loadingMetric === metric.key;
                return (
                  <Pressable
                    key={value}
                    style={[
                      styles.scaleButton,
                      isSelected && { backgroundColor: metricColor, borderColor: metricColor },
                    ]}
                    onPress={() => handleLog(metric.key, value)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={metricColor} />
                    ) : (
                      <Text
                        style={[
                          styles.scaleValue,
                          isSelected && { color: '#fff', fontWeight: '700' },
                        ]}
                      >
                        {value}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.scaleLabels}>
              <Text style={styles.scaleLabelText}>{metric.scale[0]}</Text>
              <Text style={styles.scaleLabelText}>{metric.scale[4]}</Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: 8,
    },
    metricCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    metricHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    metricIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    metricLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
      flex: 1,
    },
    loggedBadge: {
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    loggedText: {
      fontSize: 11,
      fontWeight: '600',
    },
    scaleRow: {
      flexDirection: 'row',
      gap: 6,
    },
    scaleButton: {
      flex: 1,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    scaleValue: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    scaleLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
      paddingHorizontal: 2,
    },
    scaleLabelText: {
      fontSize: 10,
      color: theme.textSecondary,
    },
  });
}
