/**
 * VizRenderer — Parses a delta-viz JSON block and renders the right chart.
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { VizData, VizTheme, DEFAULT_VIZ_THEME } from './types';
import VizLine from './VizLine';
import VizBar from './VizBar';
import VizScatter from './VizScatter';
import VizHeatmap from './VizHeatmap';
import VizDistribution from './VizDistribution';
import VizComparison from './VizComparison';

interface VizRendererProps {
  json: string;
  onZoomChange?: (vizId: string, newZoom: string) => void;
  theme?: VizTheme;
  width?: number;
}

/** Parse a delta-viz JSON string and render the appropriate chart. */
export default function VizRenderer({ json, onZoomChange, theme = DEFAULT_VIZ_THEME, width: propWidth }: VizRendererProps): React.ReactElement {
  const width = propWidth ?? Dimensions.get('window').width - 48;

  let data: VizData;
  try {
    data = JSON.parse(json) as VizData;
  } catch {
    return (
      <View style={[styles.error, { backgroundColor: theme.surface }]}>
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>Could not render visualization</Text>
      </View>
    );
  }

  const handleZoom = (zoom: string) => {
    onZoomChange?.(data.id ?? '', zoom);
  };

  switch (data.type) {
    case 'line':
      return <VizLine data={data} width={width} onZoomChange={handleZoom} theme={theme} />;
    case 'bar':
      return <VizBar data={data} width={width} onZoomChange={handleZoom} theme={theme} />;
    case 'scatter':
      return <VizScatter data={data} width={width} theme={theme} />;
    case 'heatmap':
      return <VizHeatmap data={data} width={width} theme={theme} />;
    case 'distribution':
      return <VizDistribution data={data} width={width} theme={theme} />;
    case 'comparison':
      return <VizComparison data={data} width={width} theme={theme} />;
    default:
      return (
        <View style={[styles.error, { backgroundColor: theme.surface }]}>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>Unknown chart type: {(data as any).type}</Text>
        </View>
      );
  }
}

/** Try to extract delta-viz blocks from markdown text. Returns segments (text or viz). */
export function parseDeltaVizBlocks(
  markdown: string
): Array<{ type: 'text'; content: string } | { type: 'viz'; json: string }> {
  const segments: Array<{ type: 'text'; content: string } | { type: 'viz'; json: string }> = [];
  const regex = /```delta-viz\s*\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: markdown.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'viz', json: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < markdown.length) {
    segments.push({ type: 'text', content: markdown.slice(lastIndex) });
  }

  return segments;
}

const styles = StyleSheet.create({
  error: {
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
  },
  errorText: {
    fontSize: 12,
  },
});
