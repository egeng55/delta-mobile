/**
 * Menstrual Tracking Service - Uses Supabase for cycle tracking.
 *
 * Features:
 * - Log period start/end dates
 * - Track symptoms and flow intensity
 * - Predict future cycles based on average cycle length
 * - Calculate fertile windows and ovulation
 */

import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MenstrualLog,
  MenstrualSettings,
  MenstrualCalendarDay,
  MenstrualEventType,
  FlowIntensity,
  MenstrualSymptom,
  CyclePhase,
} from './api';

const SETTINGS_KEY = 'menstrual_settings';
const LOGS_CACHE_KEY = 'menstrual_logs_cache';

// Default settings
const DEFAULT_SETTINGS: Omit<MenstrualSettings, 'user_id' | 'created_at' | 'updated_at'> = {
  tracking_enabled: false,
  average_cycle_length: 28,
  average_period_length: 5,
  last_period_start: null,
  notifications_enabled: true,
};

/**
 * Get menstrual settings for a user.
 */
export async function getSettings(userId: string): Promise<MenstrualSettings> {
  try {
    // Try Supabase first
    const { data, error } = await supabase
      .from('menstrual_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error !== null && error.code !== 'PGRST116') {
      console.error('Error fetching menstrual settings:', error);
    }

    if (data !== null) {
      // Cache locally
      await AsyncStorage.setItem(`${SETTINGS_KEY}_${userId}`, JSON.stringify(data));
      return data as MenstrualSettings;
    }

    // Fall back to local cache
    const cached = await AsyncStorage.getItem(`${SETTINGS_KEY}_${userId}`);
    if (cached !== null) {
      return JSON.parse(cached) as MenstrualSettings;
    }

    // Return defaults
    return {
      ...DEFAULT_SETTINGS,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

/**
 * Update menstrual settings.
 */
export async function updateSettings(
  userId: string,
  settings: Partial<Omit<MenstrualSettings, 'user_id' | 'created_at' | 'updated_at'>>
): Promise<MenstrualSettings> {
  const now = new Date().toISOString();

  try {
    // Try upsert to Supabase
    const { data, error } = await supabase
      .from('menstrual_settings')
      .upsert({
        user_id: userId,
        ...settings,
        updated_at: now,
      })
      .select()
      .single();

    if (error !== null) {
      console.error('Error updating menstrual settings:', error);
      // Fall back to local storage
      const current = await getSettings(userId);
      const updated = { ...current, ...settings, updated_at: now };
      await AsyncStorage.setItem(`${SETTINGS_KEY}_${userId}`, JSON.stringify(updated));
      return updated;
    }

    // Cache locally
    await AsyncStorage.setItem(`${SETTINGS_KEY}_${userId}`, JSON.stringify(data));
    return data as MenstrualSettings;
  } catch {
    const current = await getSettings(userId);
    const updated = { ...current, ...settings, updated_at: now };
    await AsyncStorage.setItem(`${SETTINGS_KEY}_${userId}`, JSON.stringify(updated));
    return updated;
  }
}

/**
 * Log a menstrual event.
 */
export async function logEvent(
  userId: string,
  date: string,
  eventType: MenstrualEventType,
  flowIntensity?: FlowIntensity,
  symptoms?: MenstrualSymptom[],
  notes?: string
): Promise<MenstrualLog | null> {
  try {
    const { data, error } = await supabase
      .from('menstrual_logs')
      .upsert({
        user_id: userId,
        date,
        event_type: eventType,
        flow_intensity: flowIntensity ?? null,
        symptoms: symptoms ?? [],
        notes: notes ?? null,
      }, {
        onConflict: 'user_id,date,event_type',
      })
      .select()
      .single();

    if (error !== null) {
      console.error('Error logging menstrual event:', error);
      return null;
    }

    // Update last_period_start if this is a period_start event
    if (eventType === 'period_start') {
      await updateSettings(userId, { last_period_start: date });
    }

    return data as MenstrualLog;
  } catch {
    return null;
  }
}

/**
 * Delete a menstrual log entry.
 */
export async function deleteLog(logId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('menstrual_logs')
      .delete()
      .eq('id', logId);

    return error === null;
  } catch {
    return false;
  }
}

/**
 * Get logs for a specific month.
 */
export async function getMonthLogs(
  userId: string,
  year: number,
  month: number
): Promise<MenstrualLog[]> {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('menstrual_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error !== null) {
      console.error('Error fetching menstrual logs:', error);
      return [];
    }

    return (data ?? []) as MenstrualLog[];
  } catch {
    return [];
  }
}

/**
 * Get all period start dates for a user (for cycle analysis).
 */
export async function getPeriodHistory(
  userId: string,
  limit: number = 12
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('menstrual_logs')
      .select('date')
      .eq('user_id', userId)
      .eq('event_type', 'period_start')
      .order('date', { ascending: false })
      .limit(limit);

    if (error !== null) {
      console.error('Error fetching period history:', error);
      return [];
    }

    return (data ?? []).map(d => d.date);
  } catch {
    return [];
  }
}

/**
 * Calculate current cycle phase based on last period.
 */
