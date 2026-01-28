/**
 * InlineChart - Mini chart for in-conversation visualizations.
 *
 * Renders a small sparkline-style chart inline in chat messages
 * when Delta discusses patterns or trends.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Theme } from '../theme/colors';

interface InlineChartProps {
  theme: Theme;
  data: number[];
  label?: string;
  unit?: string;
  color?: string;
  height?: number;
}

export default function InlineChart({
  theme,
  data,
  label,
  unit,
  color,
  height = 48,
}: InlineChartProps): React.ReactNode {
  if (!data || data.length < 2) return null;

  const chartColor = color || theme.accent;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const styles = createStyles(theme, chartColor, height);

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {unit && (
            <Text style={styles.currentValue}>
              {data[data.length - 1]}{unit}
            </Text>
          )}
        </View>
      )}
      <View style={styles.chartContainer}>
        {data.map((value, index) => {
          const normalizedHeight = ((value - min) / range) * height;
          const barHeight = Math.max(normalizedHeight, 2);
          return (
            <View key={index} style={styles.barWrapper}>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    opacity: 0.4 + (index / data.length) * 0.6,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(theme: Theme, chartColor: string, height: number) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 10,
      marginVertical: 8,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    label: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    currentValue: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    chartContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: height,
      gap: 2,
    },
    barWrapper: {
      flex: 1,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    bar: {
      width: '80%',
      backgroundColor: chartColor,
      borderRadius: 2,
      minHeight: 2,
    },
  });
}
