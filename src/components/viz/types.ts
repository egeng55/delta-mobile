/**
 * Types for Delta's visual analytics framework.
 * Delta-viz blocks in chat responses use these types.
 */

export type VizType = 'line' | 'bar' | 'scatter' | 'heatmap' | 'distribution' | 'comparison';

export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface VizTimeframe {
  start: string;
  end: string;
  zoom: ZoomLevel;
}

export interface VizAnnotation {
  date: string;
  label: string;
  type: 'event' | 'threshold' | 'anomaly';
}

export interface VizSeries {
  label: string;
  data: number[];
  color?: string;
}

export interface VizDataPoint {
  x: number;
  y: number;
  label?: string;
}

/** Line chart data */
export interface VizLineData {
  type: 'line';
  id?: string;
  title: string;
  timeframe: VizTimeframe;
  series: VizSeries[];
  labels?: string[];
  annotations?: VizAnnotation[];
  insight?: string;
}

/** Bar chart data */
export interface VizBarData {
  type: 'bar';
  id?: string;
  title: string;
  timeframe: VizTimeframe;
  series: VizSeries[];
  labels?: string[];
  stacked?: boolean;
  insight?: string;
}

/** Scatter plot data */
export interface VizScatterData {
  type: 'scatter';
  id?: string;
  title: string;
  xLabel: string;
  yLabel: string;
  points: VizDataPoint[];
  trendLine?: boolean;
  insight?: string;
}

/** Heatmap data (7 columns for days of week) */
export interface VizHeatmapData {
  type: 'heatmap';
  id?: string;
  title: string;
  xLabels: string[];
  yLabels: string[];
  values: number[][];
  colorScale?: { low: string; high: string };
  insight?: string;
}

/** Distribution / histogram data */
export interface VizDistributionData {
  type: 'distribution';
  id?: string;
  title: string;
  label: string;
  values: number[];
  bins?: number;
  mean?: number;
  insight?: string;
}

/** Comparison (before/after or A vs B) */
export interface VizComparisonData {
  type: 'comparison';
  id?: string;
  title: string;
  labelA: string;
  labelB: string;
  metrics: Array<{
    label: string;
    valueA: number;
    valueB: number;
    unit?: string;
    higherIsBetter?: boolean;
  }>;
  insight?: string;
}

export type VizData =
  | VizLineData
  | VizBarData
  | VizScatterData
  | VizHeatmapData
  | VizDistributionData
  | VizComparisonData;

/** Theme colors for viz components — matches Theme from colors.ts */
export interface VizTheme {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  border: string;
  warning: string;
  success: string;
  error: string;
  sleep: string;
  heart: string;
}

/** Default dark theme for viz (fallback if no theme passed) */
export const DEFAULT_VIZ_THEME: VizTheme = {
  background: '#0A0A0F',
  surface: '#14141F',
  textPrimary: '#fafafa',
  textSecondary: '#737373',
  accent: '#6366F1',
  border: '#1E1E2E',
  warning: '#FBBF24',
  success: '#5EEAD4',
  error: '#f87171',
  sleep: '#a78bfa',
  heart: '#fb7185',
};
