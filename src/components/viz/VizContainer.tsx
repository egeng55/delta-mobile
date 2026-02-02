/**
 * VizContainer — Shared wrapper for all chart types.
 * Provides title, zoom controls, insight caption, frosted glass card, loading skeleton.
 */

import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { ZoomLevel, VizTheme, DEFAULT_VIZ_THEME } from './types';

const ZOOM_LEVELS: ZoomLevel[] = ['day', 'week', 'month', 'quarter', 'year'];
const ZOOM_LABELS: Record<ZoomLevel, string> = {
  day: 'D',
  week: 'W',
  month: 'M',
  quarter: 'Q',
  year: 'Y',
};

interface VizContainerProps {
  title: string;
  insight?: string;
  zoom?: ZoomLevel;
  onZoomChange?: (zoom: ZoomLevel) => void;
  theme?: VizTheme;
  loading?: boolean;
  children: React.ReactNode;
}

function LoadingSkeleton({ theme }: { theme: VizTheme }): React.ReactElement {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={skeletonStyles.container}>
      <Animated.View
        style={[
          skeletonStyles.titleBar,
          { backgroundColor: theme.border },
          animatedStyle,
        ]}
      />
      <Animated.View
        style={[
          skeletonStyles.chartArea,
          { backgroundColor: theme.border },
          animatedStyle,
        ]}
      />
      <Animated.View
        style={[
          skeletonStyles.insightBar,
          { backgroundColor: theme.border },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  container: {
    padding: 4,
    gap: 8,
  },
  titleBar: {
    height: 12,
    width: '50%',
    borderRadius: 6,
  },
  chartArea: {
    height: 140,
    borderRadius: 8,
  },
  insightBar: {
    height: 10,
    width: '70%',
    borderRadius: 5,
  },
});

export default function VizContainer({
  title,
  insight,
  zoom,
  onZoomChange,
  theme = DEFAULT_VIZ_THEME,
  loading,
  children,
}: VizContainerProps): React.ReactElement {
  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: theme.accent + '0D', borderColor: theme.accent + '1A' }]}>
        <LoadingSkeleton theme={theme} />
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.accent + '0D', borderColor: theme.accent + '1A' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
        {zoom && onZoomChange && (
          <View style={styles.zoomRow}>
            {ZOOM_LEVELS.map((z) => (
              <Pressable
                key={z}
                style={[styles.zoomButton, z === zoom && { backgroundColor: theme.accent }]}
                onPress={() => onZoomChange(z)}
              >
                <Text style={[styles.zoomLabel, { color: theme.textSecondary }, z === zoom && styles.zoomLabelActive]}>
                  {ZOOM_LABELS[z]}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {children}

      {insight && (
        <Text style={[styles.insight, { color: theme.sleep }]}>{insight}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  zoomRow: {
    flexDirection: 'row',
    gap: 2,
  },
  zoomButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  zoomLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  zoomLabelActive: {
    color: '#fff',
  },
  insight: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