export function calculateCyclePhase(
  lastPeriodStart: string | null,
  averageCycleLength: number,
  averagePeriodLength: number
): CyclePhase | null {
  if (lastPeriodStart === null) {
    return null;
  }

  const lastPeriod = new Date(lastPeriodStart);
  const today = new Date();
  const diffTime = today.getTime() - lastPeriod.getTime();
  const dayInCycle = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // Calculate days until next period
  const daysUntilPeriod = averageCycleLength - dayInCycle;

  // Ovulation typically occurs 14 days before the next period
  const ovulationDay = averageCycleLength - 14;
  const fertileStart = ovulationDay - 5;
  const fertileEnd = ovulationDay + 1;

  // Determine phase
  let phase: CyclePhase['phase'];
  if (dayInCycle <= averagePeriodLength) {
    phase = 'menstrual';
  } else if (dayInCycle < fertileStart) {
    phase = 'follicular';
  } else if (dayInCycle >= fertileStart && dayInCycle <= fertileEnd) {
    phase = 'ovulation';
  } else {
    phase = 'luteal';
  }

  const isFertileWindow = dayInCycle >= fertileStart && dayInCycle <= fertileEnd;

  return {
    phase,
    day_in_cycle: dayInCycle,
    days_until_period: daysUntilPeriod > 0 ? daysUntilPeriod : null,
    is_fertile_window: isFertileWindow,
  };
}

/**
 * Generate calendar data for a month including predictions.
 */
export function generateCalendarData(
  year: number,
  month: number,
  logs: MenstrualLog[],
  settings: MenstrualSettings
): MenstrualCalendarDay[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const calendarDays: MenstrualCalendarDay[] = [];

  // Build a map of logged dates
  const logMap = new Map<string, MenstrualLog[]>();
  for (const log of logs) {
    const existing = logMap.get(log.date) ?? [];
    existing.push(log);
    logMap.set(log.date, existing);
  }

  // Calculate predictions based on last period start
  const predictedPeriodDates = new Set<string>();
  const predictedFertileDates = new Set<string>();
  const predictedOvulationDates = new Set<string>();

  if (settings.last_period_start !== null) {
    const lastPeriod = new Date(settings.last_period_start);
    const cycleLength = settings.average_cycle_length;
    const periodLength = settings.average_period_length;

    // Calculate next few cycles (up to 3 months ahead)
    for (let cycleNum = 0; cycleNum < 4; cycleNum++) {
      const cycleStart = new Date(lastPeriod);
      cycleStart.setDate(cycleStart.getDate() + cycleNum * cycleLength);

      // Add period days
      for (let day = 0; day < periodLength; day++) {
        const periodDay = new Date(cycleStart);
        periodDay.setDate(periodDay.getDate() + day);
        predictedPeriodDates.add(periodDay.toISOString().split('T')[0]);
      }

      // Add ovulation day (typically 14 days before next period)
      const ovulationDay = new Date(cycleStart);
      ovulationDay.setDate(ovulationDay.getDate() + cycleLength - 14);
      predictedOvulationDates.add(ovulationDay.toISOString().split('T')[0]);

      // Add fertile window (5 days before ovulation to 1 day after)
      for (let day = -5; day <= 1; day++) {
        const fertileDay = new Date(ovulationDay);
        fertileDay.setDate(fertileDay.getDate() + day);
        predictedFertileDates.add(fertileDay.toISOString().split('T')[0]);
      }
    }
  }

  // Generate calendar data for each day
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayLogs = logMap.get(dateStr) ?? [];

    const periodLog = dayLogs.find(l => l.event_type === 'period_start' || l.event_type === 'period_end');
    const symptomLog = dayLogs.find(l => l.event_type === 'symptom');
    const isPeriodLogged = dayLogs.some(l => l.event_type === 'period_start');

    calendarDays.push({
      date: dateStr,
      is_period: isPeriodLogged,
      is_predicted_period: !isPeriodLogged && predictedPeriodDates.has(dateStr),
      is_fertile: predictedFertileDates.has(dateStr),
      is_ovulation: predictedOvulationDates.has(dateStr),
      flow_intensity: periodLog?.flow_intensity ?? null,
      symptoms: symptomLog?.symptoms ?? [],
      has_log: dayLogs.length > 0,
    });
  }

  return calendarDays;
}

/**
 * Get phase label for display.
 */
export function getPhaseLabel(phase: CyclePhase['phase']): string {
  switch (phase) {
    case 'menstrual':
      return 'Menstrual Phase';
    case 'follicular':
      return 'Follicular Phase';
    case 'ovulation':
      return 'Ovulation';
    case 'luteal':
      return 'Luteal Phase';
    default:
      return 'Unknown';
  }
}

/**
 * Get phase color for display.
 */
export function getPhaseColor(phase: CyclePhase['phase']): string {
  switch (phase) {
    case 'menstrual':
      return '#E57373'; // Red
    case 'follicular':
      return '#81C784'; // Green
    case 'ovulation':
      return '#64B5F6'; // Blue
    case 'luteal':
      return '#FFB74D'; // Orange
    default:
      return '#9E9E9E'; // Grey
  }
}
