/**
 * JournalScreen - Daily health log (Tab 2: Journal).
 *
 * Replaces Activity + Today + Insights calendar.
 * Focus on INPUT not analysis. No scores, no gauges.
 *
 * Sections:
 * - Today's snapshot (small summary bar)
 * - Quick-log cards (1-tap mood/energy/stress/water)
 * - Timeline (vertical chronological view)
 * - Calendar scrubber (horizontal date picker)
 *
 * API endpoints used:
 * - POST /track/meal, /track/workout, /track/sleep, /track/mood, /track/weight, /track/water
 * - GET /track/{user_id}/entries
 * - GET /calendar/{user_id}/{date}
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { calendarApi, DailyLog, dashboardApi, DashboardResponse } from '../services/api';
import QuickLog from '../components/QuickLog';
import Timeline, { TimelineEntry } from '../components/Timeline';

interface JournalScreenProps {
  theme: Theme;
}

// Generate dates for the horizontal scrubber
function generateDates(centerDate: Date, range: number = 14): Date[] {
  const dates: Date[] = [];
  for (let i = -range; i <= 0; i++) {
    const d = new Date(centerDate);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function JournalScreen({ theme }: JournalScreenProps): React.ReactNode {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const dateListRef = useRef<FlatList<Date>>(null);

  const dates = generateDates(new Date(), 14);
  const today = new Date();
  const isToday = formatDateKey(selectedDate) === formatDateKey(today);

  const styles = createStyles(theme, insets.top);

  const fetchData = useCallback(async (date: Date) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const dateStr = formatDateKey(date);
      const [logResult, dashResult] = await Promise.all([
        calendarApi.getDailyLog(user.id, dateStr).catch(() => ({ log: null, date: dateStr })),
        isToday ? dashboardApi.getDashboard(user.id).catch(() => null) : Promise.resolve(null),
      ]);
      setDailyLog(logResult.log);
      if (dashResult) setDashboard(dashResult);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isToday]);

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate, fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(selectedDate);
    setRefreshing(false);
  };

  // Quick-log handler
  const handleQuickLog = async (metric: string, value: number): Promise<void> => {
    if (!user?.id) return;
    const dateStr = formatDateKey(selectedDate);
    const updateData: Record<string, unknown> = {};

    switch (metric) {
      case 'mood':
        // Map 1-5 to mood value range used by the API
        updateData.energy_level = undefined; // Don't change energy
        // Use calendarApi to update the mood-like field
        break;
      case 'energy':
        updateData.energy_level = value;
        break;
      case 'stress':
        updateData.stress_level = value;
        break;
      case 'water':
        // Map 1-5 scale to approximate oz: 0, 16, 32, 48, 64+
        updateData.hydration_liters = Math.round((value * 16) * 0.0296 * 100) / 100;
        break;
    }

    if (metric === 'mood') {
      // Mood is stored as energy_level in the system for now
      updateData.energy_level = value;
    }

    try {
      await calendarApi.updateDailyLog(user.id, dateStr, updateData as any);
      // Refresh to get updated data
      await fetchData(selectedDate);
    } catch {
      // Silent fail
    }
  };

  // Build timeline entries from daily log
  const timelineEntries: TimelineEntry[] = [];
  if (dailyLog) {
    // Meals
    if (dailyLog.meals && dailyLog.meals.length > 0) {
      dailyLog.meals.forEach((meal, i) => {
        timelineEntries.push({
          id: `meal-${i}`,
          time: meal.description ? '' : '',
          type: 'meal',
          title: meal.meal || 'Meal',
          subtitle: meal.description,
          value: meal.calories_est ? `${meal.calories_est} cal` : undefined,
        });
      });
    }

    // Sleep
    if (dailyLog.sleep_hours !== null) {
      timelineEntries.push({
        id: 'sleep',
        time: dailyLog.wake_time || '',
        type: 'sleep',
        title: 'Sleep',
        value: `${dailyLog.sleep_hours}h`,
      });
    }

    // Energy
    if (dailyLog.energy_level !== null) {
      timelineEntries.push({
        id: 'energy',
        time: '',
        type: 'mood',
        title: 'Energy Level',
        value: `${dailyLog.energy_level}/5`,
      });
    }

    // Stress
    if (dailyLog.stress_level !== null) {
      timelineEntries.push({
        id: 'stress',
        time: '',
        type: 'mood',
        title: 'Stress Level',
        value: `${dailyLog.stress_level}/5`,
      });
    }

    // Water
    if (dailyLog.hydration_liters !== null && dailyLog.hydration_liters > 0) {
      timelineEntries.push({
        id: 'water',
        time: '',
        type: 'water',
        title: 'Hydration',
        value: `${Math.round(dailyLog.hydration_liters * 33.814)}oz`,
      });
    }

    // Weight - stored in notes or separate tracking, skip if not available

    // Notes
    if (dailyLog.notes) {
      timelineEntries.push({
        id: 'notes',
        time: '',
        type: 'note',
        title: dailyLog.notes,
      });
    }
  }

  // Current values for quick-log
  const currentValues = {
    mood: undefined as number | undefined,
    energy: dailyLog?.energy_level ?? undefined,
    stress: dailyLog?.stress_level ?? undefined,
    water: dailyLog?.hydration_liters ? Math.min(Math.ceil(dailyLog.hydration_liters * 33.814 / 16), 5) : undefined,
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Journal</Text>
        <Text style={styles.headerDate}>
          {isToday ? 'Today' : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>
      </View>

      {/* Date Scrubber */}
      <FlatList
        ref={dateListRef}
        data={dates}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateScrubber}
        initialScrollIndex={dates.length - 1}
        getItemLayout={(_, index) => ({
          length: 52,
          offset: 52 * index,
          index,
        })}
        keyExtractor={(item) => formatDateKey(item)}
        renderItem={({ item }) => {
          const isSelected = formatDateKey(item) === formatDateKey(selectedDate);
          const isTodayItem = formatDateKey(item) === formatDateKey(today);
          return (
            <Pressable
              style={[
                styles.dateItem,
                isSelected && styles.dateItemSelected,
              ]}
              onPress={() => setSelectedDate(item)}
            >
              <Text style={[
                styles.dateDayName,
                isSelected && styles.dateDayNameSelected,
              ]}>
                {DAY_NAMES[item.getDay()]}
              </Text>
              <Text style={[
                styles.dateNumber,
                isSelected && styles.dateNumberSelected,
              ]}>
                {item.getDate()}
              </Text>
              {isTodayItem && <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />}
            </Pressable>
          );
        }}
      />

      <ScrollView
        style={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />
        }
      >
        {/* Today's Snapshot */}
        {isToday && dashboard?.today && (
          <Animated.View entering={FadeInDown.springify()} style={styles.snapshot}>
            <View style={styles.snapshotItem}>
              <Ionicons name="bed-outline" size={16} color={theme.sleep} />
              <Text style={styles.snapshotValue}>
                {dashboard.today.sleep_hours ?? '—'}h
              </Text>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotItem}>
              <Ionicons name="barbell-outline" size={16} color={theme.warning} />
              <Text style={styles.snapshotValue}>
                {dashboard.today.workouts > 0 ? `${dashboard.today.workout_minutes}m` : 'None'}
              </Text>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotItem}>
              <Ionicons name="restaurant-outline" size={16} color={theme.success} />
              <Text style={styles.snapshotValue}>
                {dashboard.today.meals} meals
              </Text>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotItem}>
              <Ionicons name="water-outline" size={16} color={theme.sleep} />
              <Text style={styles.snapshotValue}>
                {dashboard.today.water_oz > 0 ? `${Math.round(dashboard.today.water_oz)}oz` : '—'}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Quick-Log Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Log</Text>
          <QuickLog
            theme={theme}
            onLog={handleQuickLog}
            currentValues={currentValues}
          />
        </View>

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <Timeline theme={theme} entries={timelineEntries} />
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(theme: Theme, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: topInset + 8,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    headerDate: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    dateScrubber: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    dateItem: {
      width: 44,
      height: 64,
      marginHorizontal: 4,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.surface,
    },
    dateItemSelected: {
      backgroundColor: theme.accent,
    },
    dateDayName: {
      fontSize: 10,
      color: theme.textSecondary,
      fontWeight: '500',
      marginBottom: 2,
    },
    dateDayNameSelected: {
      color: '#fff',
    },
    dateNumber: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    dateNumberSelected: {
      color: '#fff',
    },
    todayDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.accent,
      marginTop: 3,
    },
    todayDotSelected: {
      backgroundColor: '#fff',
    },
    scrollContent: {
      flex: 1,
    },
    snapshot: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 12,
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 8,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'space-around',
      borderWidth: 1,
      borderColor: theme.border,
    },
    snapshotItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    snapshotValue: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    snapshotDivider: {
      width: 1,
      height: 20,
      backgroundColor: theme.border,
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 12,
    },
  });
}
