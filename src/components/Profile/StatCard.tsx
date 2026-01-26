/**
 * StatCard - Displays a single stat on profile (e.g., "Bench Max: 225 lbs").
 *
 * Features:
 * - Editable on tap
 * - Shows recorded date if available
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Theme } from '../../theme/colors';
import { StatCard as StatCardType } from '../../services/api';

interface StatCardProps {
  theme: Theme;
  card: StatCardType;
  onEdit: (card: StatCardType) => void;
  index?: number;
}

const CARD_TYPE_ICONS: Record<string, string> = {
  bench_max: 'barbell-outline',
  squat_max: 'fitness-outline',
  deadlift_max: 'barbell-outline',
  mile_time: 'stopwatch-outline',
  '5k_time': 'timer-outline',
  body_weight: 'scale-outline',
  body_fat: 'body-outline',
  custom: 'star-outline',
};

export default function StatCard({
  theme,
  card,
  onEdit,
  index = 0,
}: StatCardProps): React.ReactNode {
  const icon = CARD_TYPE_ICONS[card.card_type] || 'analytics-outline';

  const formatDate = (dateStr: string | null): string | null => {
    if (dateStr === null) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return null;
    }
  };

  const recordedDate = formatDate(card.recorded_at);

  const styles = createStyles(theme);

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <TouchableOpacity
        style={styles.container}
        onPress={() => onEdit(card)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={icon as any} size={20} color={theme.accent} />
        </View>
        <View style={styles.content}>
          <Text style={styles.label}>{card.display_name}</Text>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{card.value}</Text>
            {card.unit !== null && (
              <Text style={styles.unit}>{card.unit}</Text>
            )}
          </View>
          {recordedDate !== null && (
            <Text style={styles.date}>{recordedDate}</Text>
          )}
        </View>
        <Ionicons name="pencil-outline" size={16} color={theme.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    content: {
      flex: 1,
    },
    label: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: 2,
    },
    value: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    unit: {
      fontSize: 14,
      color: theme.textSecondary,
      marginLeft: 4,
    },
    date: {
      fontSize: 10,
      color: theme.textSecondary,
      marginTop: 2,
    },
  });
}
