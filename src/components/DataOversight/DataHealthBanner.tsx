/**
 * DataHealthBanner - Shows when Delta detects data issues.
 *
 * Displays on dashboard to notify users of:
 * - Duplicate entries
 * - Anomalies (unusual values)
 * - Impossible values
 *
 * Tappable to view details and approve/reject corrections.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { Theme } from '../../theme/colors';
import { DataIssue } from '../../services/api';

interface DataHealthBannerProps {
  theme: Theme;
  issues: DataIssue[];
  onPress: () => void;
  onDismiss?: () => void;
}

export default function DataHealthBanner({
  theme,
  issues,
  onPress,
  onDismiss,
}: DataHealthBannerProps): React.ReactNode {
  if (issues.length === 0) return null;

  const styles = createStyles(theme);

  // Categorize issues
  const duplicates = issues.filter((i) => i.type === 'duplicate').length;
  const anomalies = issues.filter((i) => i.type === 'anomaly').length;
  const impossible = issues.filter((i) => i.type === 'impossible_value').length;

  // Get severity color
  const hasHighSeverity = issues.some(
    (i) => i.severity === 'high' || i.severity === 'critical'
  );
  const bannerColor = hasHighSeverity ? theme.warning : theme.accent;

  // Create summary message
  const parts: string[] = [];
  if (duplicates > 0) parts.push(`${duplicates} duplicate${duplicates > 1 ? 's' : ''}`);
  if (anomalies > 0) parts.push(`${anomalies} anomal${anomalies > 1 ? 'ies' : 'y'}`);
  if (impossible > 0) parts.push(`${impossible} issue${impossible > 1 ? 's' : ''}`);
  const summary = parts.join(', ');

  return (
    <Animated.View
      entering={FadeInDown.springify()}
      exiting={FadeOutUp.springify()}
    >
      <TouchableOpacity
        style={[styles.container, { borderColor: bannerColor + '40' }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={[styles.iconContainer, { backgroundColor: bannerColor + '20' }]}>
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color={bannerColor}
          />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Delta found data issues</Text>
          <Text style={styles.subtitle}>
            {summary} detected in your tracking data
          </Text>
        </View>

        <View style={styles.actions}>
          {onDismiss && (
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={onDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Compact version for inline display.
 */
export function DataHealthIndicator({
  theme,
  issueCount,
  onPress,
}: {
  theme: Theme;
  issueCount: number;
  onPress: () => void;
}): React.ReactNode {
  if (issueCount === 0) return null;

  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.warning + '15',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
      onPress={onPress}
    >
      <Ionicons name="alert-circle" size={14} color={theme.warning} />
      <Text
        style={{
          fontSize: 12,
          color: theme.warning,
          marginLeft: 6,
          fontWeight: '500',
        }}
      >
        {issueCount} data issue{issueCount !== 1 ? 's' : ''}
      </Text>
    </TouchableOpacity>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dismissButton: {
      padding: 4,
    },
  });
}
