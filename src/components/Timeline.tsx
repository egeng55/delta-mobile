/**
 * Timeline - Vertical chronological view of everything logged today.
 *
 * Shows timestamps and entries in a clean vertical flow.
 * No analysis, no scores - just what you did and when.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInLeft } from 'react-native-reanimated';
import { Theme } from '../theme/colors';

export interface TimelineEntry {
  id: string;
  time: string;
  type: 'meal' | 'workout' | 'sleep' | 'mood' | 'water' | 'weight' | 'note';
  title: string;
  subtitle?: string;
  value?: string;
}

interface TimelineProps {
  theme: Theme;
  entries: TimelineEntry[];
}

const TYPE_CONFIG: Record<string, { icon: string; colorKey: keyof Theme }> = {
  meal: { icon: 'restaurant-outline', colorKey: 'success' },
  workout: { icon: 'barbell-outline', colorKey: 'warning' },
  sleep: { icon: 'bed-outline', colorKey: 'sleep' },
  mood: { icon: 'happy-outline', colorKey: 'accent' },
  water: { icon: 'water-outline', colorKey: 'sleep' },
  weight: { icon: 'scale-outline', colorKey: 'textSecondary' },
  note: { icon: 'document-text-outline', colorKey: 'textSecondary' },
};

export default function Timeline({
  theme,
  entries,
}: TimelineProps): React.ReactNode {
  const styles = createStyles(theme);

  if (entries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="time-outline" size={32} color={theme.textSecondary} />
        <Text style={styles.emptyText}>Nothing logged yet today</Text>
        <Text style={styles.emptyHint}>Chat with Delta or use quick-log above</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {entries.map((entry, index) => {
        const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.note;
        const entryColor = theme[config.colorKey] as string;
        const isLast = index === entries.length - 1;

        return (
          <Animated.View
            key={entry.id}
            entering={FadeInLeft.delay(index * 50).springify()}
            style={styles.entryRow}
          >
            {/* Time column */}
            <View style={styles.timeColumn}>
              <Text style={styles.timeText}>{entry.time}</Text>
            </View>

            {/* Connector */}
            <View style={styles.connectorColumn}>
              <View style={[styles.dot, { backgroundColor: entryColor }]} />
              {!isLast && <View style={styles.line} />}
            </View>

            {/* Content */}
            <View style={styles.contentColumn}>
              <View style={styles.entryCard}>
                <View style={[styles.entryIcon, { backgroundColor: entryColor + '20' }]}>
                  <Ionicons name={config.icon as any} size={14} color={entryColor} />
                </View>
                <View style={styles.entryContent}>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  {entry.subtitle && (
                    <Text style={styles.entrySubtitle}>{entry.subtitle}</Text>
                  )}
                </View>
                {entry.value && (
                  <Text style={styles.entryValue}>{entry.value}</Text>
                )}
              </View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      paddingVertical: 4,
    },
    emptyContainer: {
      alignItems: 'center',
      padding: 32,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    emptyText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textPrimary,
      marginTop: 12,
    },
    emptyHint: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
    },
    entryRow: {
      flexDirection: 'row',
      minHeight: 52,
    },
    timeColumn: {
      width: 48,
      alignItems: 'flex-end',
      paddingRight: 10,
      paddingTop: 4,
    },
    timeText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    connectorColumn: {
      width: 20,
      alignItems: 'center',
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 6,
    },
    line: {
      width: 2,
      flex: 1,
      backgroundColor: theme.border,
      marginTop: 4,
    },
    contentColumn: {
      flex: 1,
      paddingLeft: 8,
      paddingBottom: 12,
    },
    entryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    entryIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    entryContent: {
      flex: 1,
    },
    entryTitle: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textPrimary,
    },
    entrySubtitle: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 1,
    },
    entryValue: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textPrimary,
      fontVariant: ['tabular-nums'],
    },
  });
}
