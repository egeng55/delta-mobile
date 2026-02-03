/**
 * ModuleRenderer — Renders a single DeltaModule from backend.
 *
 * Three layout branches: compact (pill), standard (card), wide (card + viz).
 * Frontend is a dumb renderer — layout, priority, tone, viz all come from backend.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Theme } from '../theme/colors';
import { DeltaModule, ZoomLevel } from '../services/api';
import { WeeklySummary } from '../hooks/useInsightsData';
import { VizTheme, VizLineData, VizBarData } from './viz/types';
import VizLine from './viz/VizLine';
import VizBar from './viz/VizBar';
import { getToneColor, themeToVizTheme, formatDateLabel } from '../utils/themeUtils';

interface ModuleRendererProps {
  module: DeltaModule;
  weeklySummaries: WeeklySummary[];
  theme: Theme;
  onPress?: (module: DeltaModule) => void;
  index?: number;
  chartWidth?: number;
}

const ZOOM_RANGES: Record<ZoomLevel, number> = {
  day: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

export default function ModuleRenderer({
  module,
  weeklySummaries,
  theme,
  onPress,
  index = 0,
  chartWidth = 300,
}: ModuleRendererProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState<ZoomLevel>(module.viz?.zoom ?? 'week');
  const toneColor = getToneColor(module.tone, theme);
  const vizTheme = useMemo(() => themeToVizTheme(theme), [theme]);

  const slicedData = useMemo(() => {
    if (!module.viz) return [];
    const days = ZOOM_RANGES[zoom];
    const cutoff = new Date(Date.now() - days * 86400000);
    return weeklySummaries.filter(w => new Date(w.date) >= cutoff);
  }, [weeklySummaries, zoom, module.viz]);

  const handlePress = () => {
    if (module.layout === 'compact') {
      onPress?.(module);
    } else {
      setExpanded(prev => !prev);
      onPress?.(module);
    }
  };

  // ---- COMPACT LAYOUT ----
  if (module.layout === 'compact') {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.compactPill,
          { borderLeftColor: toneColor, borderLeftWidth: 3, backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
        ]}
        onPress={handlePress}
      >
        <Ionicons name={module.icon as any} size={16} color={toneColor} />
        <Text style={[styles.compactText, { color: theme.textPrimary }]} numberOfLines={1}>
          {module.metric_value || module.brief}
        </Text>
      </Pressable>
    );
  }

  // ---- STANDARD LAYOUT ----
  if (module.layout === 'standard') {
    return (
      <Animated.View entering={FadeInDown.delay(index * 80 + 100).duration(400)}>
        <Pressable
          style={({ pressed }) => [
            styles.standardCard,
            { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.95 : 1 },
          ]}
          onPress={handlePress}
        >
          <View style={[styles.standardAccent, { backgroundColor: toneColor }]} />
          <View style={styles.standardBody}>
            <View style={styles.standardHeader}>
              <View style={[styles.standardIcon, { backgroundColor: toneColor + '20' }]}>
                <Ionicons name={module.icon as any} size={18} color={toneColor} />
              </View>
              <View style={styles.standardTitleArea}>
                <Text style={[styles.standardTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                  {module.brief}
                </Text>
                {module.metric_value && (
                  <Text style={[styles.standardMetric, { color: toneColor }]}>
                    {module.metric_value}
                  </Text>
                )}
              </View>
            </View>
            {expanded && module.detail && (
              <Text style={[styles.standardDetail, { color: theme.textSecondary }]}>
                {module.detail}
              </Text>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  // ---- WIDE LAYOUT ----
  return (
    <Animated.View entering={FadeInDown.delay(index * 80 + 100).duration(400)}>
      <Pressable
        style={({ pressed }) => [
          styles.wideCard,
          { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.95 : 1 },
        ]}
        onPress={handlePress}
      >
        <View style={styles.wideHeader}>
          <Ionicons name={module.icon as any} size={18} color={toneColor} />
          <Text style={[styles.wideTitle, { color: theme.textPrimary }]} numberOfLines={1}>
            {module.brief}
          </Text>
        </View>

        {expanded && module.detail && (
          <Text style={[styles.wideDetail, { color: theme.textSecondary }]}>
            {module.detail}
          </Text>
        )}

        {module.viz && slicedData.length > 0 && (
          <View style={styles.vizArea}>
            {renderVizChart(module, slicedData, chartWidth - 56, vizTheme, (z) => setZoom(z as ZoomLevel))}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function renderVizChart(
  module: DeltaModule,
  data: WeeklySummary[],
  width: number,
  vizTheme: VizTheme,
  onZoomChange?: (zoom: string) => void,
): React.ReactNode {
  if (!module.viz || data.length === 0) return null;

  const metric = module.viz.metric as keyof WeeklySummary;
  const values = data
    .map(w => (w[metric] as number | null) ?? 0)
    .filter(v => typeof v === 'number');
  const labels = data.map(w => formatDateLabel(w.date));

  if (values.length === 0) return null;

  if (module.viz.chart_type === 'line') {
    const vizData: VizLineData = {
      type: 'line',
      id: module.id,
      title: module.viz.title,
      timeframe: { start: data[0].date, end: data[data.length - 1].date, zoom: module.viz.zoom },
      series: [{ label: module.viz.title, data: values }],
      labels,
    };
    return <VizLine data={vizData} width={width} onZoomChange={onZoomChange} theme={vizTheme} />;
  }

  if (module.viz.chart_type === 'bar') {
    const vizData: VizBarData = {
      type: 'bar',
      id: module.id,
      title: module.viz.title,
      timeframe: { start: data[0].date, end: data[data.length - 1].date, zoom: module.viz.zoom },
      series: [{ label: module.viz.title, data: values }],
      labels,
    };
    return <VizBar data={vizData} width={width} onZoomChange={onZoomChange} theme={vizTheme} />;
  }

  // Fallback: line chart for unsupported types
  const vizData: VizLineData = {
    type: 'line',
    id: module.id,
    title: module.viz.title,
    timeframe: { start: data[0].date, end: data[data.length - 1].date, zoom: module.viz.zoom },
    series: [{ label: module.viz.title, data: values }],
    labels,
  };
  return <VizLine data={vizData} width={width} onZoomChange={onZoomChange} theme={vizTheme} />;
}

/** Render compact modules as a horizontal scroll row */
export function CompactModuleRow({
  modules,
  theme,
  onPress,
}: {
  modules: DeltaModule[];
  theme: Theme;
  onPress?: (module: DeltaModule) => void;
}): React.ReactNode {
  if (modules.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.compactRow}>
      {modules.map(m => (
        <ModuleRenderer key={m.id} module={m} weeklySummaries={[]} theme={theme} onPress={onPress} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Compact
  compactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    gap: 6,
    marginRight: 8,
  },
  compactText: {
    fontSize: 13,
    fontWeight: '500',
  },
  compactRow: {
    marginBottom: 12,
    paddingLeft: 4,
  },
  // Standard
  standardCard: {
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  standardAccent: {
    height: 3,
    width: '100%',
  },
  standardBody: {
    padding: 14,
  },
  standardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  standardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  standardTitleArea: {
    flex: 1,
  },
  standardTitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  standardMetric: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  standardDetail: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  // Wide
  wideCard: {
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  wideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  wideTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  wideDetail: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  vizArea: {
    marginTop: 12,
    marginHorizontal: -4,
  },
});
