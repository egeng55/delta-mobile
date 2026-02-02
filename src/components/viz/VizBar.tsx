/**
 * VizBar — Grouped or stacked bar chart with theme and tooltips.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Rect, Line, G, Text as SvgText } from 'react-native-svg';
import { VizBarData, VizTheme, DEFAULT_VIZ_THEME } from './types';
import { niceScale, mapRange, sparseLabels, formatAxisValue } from './scales';
import VizContainer from './VizContainer';
import Tooltip, { TooltipState } from './Tooltip';

const CHART_HEIGHT = 160;
const PADDING = { top: 12, right: 12, bottom: 4, left: 36 };

interface VizBarProps {
  data: VizBarData;
  width: number;
  onZoomChange?: (zoom: string) => void;
  theme?: VizTheme;
}

const SERIES_KEYS = ['accent', 'success', 'warning', 'heart', 'sleep'] as const;

function getColor(index: number, seriesColor: string | undefined, theme: VizTheme): string {
  if (seriesColor) return seriesColor;
  return theme[SERIES_KEYS[index % SERIES_KEYS.length] as keyof VizTheme] as string;
}

export default function VizBar({ data, width, onZoomChange, theme = DEFAULT_VIZ_THEME }: VizBarProps): React.ReactElement {
  const [activeZoom, setActiveZoom] = useState(data.timeframe.zoom);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const handleZoom = (z: string) => {
    setActiveZoom(z as any);
    onZoomChange?.(z);
  };

  const { bars, scale, labelSlots } = useMemo(() => {
    const allValues = data.series.flatMap((s) => s.data);
    if (allValues.length === 0) return { bars: [], scale: niceScale(0, 1), labelSlots: [] };

    const sc = niceScale(0, Math.max(...allValues));
    const numBars = data.series[0].data.length;
    const numSeries = data.series.length;
    const groupWidth = chartW / numBars;
    const barWidth = Math.min((groupWidth * 0.7) / numSeries, 24);
    const labels = data.labels ?? data.series[0].data.map((_, i) => String(i));

    const barRects = data.series.flatMap((series, si) => {
      const color = getColor(si, series.color, theme);
      return series.data.map((v, i) => {
        const groupX = PADDING.left + i * groupWidth + groupWidth / 2;
        const offset = (si - (numSeries - 1) / 2) * (barWidth + 2);
        const x = groupX + offset - barWidth / 2;
        const barH = mapRange(v, 0, sc.max, 0, chartH);
        const y = PADDING.top + chartH - barH;
        return { x, y, w: barWidth, h: barH, color, id: `${si}-${i}`, value: v, label: labels[i] ?? '', seriesLabel: series.label };
      });
    });

    return { bars: barRects, scale: sc, labelSlots: sparseLabels(labels, 8) };
  }, [data, chartW, chartH, theme]);

  const handlePress = useCallback((e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    for (const bar of bars) {
      if (locationX >= bar.x && locationX <= bar.x + bar.w && locationY >= bar.y && locationY <= bar.y + bar.h) {
        setTooltip({ x: bar.x + bar.w / 2, y: bar.y, value: bar.value, label: bar.label, color: bar.color });
        setTimeout(() => setTooltip(null), 2000);
        return;
      }
    }
    setTooltip(null);
  }, [bars]);

  return (
    <VizContainer
      title={data.title}
      insight={data.insight}
      zoom={activeZoom}
      onZoomChange={handleZoom}
      theme={theme}
    >
      <Pressable onPress={handlePress}>
        <View>
          <Svg width={width} height={CHART_HEIGHT}>
            {/* Grid + Y labels */}
            {scale.ticks.map((t) => {
              const y = PADDING.top + mapRange(t, scale.max, 0, 0, chartH);
              return (
                <G key={t}>
                  <Line x1={PADDING.left} y1={y} x2={width - PADDING.right} y2={y} stroke={theme.border} strokeWidth={1} />
                  <SvgText x={PADDING.left - 4} y={y + 3} fontSize={9} fill={theme.textSecondary} textAnchor="end">
                    {formatAxisValue(t)}
                  </SvgText>
                </G>
              );
            })}

            {/* Bars */}
            {bars.map((b) => (
              <Rect key={b.id} x={b.x} y={b.y} width={b.w} height={Math.max(b.h, 1)} rx={3} fill={b.color} opacity={0.85} />
            ))}
          </Svg>

          {tooltip && <Tooltip {...tooltip} theme={theme} />}
        </View>
      </Pressable>

      {/* Labels */}
      <View style={styles.xLabels}>
        {labelSlots.map((l, i) => (
          <Text key={i} style={[styles.xLabel, { color: theme.textSecondary }, !l && { opacity: 0 }]}>
            {l ?? ''}
          </Text>
        ))}
      </View>

      {data.series.length > 1 && (
        <View style={styles.legend}>
          {data.series.map((s, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: getColor(i, s.color, theme) }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
    </VizContainer>
  );
}

const styles = StyleSheet.create({
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
  },
  xLabel: {
    fontSize: 9,
  },
  legend: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
  },
});
