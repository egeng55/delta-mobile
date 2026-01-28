/**
 * DeltaFeedCard - Unified card for Delta's insights feed.
 *
 * Displays insights, patterns, recommendations, and data updates
 * in a consistent format that showcases Delta's reasoning.
 *
 * Features:
 * - Expandable reasoning chain (shows Delta's thought process)
 * - Confidence indicator
 * - Action buttons (learn more, undo, etc.)
 * - Visual tone indicators (positive/caution/rest)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Theme } from '../../theme/colors';
import { FeedItem, FeedItemAction } from './types';

interface DeltaFeedCardProps {
  theme: Theme;
  item: FeedItem;
  index?: number;
  onActionPress?: (actionId: string, item: FeedItem) => void;
  compact?: boolean;
}

// Map color keys to theme properties
const COLOR_MAP: Record<string, keyof Theme> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  accent: 'accent',
  recovery: 'recovery',
  strain: 'strain',
  sleep: 'sleep',
};

// Priority indicator styles
const PRIORITY_INDICATORS = {
  high: { width: 4, opacity: 1 },
  medium: { width: 3, opacity: 0.7 },
  low: { width: 2, opacity: 0.4 },
};

export default function DeltaFeedCard({
  theme,
  item,
  index = 0,
  onActionPress,
  compact = false,
}: DeltaFeedCardProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false);

  const colorKey = item.color ? COLOR_MAP[item.color] : 'accent';
  const itemColor = theme[colorKey] as string;
  const priorityStyle = PRIORITY_INDICATORS[item.priority];
  const hasReasoning = item.reasoning && item.reasoning.length > 0;

  const styles = createStyles(theme, itemColor, priorityStyle);

  // Format timestamp
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Render pattern visualization
  const renderPattern = () => {
    if (!item.pattern) return null;

    return (
      <View style={styles.patternContainer}>
        <View style={styles.patternNode}>
          <Text style={styles.patternLabel} numberOfLines={1}>
            {formatLabel(item.pattern.cause)}
          </Text>
        </View>
        <View style={styles.patternArrow}>
          <View style={styles.patternLine} />
          <Ionicons name="arrow-forward" size={14} color={theme.textSecondary} />
          {item.pattern.lagDays > 0 && (
            <Text style={styles.patternLag}>+{item.pattern.lagDays}d</Text>
          )}
        </View>
        <View style={styles.patternNode}>
          <Text style={styles.patternLabel} numberOfLines={1}>
            {formatLabel(item.pattern.effect)}
          </Text>
        </View>
      </View>
    );
  };

  // Render reasoning chain
  const renderReasoning = () => {
    if (!hasReasoning || !expanded) return null;

    return (
      <Animated.View entering={FadeInUp.duration(200)} style={styles.reasoningContainer}>
        {item.reasoning!.map((step, idx) => (
          <View key={idx} style={styles.reasoningStep}>
            <View style={[styles.reasoningDot, { backgroundColor: getStepColor(step.type) }]} />
            <View style={styles.reasoningContent}>
              <Text style={styles.reasoningType}>{formatStepType(step.type)}</Text>
              <Text style={styles.reasoningText}>{step.content}</Text>
              {step.dataPoint && (
                <Text style={styles.reasoningData}>{step.dataPoint}</Text>
              )}
            </View>
          </View>
        ))}
      </Animated.View>
    );
  };

  // Render actions
  const renderActions = () => {
    if (!item.actions || item.actions.length === 0) return null;

    return (
      <View style={styles.actionsContainer}>
        {item.actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[
              styles.actionButton,
              action.type === 'primary' && styles.actionButtonPrimary,
              action.type === 'destructive' && styles.actionButtonDestructive,
            ]}
            onPress={() => onActionPress?.(action.id, item)}
          >
            <Text
              style={[
                styles.actionText,
                action.type === 'primary' && styles.actionTextPrimary,
                action.type === 'destructive' && styles.actionTextDestructive,
              ]}
            >
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render data change info
  const renderDataChange = () => {
    if (!item.dataChange) return null;

    return (
      <View style={styles.dataChangeContainer}>
        <Ionicons
          name={getDataChangeIcon(item.dataChange.actionType) as any}
          size={14}
          color={theme.textSecondary}
        />
        <Text style={styles.dataChangeText}>
          {item.dataChange.affectedCount} item{item.dataChange.affectedCount !== 1 ? 's' : ''}
        </Text>
        {item.dataChange.canUndo && (
          <View style={styles.undoBadge}>
            <Text style={styles.undoText}>Can undo</Text>
          </View>
        )}
      </View>
    );
  };

  const getStepColor = (type: string): string => {
    switch (type) {
      case 'observation':
        return theme.accent;
      case 'analysis':
        return theme.warning;
      case 'inference':
        return theme.sleep;
      case 'conclusion':
        return theme.success;
      default:
        return theme.textSecondary;
    }
  };

  // Compact rendering for dashboard
  if (compact) {
    return (
      <Animated.View
        entering={FadeInDown.delay(index * 80).springify()}
        style={styles.compactContainer}
      >
        <View style={[styles.priorityBar, { backgroundColor: itemColor }]} />
        <View style={styles.compactContent}>
          <View style={styles.compactHeader}>
            <Ionicons
              name={(item.icon || 'information-circle-outline') as any}
              size={16}
              color={itemColor}
            />
            <Text style={styles.compactHeadline} numberOfLines={2}>
              {item.headline}
            </Text>
          </View>
          {item.confidence !== undefined && (
            <View style={styles.compactConfidence}>
              <Text style={[styles.confidenceValue, { color: itemColor }]}>
                {Math.round(item.confidence * 100)}%
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).springify()}
      style={styles.container}
    >
      {/* Priority indicator bar */}
      <View style={[styles.priorityBar, { backgroundColor: itemColor }]} />

      <View style={styles.content}>
        {/* Header row */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: itemColor + '20' }]}>
            <Ionicons
              name={(item.icon || 'information-circle-outline') as any}
              size={18}
              color={itemColor}
            />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.typeLabel}>{formatType(item.type)}</Text>
            <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
          </View>
          {item.confidence !== undefined && (
            <View style={[styles.confidenceBadge, { borderColor: itemColor }]}>
              <Text style={[styles.confidenceText, { color: itemColor }]}>
                {Math.round(item.confidence * 100)}%
              </Text>
            </View>
          )}
        </View>

        {/* Pattern visualization */}
        {item.type === 'pattern' && renderPattern()}

        {/* Main content */}
        <Text style={styles.headline}>{item.headline}</Text>
        {item.body && <Text style={styles.body}>{item.body}</Text>}

        {/* Data change info */}
        {renderDataChange()}

        {/* Reasoning toggle */}
        {hasReasoning && (
          <TouchableOpacity
            style={styles.reasoningToggle}
            onPress={() => setExpanded(!expanded)}
          >
            <Ionicons
              name="sparkles-outline"
              size={14}
              color={theme.accent}
            />
            <Text style={styles.reasoningToggleText}>
              {expanded ? 'Hide reasoning' : "See Delta's reasoning"}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        )}

        {/* Reasoning chain */}
        {renderReasoning()}

        {/* Actions */}
        {renderActions()}

        {/* Sources */}
        {item.sources && item.sources.length > 0 && (
          <View style={styles.sourcesContainer}>
            <Text style={styles.sourcesLabel}>Based on:</Text>
            <Text style={styles.sourcesText}>{item.sources.join(', ')}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// Helper functions
function formatType(type: string): string {
  const labels: Record<string, string> = {
    insight: 'Insight',
    pattern: 'Pattern Detected',
    recommendation: 'Recommendation',
    alert: 'Alert',
    data_update: 'Data Update',
    milestone: 'Milestone',
  };
  return labels[type] || type;
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStepType(type: string): string {
  const labels: Record<string, string> = {
    observation: 'Observed',
    analysis: 'Analyzed',
    inference: 'Inferred',
    conclusion: 'Concluded',
  };
  return labels[type] || type;
}

function getDataChangeIcon(actionType: string): string {
  switch (actionType) {
    case 'merged':
      return 'git-merge-outline';
    case 'corrected':
      return 'pencil-outline';
    case 'deleted':
      return 'trash-outline';
    case 'created':
      return 'add-circle-outline';
    default:
      return 'sync-outline';
  }
}

function createStyles(
  theme: Theme,
  itemColor: string,
  priority: { width: number; opacity: number }
) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      marginBottom: 10,
      flexDirection: 'row',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    priorityBar: {
      width: priority.width,
      opacity: priority.opacity,
    },
    content: {
      flex: 1,
      padding: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    iconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    headerText: {
      flex: 1,
    },
    typeLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    timestamp: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 1,
    },
    confidenceBadge: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    confidenceText: {
      fontSize: 11,
      fontWeight: '600',
    },
    headline: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textPrimary,
      lineHeight: 20,
      marginBottom: 6,
    },
    body: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    // Pattern styles
    patternContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 10,
      marginBottom: 10,
    },
    patternNode: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 6,
      padding: 8,
      alignItems: 'center',
    },
    patternLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.textPrimary,
    },
    patternArrow: {
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    patternLine: {
      width: 20,
      height: 2,
      backgroundColor: theme.border,
      marginBottom: -8,
    },
    patternLag: {
      fontSize: 10,
      color: theme.textSecondary,
      marginTop: 4,
    },
    // Reasoning styles
    reasoningToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      paddingVertical: 6,
    },
    reasoningToggleText: {
      fontSize: 12,
      color: theme.accent,
      marginHorizontal: 6,
    },
    reasoningContainer: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    reasoningStep: {
      flexDirection: 'row',
      marginBottom: 10,
    },
    reasoningDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 4,
      marginRight: 10,
    },
    reasoningContent: {
      flex: 1,
    },
    reasoningType: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    reasoningText: {
      fontSize: 12,
      color: theme.textPrimary,
      lineHeight: 16,
    },
    reasoningData: {
      fontSize: 11,
      color: theme.textSecondary,
      fontStyle: 'italic',
      marginTop: 2,
    },
    // Data change styles
    dataChangeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
    },
    dataChangeText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginLeft: 6,
    },
    undoBadge: {
      backgroundColor: theme.accent + '20',
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: 8,
    },
    undoText: {
      fontSize: 10,
      color: theme.accent,
      fontWeight: '500',
    },
    // Actions
    actionsContainer: {
      flexDirection: 'row',
      marginTop: 12,
      gap: 8,
    },
    actionButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 6,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionButtonPrimary: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    actionButtonDestructive: {
      backgroundColor: theme.error + '10',
      borderColor: theme.error,
    },
    actionText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.textPrimary,
    },
    actionTextPrimary: {
      color: '#ffffff',
    },
    actionTextDestructive: {
      color: theme.error,
    },
    // Sources
    sourcesContainer: {
      flexDirection: 'row',
      marginTop: 10,
      flexWrap: 'wrap',
    },
    sourcesLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginRight: 4,
    },
    sourcesText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontStyle: 'italic',
    },
    // Compact styles
    compactContainer: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      marginBottom: 8,
      flexDirection: 'row',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    compactContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
    },
    compactHeader: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    compactHeadline: {
      fontSize: 13,
      color: theme.textPrimary,
      marginLeft: 8,
      flex: 1,
    },
    compactConfidence: {
      marginLeft: 8,
    },
    confidenceValue: {
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
