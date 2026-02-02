/**
 * VizComparison — Side-by-side metric comparison with theme support.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VizComparisonData, VizTheme, DEFAULT_VIZ_THEME } from './types';
import VizContainer from './VizContainer';

interface VizComparisonProps {
  data: VizComparisonData;
  width: number;
  theme?: VizTheme;
}

export default function VizComparison({ data, width, theme = DEFAULT_VIZ_THEME }: VizComparisonProps): React.ReactElement {
  return (
    <VizContainer title={data.title} insight={data.insight} theme={theme}>
      {/* Column headers */}
      <View style={[styles.headerRow, { borderBottomColor: theme.border }]}>
        <View style={styles.metricCol} />
        <Text style={[styles.colHeader, styles.colA, { color: theme.textSecondary }]}>{data.labelA}</Text>
        <Text style={[styles.colHeader, styles.colB, { color: theme.textSecondary }]}>{data.labelB}</Text>
        <Text style={[styles.colHeader, styles.colDelta, { color: theme.textSecondary }]}>Change</Text>
      </View>

      {data.metrics.map((m, i) => {
        const diff = m.valueB - m.valueA;
        const pct = m.valueA !== 0 ? (diff / m.valueA) * 100 : 0;
        const better = m.higherIsBetter !== false ? diff > 0 : diff < 0;
        const diffColor = diff === 0 ? theme.textSecondary : better ? theme.success : theme.heart;
        const sign = diff > 0 ? '+' : '';

        return (
          <View key={i} style={[styles.row, i % 2 === 0 && { backgroundColor: theme.surface + '40', borderRadius: 4 }]}>
            <Text style={[styles.metricLabel, { color: theme.textPrimary }]} numberOfLines={1}>{m.label}</Text>
            <Text style={[styles.value, { color: theme.textPrimary }]}>{m.valueA.toFixed(1)}{m.unit ? ` ${m.unit}` : ''}</Text>
            <Text style={[styles.value, { color: theme.textPrimary }]}>{m.valueB.toFixed(1)}{m.unit ? ` ${m.unit}` : ''}</Text>
            <Text style={[styles.delta, { color: diffColor }]}>
              {sign}{pct.toFixed(0)}%
            </Text>
          </View>
        );
      })}
    </VizContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  metricCol: {
    flex: 2,
  },
  colHeader: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  colA: { flex: 1.5 },
  colB: { flex: 1.5 },
  colDelta: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  metricLabel: {
    flex: 2,
    fontSize: 12,
    fontWeight: '500',
  },
  value: {
    flex: 1.5,
    fontSize: 12,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  delta: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
