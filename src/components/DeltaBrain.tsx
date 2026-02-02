/**
 * DeltaBrain - Prediction accuracy, active predictions, belief updates, knowledge gaps.
 *
 * Shows how Delta is learning about the user:
 * - Prediction accuracy (simple fraction: "34/41 correct")
 * - Active predictions (next 24h) — filters out resolved
 * - Recent belief updates (what changed) — show 3, expandable
 * - Knowledge gaps (what data is needed)
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Theme } from '../theme/colors';
import {
  Prediction,
  BeliefUpdate,
  KnowledgeGap,
  Contradiction,
  LearningStatusResponse,
} from '../services/api';

interface DeltaBrainProps {
  theme: Theme;
  learningStatus: LearningStatusResponse | null;
  predictions: Prediction[];
  beliefUpdates: BeliefUpdate[];
  knowledgeGaps: KnowledgeGap[];
  contradictions?: Contradiction[];
}

function formatTimeRemaining(resolves_at: string): string {
  const now = Date.now();
  const target = new Date(resolves_at).getTime();
  const diffMs = target - now;
  if (diffMs <= 0) return 'resolving soon';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return `${Math.ceil(diffMs / (1000 * 60))}m left`;
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

export default function DeltaBrain({
  theme,
  learningStatus,
  predictions = [],
  beliefUpdates = [],
  knowledgeGaps = [],
  contradictions = [],
}: DeltaBrainProps): React.ReactNode {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [showAllUpdates, setShowAllUpdates] = useState(false);

  // Filter to only active (unresolved) predictions
  const activePredictions = useMemo(
    () => predictions.filter((p) => !p.resolved && !p.was_correct && !p.actual_value),
    [predictions]
  );

  const visibleUpdates = showAllUpdates ? beliefUpdates : beliefUpdates.slice(0, 3);

  // Trend indicator for belief history
  const getTrend = (bh?: Array<{ date: string; confidence: number }>): 'up' | 'down' | 'stable' => {
    if (!bh || bh.length < 2) return 'stable';
    const last = bh[bh.length - 1].confidence;
    const prev = bh[bh.length - 2].confidence;
    if (last > prev + 0.02) return 'up';
    if (last < prev - 0.02) return 'down';
    return 'stable';
  };

  return (
    <View style={styles.container}>
      {/* Prediction Accuracy */}
      <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="analytics-outline" size={16} color={theme.accent} />
          <Text style={styles.sectionTitle}>Prediction Accuracy</Text>
        </View>
        {learningStatus && learningStatus.predictions_made > 0 ? (
          <View style={styles.accuracyRow}>
            <Text style={styles.accuracyFraction}>
              {learningStatus.predictions_correct}/{learningStatus.predictions_made}
            </Text>
            <Text style={styles.accuracyLabel}>correct predictions</Text>
            <View style={styles.accuracyBar}>
              <View
                style={[
                  styles.accuracyFill,
                  {
                    width: `${(learningStatus.predictions_correct / learningStatus.predictions_made) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>
            Delta needs more data to make predictions
          </Text>
        )}
      </Animated.View>

      {/* Active Predictions */}
      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="telescope-outline" size={16} color={theme.accent} />
          <Text style={styles.sectionTitle}>Active Predictions</Text>
        </View>
        {activePredictions.length === 0 ? (
          <Text style={styles.emptyText}>No active predictions yet</Text>
        ) : (
          activePredictions.map((pred) => (
            <View key={pred.id} style={styles.predictionCard}>
              <View style={styles.predictionHeader}>
                <Text style={styles.predictionMetric}>{pred.metric}</Text>
                <View style={styles.predictionDirection}>
                  <Ionicons
                    name={pred.predicted_direction === 'up' ? 'trending-up' : pred.predicted_direction === 'down' ? 'trending-down' : 'remove'}
                    size={14}
                    color={pred.predicted_direction === 'up' ? theme.success : pred.predicted_direction === 'down' ? theme.warning : theme.textSecondary}
                  />
                  <Text style={styles.predictionValue}>{pred.predicted_value}</Text>
                </View>
              </View>
              <Text style={styles.predictionReasoning}>{pred.reasoning}</Text>
              <View style={styles.predictionMeta}>
                <View style={[styles.confidenceDot, { backgroundColor: pred.confidence >= 0.7 ? theme.success : theme.warning }]} />
                <Text style={styles.predictionConfidence}>
                  {Math.round(pred.confidence * 100)}% confident
                </Text>
                {pred.resolves_at && (
                  <Text style={styles.predictionTime}>
                    {' · '}{formatTimeRemaining(pred.resolves_at)}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
      </Animated.View>

      {/* Recent Belief Updates */}
      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="refresh-outline" size={16} color={theme.accent} />
          <Text style={styles.sectionTitle}>Recent Learning</Text>
        </View>
        {beliefUpdates.length === 0 ? (
          <Text style={styles.emptyText}>No belief updates yet</Text>
        ) : (
          <>
            {visibleUpdates.map((update) => {
              const isIncrease = update.new_confidence > update.old_confidence;
              return (
                <View key={update.id} style={styles.updateCard}>
                  <View style={styles.updateHeader}>
                    <Text style={styles.updatePattern}>{update.pattern}</Text>
                    <View style={styles.updateDelta}>
                      <Ionicons
                        name={isIncrease ? 'arrow-up' : 'arrow-down'}
                        size={12}
                        color={isIncrease ? theme.success : theme.warning}
                      />
                      <Text style={[
                        styles.updateDeltaText,
                        { color: isIncrease ? theme.success : theme.warning },
                      ]}>
                        {Math.round(update.old_confidence * 100)}% → {Math.round(update.new_confidence * 100)}%
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.updateReason}>{update.reason}</Text>
                </View>
              );
            })}
            {beliefUpdates.length > 3 && (
              <TouchableOpacity onPress={() => setShowAllUpdates(!showAllUpdates)}>
                <Text style={styles.showMoreText}>
                  {showAllUpdates ? 'Show less' : `Show ${beliefUpdates.length - 3} more`}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </Animated.View>

      {/* Knowledge Gaps */}
      <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="help-circle-outline" size={16} color={theme.warning} />
          <Text style={styles.sectionTitle}>Knowledge Gaps</Text>
        </View>
        {knowledgeGaps.length === 0 ? (
          <Text style={styles.emptyText}>No known knowledge gaps</Text>
        ) : (
          knowledgeGaps.map((gap) => (
            <View key={gap.metric} style={styles.gapCard}>
              <Text style={styles.gapDescription}>{gap.description}</Text>
              <Text style={styles.gapImpact}>{gap.impact}</Text>
            </View>
          ))
        )}
      </Animated.View>

      {/* Contradictions — Delta questioning itself */}
      {contradictions.length > 0 && (
        <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="alert-circle-outline" size={16} color={theme.warning} />
            <Text style={styles.sectionTitle}>Delta is Questioning</Text>
          </View>
          {contradictions.map((c, i) => (
            <View key={c.id || `c-${i}`} style={styles.contradictionCard}>
              <Text style={styles.contradictionDesc}>{c.description}</Text>
              <Text style={styles.contradictionType}>{c.conflict_type}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* Learning Status */}
      {learningStatus && (
        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.statusBar}>
          <Ionicons name="sparkles" size={14} color={theme.accent} />
          <Text style={styles.statusText}>
            {learningStatus.days_of_data} days analyzed · {learningStatus.patterns_discovered} patterns discovered
            {learningStatus.contradictions ? ` · ${learningStatus.contradictions} conflicts` : ''}
          </Text>
          {learningStatus.last_computed_at && (
            <Text style={styles.timestampText}>
              Updated {new Date(learningStatus.last_computed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </Animated.View>
      )}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      gap: 12,
    },
    section: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    emptyText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    // Accuracy
    accuracyRow: {
      gap: 4,
    },
    accuracyFraction: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    accuracyLabel: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    accuracyBar: {
      height: 4,
      backgroundColor: theme.background,
      borderRadius: 2,
      marginTop: 8,
    },
    accuracyFill: {
      height: 4,
      backgroundColor: theme.accent,
      borderRadius: 2,
    },
    // Predictions
    predictionCard: {
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 10,
      marginBottom: 6,
    },
    predictionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    predictionMetric: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    predictionDirection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    predictionValue: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    predictionReasoning: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
    },
    predictionMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
    },
    confidenceDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    predictionConfidence: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    predictionTime: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    // Belief Updates
    updateCard: {
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 10,
      marginBottom: 6,
    },
    updateHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    updatePattern: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textPrimary,
      flex: 1,
    },
    updateDelta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    updateDeltaText: {
      fontSize: 11,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    updateReason: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
    },
    showMoreText: {
      fontSize: 13,
      color: theme.accent,
      textAlign: 'center',
      paddingVertical: 6,
      fontWeight: '500',
    },
    // Knowledge Gaps
    gapCard: {
      backgroundColor: theme.warning + '10',
      borderRadius: 8,
      padding: 10,
      marginBottom: 6,
    },
    gapDescription: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textPrimary,
      marginBottom: 2,
    },
    gapImpact: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    // Status
    statusBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: 10,
      backgroundColor: theme.accent + '10',
      borderRadius: 10,
    },
    statusText: {
      fontSize: 12,
      color: theme.accent,
    },
    timestampText: {
      fontSize: 10,
      color: theme.textSecondary,
      marginTop: 2,
    },
    contradictionCard: {
      backgroundColor: theme.warning + '10',
      borderRadius: 8,
      padding: 10,
      marginBottom: 6,
    },
    contradictionDesc: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textPrimary,
      marginBottom: 2,
    },
    contradictionType: {
      fontSize: 11,
      color: theme.textSecondary,
    },
  });
}
