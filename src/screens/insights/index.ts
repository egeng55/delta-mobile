/**
 * Insights Screens - Refactored from monolithic InsightsScreen
 *
 * Screen breakdown:
 * - TodayScreen: Daily summary, progress rings, quick actions
 * - ActivityScreen: Workout tracking, load state, exercise completion
 * - RecoveryScreen: Sleep data, recovery state, heart metrics
 * - HistoryScreen: Calendar view, historical logs, trends
 *
 * All screens use the shared useInsightsData hook for data fetching.
 */

export { default as TodayScreen } from '../TodayScreen';
export { default as ActivityScreen } from '../ActivityScreen';
export { default as RecoveryScreen } from '../RecoveryScreen';
export { default as HistoryScreen } from '../HistoryScreen';
