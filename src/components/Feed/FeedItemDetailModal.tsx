/**
 * FeedItemDetailModal - Expanded view of a feed item with full reasoning.
 *
 * Shows the complete reasoning chain when users tap on a feed card,
 * building trust by revealing Delta's thought process.
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../theme/colors';
import { FeedItem } from './types';
import ReasoningChain from './ReasoningChain';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FeedItemDetailModalProps {
  theme: Theme;
  item: FeedItem | null;
  visible: boolean;
  onClose: () => void;
  onActionPress?: (actionId: string, item: FeedItem) => void;
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

export default function FeedItemDetailModal({
  theme,
  item,
  visible,
  onClose,
  onActionPress,
}: FeedItemDetailModalProps): React.ReactNode {
  const insets = useSafeAreaInsets();

  if (!item) return null;

  const colorKey = item.color ? COLOR_MAP[item.color] : 'accent';
  const itemColor = theme[colorKey] as string;
  const styles = createStyles(theme, itemColor, insets);

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={onClose}
    >
      <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <Animated.View entering={SlideInUp.springify().damping(20)} style={styles.content}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: itemColor + '20' }]}>
              <Ionicons
                name={(item.icon || 'information-circle-outline') as any}
                size={24}
                color={itemColor}
              />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.typeLabel}>{formatType(item.type)}</Text>
              {item.confidence !== undefined && (
                <Text style={[styles.confidenceLabel, { color: itemColor }]}>
                  {Math.round(item.confidence * 100)}% confidence
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Pattern visualization */}
            {item.pattern && (
              <View style={styles.patternSection}>
                <View style={styles.patternFlow}>
                  <View style={styles.patternNode}>
                    <View style={[styles.patternIcon, { backgroundColor: theme.warning + '20' }]}>
                      <Ionicons
                        name={getEventIcon(item.pattern.cause) as any}
                        size={20}
                        color={theme.warning}
                      />
                    </View>
                    <Text style={styles.patternLabel}>{formatLabel(item.pattern.cause)}</Text>
                  </View>
                  <View style={styles.patternArrow}>
                    <View style={styles.patternLine} />
                    <Ionicons name="arrow-forward" size={18} color={theme.textSecondary} />
                    {item.pattern.lagDays > 0 && (
                      <Text style={styles.patternLag}>+{item.pattern.lagDays} days</Text>
                    )}
                  </View>
                  <View style={styles.patternNode}>
                    <View style={[styles.patternIcon, { backgroundColor: itemColor + '20' }]}>
                      <Ionicons
                        name={getEventIcon(item.pattern.effect) as any}
                        size={20}
                        color={itemColor}
                      />
                    </View>
                    <Text style={styles.patternLabel}>{formatLabel(item.pattern.effect)}</Text>
                  </View>
                </View>
                <Text style={styles.patternOccurrences}>
                  Observed {item.pattern.occurrences} times
                </Text>
              </View>
            )}

            {/* Main content */}
            <Text style={styles.headline}>{item.headline}</Text>
            {item.body && <Text style={styles.body}>{item.body}</Text>}

            {/* Data change info */}
            {item.dataChange && (
              <View style={styles.dataChangeSection}>
                <Ionicons
                  name={getDataChangeIcon(item.dataChange.actionType) as any}
                  size={16}
                  color={theme.textSecondary}
                />
                <Text style={styles.dataChangeText}>
                  {item.dataChange.affectedCount} item{item.dataChange.affectedCount !== 1 ? 's' : ''} affected
                </Text>
                {item.dataChange.canUndo && (
                  <View style={styles.undoBadge}>
                    <Ionicons name="arrow-undo" size={12} color={theme.accent} />
                    <Text style={styles.undoText}>Can undo</Text>
                  </View>
                )}
              </View>
            )}

            {/* Reasoning chain */}
            {item.reasoning && item.reasoning.length > 0 && (
              <View style={styles.reasoningSection}>
                <ReasoningChain theme={theme} steps={item.reasoning} />
              </View>
            )}

            {/* Sources */}
            {item.sources && item.sources.length > 0 && (
              <View style={styles.sourcesSection}>
                <Text style={styles.sourcesLabel}>Data Sources</Text>
                {item.sources.map((source, index) => (
                  <View key={index} style={styles.sourceItem}>
                    <Ionicons name="document-text-outline" size={14} color={theme.textSecondary} />
                    <Text style={styles.sourceText}>{source}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Actions */}
            {item.actions && item.actions.length > 0 && (
              <View style={styles.actionsSection}>
                {item.actions.map((action) => (
                  <TouchableOpacity
                    key={action.id}
                    style={[
                      styles.actionButton,
                      action.type === 'primary' && { backgroundColor: theme.accent },
                      action.type === 'destructive' && { backgroundColor: theme.error + '10', borderColor: theme.error },
                    ]}
                    onPress={() => onActionPress?.(action.id, item)}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        action.type === 'primary' && { color: '#ffffff' },
                        action.type === 'destructive' && { color: theme.error },
                      ]}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Bottom padding */}
            <View style={{ height: insets.bottom + 20 }} />
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
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

function getEventIcon(event: string): string {
  const icons: Record<string, string> = {
    sleep_hours: 'bed-outline',
    sleep_quality: 'moon-outline',
    energy_level: 'flash-outline',
    stress_level: 'pulse-outline',
    soreness_level: 'fitness-outline',
    alcohol_drinks: 'wine-outline',
    had_workout: 'barbell-outline',
    sleep_debt: 'time-outline',
  };
  return icons[event] || 'help-outline';
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

function createStyles(theme: Theme, itemColor: string, insets: { top: number; bottom: number }) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    backdrop: {
      flex: 1,
    },
    content: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: SCREEN_HEIGHT * 0.85,
      minHeight: SCREEN_HEIGHT * 0.4,
    },
    handleBar: {
      width: 36,
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 8,
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    headerText: {
      flex: 1,
    },
    typeLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    confidenceLabel: {
      fontSize: 13,
      marginTop: 2,
    },
    closeButton: {
      padding: 4,
    },
    scrollContent: {
      flex: 1,
      padding: 16,
    },
    patternSection: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    patternFlow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    patternNode: {
      flex: 1,
      alignItems: 'center',
    },
    patternIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    patternLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textPrimary,
      textAlign: 'center',
    },
    patternArrow: {
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    patternLine: {
      width: 30,
      height: 2,
      backgroundColor: theme.border,
      marginBottom: -10,
    },
    patternLag: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 6,
    },
    patternOccurrences: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    headline: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
      lineHeight: 24,
      marginBottom: 8,
    },
    body: {
      fontSize: 15,
      color: theme.textSecondary,
      lineHeight: 22,
      marginBottom: 16,
    },
    dataChangeSection: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    dataChangeText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginLeft: 8,
      flex: 1,
    },
    undoBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.accent + '15',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    undoText: {
      fontSize: 12,
      color: theme.accent,
      marginLeft: 4,
    },
    reasoningSection: {
      marginBottom: 16,
    },
    sourcesSection: {
      marginBottom: 16,
    },
    sourcesLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sourceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    sourceText: {
      fontSize: 13,
      color: theme.textPrimary,
      marginLeft: 8,
    },
    actionsSection: {
      flexDirection: 'row',
      gap: 12,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
    },
    actionText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textPrimary,
    },
  });
}
