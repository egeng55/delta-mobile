/**
 * DeltaBrain - Prediction accuracy, active predictions, belief updates, knowledge gaps.
 *
 * Shows how Delta is learning about the user:
 * - Prediction accuracy (simple fraction: "34/41 correct")
 * - Active predictions (next 24h)
 * - Recent belief updates (what changed)
 * - Knowledge gaps (what data is needed)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Theme } from '../theme/colors';
import {
  Prediction,
  BeliefUpdate,
  KnowledgeGap,
  LearningStatusResponse,
} from '../services/api';

interface DeltaBrainProps {
  theme: Theme;
  learningStatus: LearningStatusResponse | null;
  predictions: Prediction[];
  beliefUpdates: BeliefUpdate[];
  knowledgeGaps: KnowledgeGap[];
}

export default function DeltaBrain({
  theme,
  learningStatus,
  predictions = [],
  beliefUpdates = [],
  knowledgeGaps = [],
}: DeltaBrainProps): React.ReactNode {
  const styles = createStyles(theme);

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
      {predictions.length > 0 && (
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="telescope-outline" size={16} color={theme.accent} />
            <Text style={styles.sectionTitle}>Active Predictions</Text>
          </View>
          {predictions.map((pred) => (
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
              </View>
            </View>
          ))}
        </Animated.View>
      )}

      {/* Recent Belief Updates */}
      {beliefUpdates.length > 0 && (
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="refresh-outline" size={16} color={theme.accent} />
            <Text style={styles.sectionTitle}>Recent Learning</Text>
          </View>
          {beliefUpdates.slice(0, 3).map((update) => {
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
        </Animated.View>
      )}

      {/* Knowledge Gaps */}
      {knowledgeGaps.length > 0 && (
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="help-circle-outline" size={16} color={theme.warning} />
            <Text style={styles.sectionTitle}>Knowledge Gaps</Text>
          </View>
          {knowledgeGaps.map((gap, i) => (
            <View key={i} style={styles.gapCard}>
              <Text style={styles.gapDescription}>{gap.description}</Text>
              <Text style={styles.gapImpact}>{gap.impact}</Text>
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
          </Text>
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
  });
}
