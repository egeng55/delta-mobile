/**
 * VizHeatmap — Grid heatmap for weekly/hourly patterns.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { VizHeatmapData, VizTheme, DEFAULT_VIZ_THEME } from './types';
import VizContainer from './VizContainer';

const CELL_SIZE = 18;
const CELL_GAP = 2;

interface VizHeatmapProps {
  data: VizHeatmapData;
  width: number;
  theme?: VizTheme;
}

function interpolateColor(t: number, low: string, high: string): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [r0, g0, b0] = parse(low);
  const [r1, g1, b1] = parse(high);
  const r = Math.round(r0 + (r1 - r0) * t);
  const g = Math.round(g0 + (g1 - g0) * t);
  const b = Math.round(b0 + (b1 - b0) * t);
  return `rgb(${r},${g},${b})`;
}

export default function VizHeatmap({ data, width, theme = DEFAULT_VIZ_THEME }: VizHeatmapProps): React.ReactElement {
  const lowColor = data.colorScale?.low ?? theme.surface;
  const highColor = data.colorScale?.high ?? theme.accent;

  const { cells, svgH } = useMemo(() => {
    const rows = data.values.length;
    const cols = data.values[0]?.length ?? 0;
    const allVals = data.values.flat();
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const range = max - min || 1;

    const mapped = data.values.flatMap((row, ri) =>
      row.map((val, ci) => ({
        x: 32 + ci * (CELL_SIZE + CELL_GAP),
        y: ri * (CELL_SIZE + CELL_GAP),
        color: interpolateColor((val - min) / range, lowColor, highColor),
        key: `${ri}-${ci}`,
      }))
    );

    return { cells: mapped, svgH: rows * (CELL_SIZE + CELL_GAP) };
  }, [data, lowColor, highColor]);

  return (
    <VizContainer title={data.title} insight={data.insight} theme={theme}>
      <View style={styles.grid}>
        <View style={styles.yLabels}>
          {data.yLabels.map((l, i) => (
            <Text key={i} style={[styles.yLabel, { color: theme.textSecondary, height: CELL_SIZE + CELL_GAP }]}>{l}</Text>
          ))}
        </View>

        <View>
          <View style={styles.xLabels}>
            {data.xLabels.map((l, i) => (
              <Text key={i} style={[styles.xLabel, { color: theme.textSecondary, width: CELL_SIZE + CELL_GAP }]}>{l}</Text>
            ))}
          </View>

          <Svg width={data.xLabels.length * (CELL_SIZE + CELL_GAP)} height={svgH}>
            {cells.map((c) => (
              <Rect key={c.key} x={c.x - 32} y={c.y} width={CELL_SIZE} height={CELL_SIZE} rx={3} fill={c.color} />
            ))}
          </Svg>
        </View>
      </View>
    </VizContainer>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
  },
  yLabels: {
    marginRight: 4,
    justifyContent: 'flex-start',
  },
  yLabel: {
    fontSize: 8,
    textAlign: 'right',
    lineHeight: CELL_SIZE + CELL_GAP,
  },
  xLabels: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  xLabel: {
    fontSize: 8,
    textAlign: 'center',
  },
});
