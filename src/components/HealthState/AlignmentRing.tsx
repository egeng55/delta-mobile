/**
 * AlignmentRing - Circular progress showing alignment score.
 *
 * Shows how well user's patterns align with their chronotype.
 * Tap to see optimal windows.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Theme } from '../../theme/colors';
import { Chronotype } from '../../services/api';

interface AlignmentRingProps {
  theme: Theme;
  score: number; // 0-100
  confidence: number;
  chronotype: Chronotype;
  optimalWindows?: {
    optimal_wake: string;
    optimal_sleep: string;
    workout_window: { start: string; end: string };
    focus_window: { start: string; end: string };
  };
}

const CHRONOTYPE_LABELS: Record<Chronotype, string> = {
  early_bird: 'Early Bird',
  intermediate: 'Intermediate',
  night_owl: 'Night Owl',
};

const CHRONOTYPE_ICONS: Record<Chronotype, string> = {
  early_bird: 'sunny-outline',
  intermediate: 'time-outline',
  night_owl: 'moon-outline',
};

export default function AlignmentRing({
  theme,
  score,
  confidence,
  chronotype,
  optimalWindows,
}: AlignmentRingProps): React.ReactNode {
  const [showDetails, setShowDetails] = useState<boolean>(false);

  const size = 100;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getScoreColor = (): string => {
    if (score >= 75) return theme.success;
    if (score >= 50) return theme.warning;
    return theme.error;
  };

  const getScoreLabel = (): string => {
    if (score >= 75) return 'Well aligned';
    if (score >= 50) return 'Moderately aligned';
    return 'Misaligned';
  };

  const styles = createStyles(theme);

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={() => setShowDetails(true)}
        activeOpacity={0.8}
      >
        <View style={styles.ringContainer}>
          <Svg width={size} height={size}>
            {/* Background circle */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={theme.border}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Progress circle */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={getScoreColor()}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
          <View style={styles.scoreOverlay}>
            <Text style={[styles.scoreText, { color: getScoreColor() }]}>
              {Math.round(score)}
            </Text>
          </View>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.title}>Alignment</Text>
          <Text style={styles.scoreLabel}>{getScoreLabel()}</Text>
          <View style={styles.chronotypeRow}>
            <Ionicons
              name={CHRONOTYPE_ICONS[chronotype] as any}
              size={14}
              color={theme.accent}
            />
            <Text style={styles.chronotypeText}>
              {CHRONOTYPE_LABELS[chronotype]}
            </Text>
          </View>
          {confidence < 0.5 && (
            <Text style={styles.lowConfidence}>
              More data needed for accuracy
            </Text>
          )}
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.textSecondary}
        />
      </TouchableOpacity>

      {/* Details Modal */}
      <Modal
        visible={showDetails === true}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Your Chronotype</Text>
            <TouchableOpacity onPress={() => setShowDetails(false)}>
              <Ionicons name="close" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          <Animated.View entering={FadeIn} style={styles.modalContent}>
            <View style={styles.chronotypeCard}>
              <Ionicons
                name={CHRONOTYPE_ICONS[chronotype] as any}
                size={48}
                color={theme.accent}
              />
              <Text style={styles.chronotypeName}>
                {CHRONOTYPE_LABELS[chronotype]}
              </Text>
              <Text style={styles.confidenceLabel}>
                {Math.round(confidence * 100)}% confidence
              </Text>
            </View>

            {optimalWindows !== undefined && (
              <View style={styles.windowsSection}>
                <Text style={styles.sectionTitle}>Optimal Windows</Text>

                <Animated.View entering={FadeInDown.delay(100)} style={styles.windowCard}>
                  <View style={styles.windowIcon}>
                    <Ionicons name="bed-outline" size={20} color={theme.accent} />
                  </View>
                  <View style={styles.windowContent}>
                    <Text style={styles.windowLabel}>Sleep</Text>
                    <Text style={styles.windowTime}>
                      {optimalWindows.optimal_sleep} - {optimalWindows.optimal_wake}
                    </Text>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200)} style={styles.windowCard}>
                  <View style={styles.windowIcon}>
                    <Ionicons name="barbell-outline" size={20} color={theme.accent} />
                  </View>
                  <View style={styles.windowContent}>
                    <Text style={styles.windowLabel}>Workout</Text>
                    <Text style={styles.windowTime}>
                      {optimalWindows.workout_window.start} - {optimalWindows.workout_window.end}
                    </Text>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(300)} style={styles.windowCard}>
                  <View style={styles.windowIcon}>
                    <Ionicons name="bulb-outline" size={20} color={theme.accent} />
                  </View>
                  <View style={styles.windowContent}>
                    <Text style={styles.windowLabel}>Focus Time</Text>
                    <Text style={styles.windowTime}>
                      {optimalWindows.focus_window.start} - {optimalWindows.focus_window.end}
                    </Text>
                  </View>
                </Animated.View>
              </View>
            )}

            <Text style={styles.disclaimer}>
              Based on your logged sleep patterns. Not a medical assessment.
            </Text>
          </Animated.View>
        </View>
      </Modal>
    </>
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
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 8,
    },
    ringContainer: {
      position: 'relative',
      marginRight: 14,
    },
    scoreOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scoreText: {
      fontSize: 24,
      fontWeight: '700',
    },
    infoContainer: {
      flex: 1,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    scoreLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textPrimary,
      marginTop: 2,
    },
    chronotypeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    chronotypeText: {
      fontSize: 12,
      color: theme.accent,
      marginLeft: 4,
    },
    lowConfidence: {
      fontSize: 10,
      color: theme.textSecondary,
      marginTop: 4,
      fontStyle: 'italic',
    },
    // Modal styles
    modalContainer: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    modalContent: {
      padding: 16,
    },
    chronotypeCard: {
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 24,
      marginBottom: 24,
    },
    chronotypeName: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
      marginTop: 12,
    },
    confidenceLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
    },
    windowsSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 12,
    },
    windowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    windowIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    windowContent: {
      flex: 1,
    },
    windowLabel: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    windowTime: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
      marginTop: 2,
    },
    disclaimer: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      fontStyle: 'italic',
    },
  });
}
