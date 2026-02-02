/**
 * VizDistribution — Histogram / distribution chart with theme and Y-axis labels.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, G, Text as SvgText } from 'react-native-svg';
import { VizDistributionData, VizTheme, DEFAULT_VIZ_THEME } from './types';
import { histogram, mapRange } from './scales';
import VizContainer from './VizContainer';

const CHART_HEIGHT = 140;
const PADDING = { top: 8, right: 12, bottom: 20, left: 12 };

interface VizDistributionProps {
  data: VizDistributionData;
  width: number;
  theme?: VizTheme;
}

export default function VizDistribution({ data, width, theme = DEFAULT_VIZ_THEME }: VizDistributionProps): React.ReactElement {
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const binCount = data.bins ?? 10;

  const { bars, meanX, minLabel, maxLabel } = useMemo(() => {
    const { bins, max } = histogram(data.values, binCount);
    if (bins.length === 0) return { bars: [], meanX: null, minLabel: '', maxLabel: '' };

    const barW = chartW / bins.length - 2;
    const mapped = bins.map((b, i) => ({
      x: PADDING.left + i * (chartW / bins.length) + 1,
      y: PADDING.top + chartH - mapRange(b.count, 0, max, 0, chartH),
      w: barW,
      h: mapRange(b.count, 0, max, 0, chartH),
      key: i,
    }));

    let mx: number | null = null;
    if (data.mean !== undefined) {
      const allMin = bins[0].x0;
      const allMax = bins[bins.length - 1].x1;
      mx = PADDING.left + mapRange(data.mean, allMin, allMax, 0, chartW);
    }

    return {
      bars: mapped,
      meanX: mx,
      minLabel: bins[0].x0.toFixed(1),
      maxLabel: bins[bins.length - 1].x1.toFixed(1),
    };
  }, [data, chartW, chartH, binCount]);

  return (
    <VizContainer title={data.title} insight={data.insight} theme={theme}>
      <Svg width={width} height={CHART_HEIGHT}>
        {bars.map((b) => (
          <Rect key={b.key} x={b.x} y={b.y} width={b.w} height={Math.max(b.h, 1)} rx={2} fill={theme.accent} opacity={0.7} />
        ))}
        {meanX !== null && (
          <Line x1={meanX} y1={PADDING.top} x2={meanX} y2={PADDING.top + chartH} stroke={theme.warning} strokeWidth={1.5} strokeDasharray="4,3" />
        )}
      </Svg>

      <View style={styles.xLabels}>
        <Text style={[styles.xLabel, { color: theme.textSecondary }]}>{minLabel}</Text>
        {data.mean !== undefined && <Text style={[styles.xLabel, { color: theme.warning }]}>avg {data.mean.toFixed(1)}</Text>}
        <Text style={[styles.xLabel, { color: theme.textSecondary }]}>{maxLabel}</Text>
      </View>
    </VizContainer>
  );
}

const styles = StyleSheet.create({
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: -16,
  },
  xLabel: {
    fontSize: 9,
  },
});
