/**
 * VizScatter — Scatter plot with optional trend line, theme, and tooltips.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path, G, Text as SvgText } from 'react-native-svg';
import { VizScatterData, VizTheme, DEFAULT_VIZ_THEME } from './types';
import { niceScale, mapRange, formatAxisValue } from './scales';
import VizContainer from './VizContainer';
import Tooltip, { TooltipState } from './Tooltip';

const CHART_HEIGHT = 160;
const PADDING = { top: 12, right: 12, bottom: 24, left: 36 };

interface VizScatterProps {
  data: VizScatterData;
  width: number;
  theme?: VizTheme;
}

export default function VizScatter({ data, width, theme = DEFAULT_VIZ_THEME }: VizScatterProps): React.ReactElement {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const { dots, xScale, yScale, trendPath } = useMemo(() => {
    if (data.points.length === 0) {
      return { dots: [], xScale: niceScale(0, 1), yScale: niceScale(0, 1), trendPath: '' };
    }

    const xs = data.points.map((p) => p.x);
    const ys = data.points.map((p) => p.y);
    const xSc = niceScale(Math.min(...xs), Math.max(...xs), 4);
    const ySc = niceScale(Math.min(...ys), Math.max(...ys), 4);

    const mapped = data.points.map((p) => ({
      cx: PADDING.left + mapRange(p.x, xSc.min, xSc.max, 0, chartW),
      cy: PADDING.top + mapRange(p.y, ySc.max, ySc.min, 0, chartH),
      label: p.label,
      origX: p.x,
      origY: p.y,
    }));

    let trend = '';
    if (data.trendLine && data.points.length >= 2) {
      const n = data.points.length;
      const sumX = xs.reduce((a, b) => a + b, 0);
      const sumY = ys.reduce((a, b) => a + b, 0);
      const sumXY = data.points.reduce((a, p) => a + p.x * p.y, 0);
      const sumX2 = xs.reduce((a, x) => a + x * x, 0);
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      const x0 = xSc.min;
      const x1 = xSc.max;
      const px0 = PADDING.left;
      const py0 = PADDING.top + mapRange(slope * x0 + intercept, ySc.max, ySc.min, 0, chartH);
      const px1 = PADDING.left + chartW;
      const py1 = PADDING.top + mapRange(slope * x1 + intercept, ySc.max, ySc.min, 0, chartH);
      trend = `M ${px0} ${py0} L ${px1} ${py1}`;
    }

    return { dots: mapped, xScale: xSc, yScale: ySc, trendPath: trend };
  }, [data, chartW, chartH]);

  const handlePress = useCallback((e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    let nearest = dots[0];
    let minDist = Infinity;
    for (const d of dots) {
      const dist = Math.sqrt((d.cx - locationX) ** 2 + (d.cy - locationY) ** 2);
      if (dist < minDist) { minDist = dist; nearest = d; }
    }
    if (nearest && minDist < 40) {
      setTooltip({
        x: nearest.cx,
        y: nearest.cy,
        value: nearest.origY,
        label: nearest.label ?? `${data.xLabel}: ${nearest.origX.toFixed(1)}`,
        color: theme.accent,
      });
      setTimeout(() => setTooltip(null), 2000);
    } else {
      setTooltip(null);
    }
  }, [dots, data.xLabel, theme.accent]);

  return (
    <VizContainer title={data.title} insight={data.insight} theme={theme}>
      <Pressable onPress={handlePress}>
        <View>
          <Svg width={width} height={CHART_HEIGHT}>
            {/* Grid + Y labels */}
            {yScale.ticks.map((t) => {
              const y = PADDING.top + mapRange(t, yScale.max, yScale.min, 0, chartH);
              return (
                <G key={t}>
                  <Line x1={PADDING.left} y1={y} x2={width - PADDING.right} y2={y} stroke={theme.border} strokeWidth={1} />
                  <SvgText x={PADDING.left - 4} y={y + 3} fontSize={9} fill={theme.textSecondary} textAnchor="end">
                    {formatAxisValue(t)}
                  </SvgText>
                </G>
              );
            })}

            {/* Trend line */}
            {trendPath !== '' && (
              <Path d={trendPath} stroke={theme.accent} strokeWidth={1.5} strokeDasharray="6,4" fill="none" opacity={0.6} />
            )}

            {/* Dots */}
            {dots.map((d, i) => (
              <Circle key={i} cx={d.cx} cy={d.cy} r={4} fill={theme.accent} opacity={0.75} stroke={theme.background} strokeWidth={1} />
            ))}
          </Svg>

          {tooltip && <Tooltip {...tooltip} theme={theme} />}
        </View>
      </Pressable>

      <View style={styles.axisLabels}>
        <Text style={[styles.axisLabel, { color: theme.textSecondary }]}>{data.xLabel}</Text>
        <Text style={[styles.axisLabel, { color: theme.textSecondary }]}>{data.yLabel}</Text>
      </View>
    </VizContainer>
  );
}

const styles = StyleSheet.create({
  axisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
  },
  axisLabel: {
    fontSize: 9,
  },
});
