/**
 * AuditLogScreen - View Delta's data activity history.
 *
 * Shows a timeline of all data modifications:
 * - What was changed
 * - When it happened
 * - Why (Delta's explanation)
 * - Undo capability for reversible actions
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import {
  dataOversightApi,
  AuditLogEntry,
  DataHealthResponse,
} from '../services/api';

interface AuditLogScreenProps {
  theme: Theme;
  onClose?: () => void;
}

// Action type display configuration
const ACTION_CONFIG: Record<
  string,
  { icon: string; label: string; color: (theme: Theme) => string }
> = {
  entry_created: {
    icon: 'add-circle-outline',
    label: 'Created',
    color: (t) => t.success,
  },
  entry_updated: {
    icon: 'pencil-outline',
    label: 'Updated',
    color: (t) => t.accent,
  },
  entry_deleted: {
    icon: 'trash-outline',
    label: 'Deleted',
    color: (t) => t.error,
  },
  entries_merged: {
    icon: 'git-merge-outline',
    label: 'Merged',
    color: (t) => t.warning,
  },
  batch_deleted: {
    icon: 'trash-outline',
    label: 'Batch Deleted',
    color: (t) => t.error,
  },
  value_corrected: {
    icon: 'checkmark-circle-outline',
    label: 'Corrected',
    color: (t) => t.success,
  },
};

// Actor display configuration
const ACTOR_CONFIG: Record<string, { label: string; icon: string }> = {
  user: { label: 'You', icon: 'person-outline' },
  delta_auto: { label: 'Delta (Auto)', icon: 'sparkles' },
  delta_suggested: { label: 'Delta (Approved)', icon: 'checkmark-done' },
  system: { label: 'System', icon: 'cog-outline' },
};

export default function AuditLogScreen({
  theme,
  onClose,
}: AuditLogScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [dataHealth, setDataHealth] = useState<DataHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [undoing, setUndoing] = useState<string | null>(null);

  const styles = createStyles(theme, insets);

  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      const [auditResponse, healthResponse] = await Promise.all([
        dataOversightApi.getAuditLog(userId, 50, 0),
        dataOversightApi.getHealth(userId),
      ]);
      setEntries(auditResponse.entries);
      setDataHealth(healthResponse);
    } catch (error) {
      console.error('Failed to fetch audit log:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleUndo = useCallback(
    async (entry: AuditLogEntry) => {
      if (!entry.is_reversible || entry.reversed_at) {
        Alert.alert('Cannot Undo', 'This action cannot be undone.');
        return;
      }

      Alert.alert(
        'Undo Action',
        `Are you sure you want to undo this ${ACTION_CONFIG[entry.action_type]?.label.toLowerCase() || 'action'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Undo',
            style: 'destructive',
            onPress: async () => {
              setUndoing(entry.audit_id);
              try {
                const result = await dataOversightApi.undoAction(
                  userId,
                  entry.audit_id
                );
                if (result.success) {
                  // Refresh the list
                  fetchData();
                } else {
                  Alert.alert('Error', result.message || 'Failed to undo action');
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to undo action');
              } finally {
                setUndoing(null);
              }
            },
          },
        ]
      );
    },
    [userId, fetchData]
  );

  const renderEntry = ({
    item,
    index,
  }: {
    item: AuditLogEntry;
    index: number;
  }) => {
    const config = ACTION_CONFIG[item.action_type] || {
      icon: 'help-outline',
      label: 'Unknown',
      color: () => theme.textSecondary,
    };
    const actorConfig = ACTOR_CONFIG[item.actor] || ACTOR_CONFIG.system;
    const actionColor = config.color(theme);
    const isReversed = !!item.reversed_at;
    const isUndoing = undoing === item.audit_id;

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 50).springify()}
        style={[styles.entryCard, isReversed && styles.entryCardReversed]}
      >
        {/* Timeline connector */}
        {index > 0 && <View style={styles.timelineConnector} />}

        {/* Icon */}
        <View
          style={[
            styles.entryIcon,
            { backgroundColor: actionColor + '20' },
            isReversed && styles.entryIconReversed,
          ]}
        >
          <Ionicons
            name={config.icon as any}
            size={18}
            color={isReversed ? theme.textSecondary : actionColor}
          />
        </View>

        {/* Content */}
        <View style={styles.entryContent}>
          <View style={styles.entryHeader}>
            <Text
              style={[
                styles.entryTitle,
                isReversed && styles.entryTitleReversed,
              ]}
            >
              {config.label}
            </Text>
            <Text style={styles.entryTime}>{formatTime(item.created_at)}</Text>
          </View>

          {/* Actor */}
          <View style={styles.actorRow}>
            <Ionicons
              name={actorConfig.icon as any}
              size={12}
              color={theme.textSecondary}
            />
            <Text style={styles.actorText}>{actorConfig.label}</Text>
            <Text style={styles.affectedCount}>
              {item.affected_count} item{item.affected_count !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Delta's explanation */}
          {item.delta_explanation && (
            <Text style={styles.explanation}>{item.delta_explanation}</Text>
          )}

          {/* Reason (if different from explanation) */}
          {!item.delta_explanation && item.reason && (
            <Text style={styles.reason}>{item.reason}</Text>
          )}

          {/* Reversed status */}
          {isReversed && (
            <View style={styles.reversedBadge}>
              <Ionicons name="arrow-undo" size={12} color={theme.textSecondary} />
              <Text style={styles.reversedText}>Undone</Text>
            </View>
          )}

          {/* Undo button */}
          {item.is_reversible && !isReversed && (
            <TouchableOpacity
              style={styles.undoButton}
              onPress={() => handleUndo(item)}
              disabled={isUndoing}
            >
              {isUndoing ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : (
                <>
                  <Ionicons name="arrow-undo" size={14} color={theme.accent} />
                  <Text style={styles.undoText}>Undo</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onClose && (
            <TouchableOpacity style={styles.backButton} onPress={onClose}>
              <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>Data Activity</Text>
            <Text style={styles.headerSubtitle}>
              Delta's changes to your data
            </Text>
          </View>
        </View>
      </View>

      {/* Summary card */}
      {dataHealth && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{dataHealth.issue_count}</Text>
            <Text style={styles.summaryLabel}>Open Issues</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {entries.filter((e) => !e.reversed_at).length}
            </Text>
            <Text style={styles.summaryLabel}>Actions</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {entries.filter((e) => e.is_reversible && !e.reversed_at).length}
            </Text>
            <Text style={styles.summaryLabel}>Undoable</Text>
          </View>
        </View>
      )}

      {/* Timeline */}
      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.audit_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="shield-checkmark-outline"
              size={48}
              color={theme.textSecondary}
            />
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptySubtitle}>
              Delta's data modifications will appear here
            </Text>
          </View>
        }
      />
    </View>
  );
}

// Helper function
function formatTime(isoString: string): string {
  const date = new Date(isoString);
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
}

function createStyles(theme: Theme, insets: { top: number; bottom: number }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: insets.top + 12,
      paddingHorizontal: 16,
      paddingBottom: 16,
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      marginRight: 12,
      padding: 4,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    summaryCard: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    summaryLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    summaryDivider: {
      width: 1,
      backgroundColor: theme.border,
      marginVertical: 4,
    },
    listContent: {
      padding: 16,
      paddingBottom: insets.bottom + 16,
    },
    entryCard: {
      flexDirection: 'row',
      marginBottom: 16,
      position: 'relative',
    },
    entryCardReversed: {
      opacity: 0.6,
    },
    timelineConnector: {
      position: 'absolute',
      left: 17,
      top: -16,
      width: 2,
      height: 16,
      backgroundColor: theme.border,
    },
    entryIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    entryIconReversed: {
      backgroundColor: theme.surfaceSecondary,
    },
    entryContent: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    entryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    entryTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    entryTitleReversed: {
      textDecorationLine: 'line-through',
      color: theme.textSecondary,
    },
    entryTime: {
      fontSize: 11,
      color: theme.textSecondary,
    },
    actorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    actorText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginLeft: 4,
    },
    affectedCount: {
      fontSize: 12,
      color: theme.textSecondary,
      marginLeft: 'auto',
    },
    explanation: {
      fontSize: 13,
      color: theme.textPrimary,
      lineHeight: 18,
    },
    reason: {
      fontSize: 12,
      color: theme.textSecondary,
      fontStyle: 'italic',
    },
    reversedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      backgroundColor: theme.surfaceSecondary,
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    reversedText: {
      fontSize: 11,
      color: theme.textSecondary,
      marginLeft: 4,
    },
    undoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.accent + '15',
      borderRadius: 6,
    },
    undoText: {
      fontSize: 12,
      color: theme.accent,
      fontWeight: '500',
      marginLeft: 4,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
  });
}
