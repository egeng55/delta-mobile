/**
 * VizLine — Multi-series line chart with gradient fill, annotations, and tooltips.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop, G, Text as SvgText } from 'react-native-svg';
import { VizLineData, VizTheme, DEFAULT_VIZ_THEME } from './types';
import { niceScale, mapRange, sparseLabels, formatAxisValue } from './scales';
import VizContainer from './VizContainer';
import Tooltip, { TooltipState } from './Tooltip';

const CHART_HEIGHT = 160;
const PADDING = { top: 16, right: 12, bottom: 24, left: 36 };

interface VizLineProps {
  data: VizLineData;
  width: number;
  onZoomChange?: (zoom: string) => void;
  theme?: VizTheme;
}

const SERIES_COLORS_DEFAULT = ['accent', 'success', 'warning', 'heart', 'sleep', 'success'] as const;

function getSeriesColor(index: number, seriesColor: string | undefined, theme: VizTheme): string {
  if (seriesColor) return seriesColor;
  const key = SERIES_COLORS_DEFAULT[index % SERIES_COLORS_DEFAULT.length];
  return theme[key as keyof VizTheme] as string;
}

function getAnnotationColor(type: string, theme: VizTheme): string {
  switch (type) {
    case 'event': return theme.warning;
    case 'anomaly': return theme.error;
    case 'threshold': return theme.textSecondary;
    default: return theme.warning;
  }
}

export default function VizLine({ data, width, onZoomChange, theme = DEFAULT_VIZ_THEME }: VizLineProps): React.ReactElement {
  const [activeZoom, setActiveZoom] = useState(data.timeframe.zoom);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const handleZoom = (z: string) => {
    setActiveZoom(z as any);
    onZoomChange?.(z);
  };

  const { paths, scale, labelSlots, allPoints } = useMemo(() => {
    const allValues = data.series.flatMap((s) => s.data).filter((v) => v != null);
    if (allValues.length === 0) return { paths: [], scale: niceScale(0, 1), labelSlots: [], allPoints: [] };

    const sc = niceScale(Math.min(...allValues), Math.max(...allValues));
    const maxLen = Math.max(...data.series.map((s) => s.data.length));
    const labels = data.labels ?? data.series[0].data.map((_, i) => String(i));

    const allPts: Array<{ x: number; y: number; value: number; seriesLabel: string; color: string; index: number }> = [];

    const seriesPaths = data.series.map((series, si) => {
      const color = getSeriesColor(si, series.color, theme);
      const points = series.data.map((v, i) => ({
        x: PADDING.left + mapRange(i, 0, Math.max(maxLen - 1, 1), 0, chartW),
        y: PADDING.top + mapRange(v, sc.max, sc.min, 0, chartH),
      }));

      series.data.forEach((v, i) => {
        allPts.push({
          x: points[i].x,
          y: points[i].y,
          value: v,
          seriesLabel: series.label,
          color,
          index: i,
        });
      });

      const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      const gradPath = `${linePath} L ${points[points.length - 1].x} ${PADDING.top + chartH} L ${points[0].x} ${PADDING.top + chartH} Z`;

      return { linePath, gradPath, points, color, id: `grad-${si}` };
    });

    return {
      paths: seriesPaths,
      scale: sc,
      labelSlots: sparseLabels(labels, 6),
      allPoints: allPts,
    };
  }, [data, chartW, chartH, theme]);

  const handlePress = useCallback((e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    if (allPoints.length === 0) return;

    let nearest = allPoints[0];
    let minDist = Infinity;
    for (const pt of allPoints) {
      const dist = Math.sqrt((pt.x - locationX) ** 2 + (pt.y - locationY) ** 2);
      if (dist < minDist) {
        minDist = dist;
        nearest = pt;
      }
    }

    if (minDist < 40) {
      const label = data.labels?.[nearest.index] ?? `${nearest.seriesLabel}`;
      setTooltip({
        x: nearest.x,
        y: nearest.y,
        value: nearest.value,
        label,
        color: nearest.color,
      });
      setTimeout(() => setTooltip(null), 2000);
    } else {
      setTooltip(null);
    }
  }, [allPoints, data.labels]);

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
            <Defs>
              {paths.map((p) => (
                <LinearGradient key={p.id} id={p.id} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={p.color} stopOpacity={0.25} />
                  <Stop offset="100%" stopColor={p.color} stopOpacity={0.02} />
                </LinearGradient>
              ))}
            </Defs>

            {/* Grid lines + Y-axis labels */}
            {scale.ticks.map((t) => {
              const y = PADDING.top + mapRange(t, scale.max, scale.min, 0, chartH);
              return (
                <G key={t}>
                  <Line x1={PADDING.left} y1={y} x2={width - PADDING.right} y2={y} stroke={theme.border} strokeWidth={1} />
                  <SvgText x={PADDING.left - 4} y={y + 3} fontSize={9} fill={theme.textSecondary} textAnchor="end">
                    {formatAxisValue(t)}
                  </SvgText>
                </G>
              );
            })}

            {/* Series */}
            {paths.map((p) => (
              <G key={p.id}>
                <Path d={p.gradPath} fill={`url(#${p.id})`} />
                <Path d={p.linePath} stroke={p.color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                {p.points.length <= 14 && p.points.map((pt, i) => (
                  <Circle key={i} cx={pt.x} cy={pt.y} r={3} fill={p.color} stroke={theme.background} strokeWidth={1.5} />
                ))}
              </G>
            ))}

            {/* Annotations with labels */}
            {data.annotations?.map((ann, i) => {
              const labels = data.labels ?? [];
              const idx = labels.indexOf(ann.date);
              if (idx < 0) return null;
              const x = PADDING.left + mapRange(idx, 0, Math.max(labels.length - 1, 1), 0, chartW);
              const color = getAnnotationColor(ann.type, theme);
              return (
                <G key={i}>
                  <Line x1={x} y1={PADDING.top} x2={x} y2={PADDING.top + chartH} stroke={color} strokeWidth={1} strokeDasharray="3,3" opacity={0.6} />
                  <SvgText x={x + 4} y={PADDING.top - 2} fontSize={8} fill={color} textAnchor="start">
                    {ann.label}
                  </SvgText>
                </G>
              );
            })}
          </Svg>

          {tooltip && <Tooltip {...tooltip} theme={theme} />}
        </View>
      </Pressable>

      {/* X-axis labels */}
      {labelSlots.length > 0 && (
        <View style={styles.xLabels}>
          {labelSlots.map((l, i) => (
            <Text key={i} style={[styles.xLabel, { color: theme.textSecondary }, !l && styles.xLabelHidden]}>
              {l ?? ''}
            </Text>
          ))}
        </View>
      )}

      {/* Legend */}
      {data.series.length > 1 && (
        <View style={styles.legend}>
          {data.series.map((s, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: getSeriesColor(i, s.color, theme) }]} />
              <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>{s.label}</Text>
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
    marginTop: -20,
  },
  xLabel: {
    fontSize: 9,
  },
  xLabelHidden: {
    opacity: 0,
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
  legendLabel: {
    fontSize: 10,
  },
});
