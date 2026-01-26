/**
 * AlignmentRing - Circular progress showing alignment score.
 *
 * Shows how well user's patterns align with their chronotype.
 * Tap to see optimal windows and educational content.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Theme } from '../../theme/colors';
import { Chronotype } from '../../services/api';
import {
  getChronotypeInfo,
  getAlignmentTip,
  ChronotypeId,
} from '../../content/chronotypeEducation';

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

type ModalTab = 'overview' | 'schedule' | 'tips';

export default function AlignmentRing({
  theme,
  score,
  confidence,
  chronotype,
  optimalWindows,
}: AlignmentRingProps): React.ReactNode {
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('overview');

  // Get educational content
  const chronotypeInfo = getChronotypeInfo(chronotype as ChronotypeId);
  const alignmentTip = getAlignmentTip(score);

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

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            {(['overview', 'schedule', 'tips'] as ModalTab[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {activeTab === 'overview' && (
              <Animated.View entering={FadeIn}>
                {/* Chronotype Card */}
                <View style={styles.chronotypeCard}>
                  <Text style={styles.chronotypeEmoji}>{chronotypeInfo.emoji}</Text>
                  <Text style={styles.chronotypeName}>{chronotypeInfo.name}</Text>
                  <Text style={styles.confidenceLabel}>
                    {Math.round(confidence * 100)}% confidence
                  </Text>
                </View>

                {/* Description */}
                <View style={styles.section}>
                  <Text style={styles.descriptionText}>{chronotypeInfo.description}</Text>
                </View>

                {/* Alignment Status */}
                <View style={[styles.alignmentCard, { backgroundColor: getScoreColor() + '15' }]}>
                  <View style={styles.alignmentHeader}>
                    <Text style={[styles.alignmentLabel, { color: getScoreColor() }]}>
                      {alignmentTip.label}
                    </Text>
                    <Text style={[styles.alignmentScore, { color: getScoreColor() }]}>
                      {Math.round(score)}%
                    </Text>
                  </View>
                  <Text style={styles.alignmentDescription}>{alignmentTip.description}</Text>
                </View>

                {/* Characteristics */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Characteristics</Text>
                  {chronotypeInfo.characteristics.map((char, idx) => (
                    <View key={idx} style={styles.listItem}>
                      <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                      <Text style={styles.listItemText}>{char}</Text>
                    </View>
                  ))}
                </View>

                {/* Peak Hours */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Your Peak Hours</Text>
                  <View style={styles.peakHoursGrid}>
                    <View style={styles.peakHourCard}>
                      <Ionicons name="flash" size={20} color={theme.accent} />
                      <Text style={styles.peakHourLabel}>Alertness</Text>
                      <Text style={styles.peakHourTime}>{chronotypeInfo.peakHours.alertness}</Text>
                    </View>
                    <View style={styles.peakHourCard}>
                      <Ionicons name="bulb" size={20} color="#EAB308" />
                      <Text style={styles.peakHourLabel}>Creativity</Text>
                      <Text style={styles.peakHourTime}>{chronotypeInfo.peakHours.creativity}</Text>
                    </View>
                    <View style={styles.peakHourCard}>
                      <Ionicons name="barbell" size={20} color="#22C55E" />
                      <Text style={styles.peakHourLabel}>Physical</Text>
                      <Text style={styles.peakHourTime}>{chronotypeInfo.peakHours.physical}</Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            )}

            {activeTab === 'schedule' && (
              <Animated.View entering={FadeIn}>
                <Text style={styles.sectionTitle}>Optimal Schedule</Text>
                <Text style={styles.sectionSubtitle}>
                  Based on your {chronotypeInfo.name.toLowerCase()} chronotype
                </Text>

                <Animated.View entering={FadeInDown.delay(100)} style={styles.windowCard}>
                  <View style={[styles.windowIcon, { backgroundColor: '#6366F120' }]}>
                    <Ionicons name="sunny-outline" size={20} color="#6366F1" />
                  </View>
                  <View style={styles.windowContent}>
                    <Text style={styles.windowLabel}>Wake Time</Text>
                    <Text style={styles.windowTime}>{chronotypeInfo.optimalSchedule.wakeTime}</Text>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(150)} style={styles.windowCard}>
                  <View style={[styles.windowIcon, { backgroundColor: '#8B5CF620' }]}>
                    <Ionicons name="moon-outline" size={20} color="#8B5CF6" />
                  </View>
                  <View style={styles.windowContent}>
                    <Text style={styles.windowLabel}>Sleep Time</Text>
                    <Text style={styles.windowTime}>{chronotypeInfo.optimalSchedule.sleepTime}</Text>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200)} style={styles.windowCard}>
                  <View style={[styles.windowIcon, { backgroundColor: '#22C55E20' }]}>
                    <Ionicons name="barbell-outline" size={20} color="#22C55E" />
                  </View>
                  <View style={styles.windowContent}>
                    <Text style={styles.windowLabel}>Workout Window</Text>
                    <Text style={styles.windowTime}>{chronotypeInfo.optimalSchedule.workoutWindow}</Text>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(250)} style={styles.windowCard}>
                  <View style={[styles.windowIcon, { backgroundColor: '#F9731620' }]}>
                    <Ionicons name="bulb-outline" size={20} color="#F97316" />
                  </View>
                  <View style={styles.windowContent}>
                    <Text style={styles.windowLabel}>Focus Window</Text>
                    <Text style={styles.windowTime}>{chronotypeInfo.optimalSchedule.focusWindow}</Text>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(300)} style={styles.windowCard}>
                  <View style={[styles.windowIcon, { backgroundColor: '#EC489920' }]}>
                    <Ionicons name="cafe-outline" size={20} color="#EC4899" />
                  </View>
                  <View style={styles.windowContent}>
                    <Text style={styles.windowLabel}>Wind Down</Text>
                    <Text style={styles.windowTime}>{chronotypeInfo.optimalSchedule.windDown}</Text>
                  </View>
                </Animated.View>

                {/* Personalized windows if available */}
                {optimalWindows !== undefined && (
                  <View style={styles.personalizedSection}>
                    <Text style={styles.personalizedTitle}>Your Personalized Windows</Text>
                    <Text style={styles.personalizedSubtitle}>Based on your actual sleep data</Text>

                    <View style={styles.personalizedCard}>
                      <View style={styles.personalizedRow}>
                        <Text style={styles.personalizedLabel}>Optimal Sleep</Text>
                        <Text style={styles.personalizedValue}>
                          {optimalWindows.optimal_sleep} - {optimalWindows.optimal_wake}
                        </Text>
                      </View>
                      <View style={styles.personalizedRow}>
                        <Text style={styles.personalizedLabel}>Workout</Text>
                        <Text style={styles.personalizedValue}>
                          {optimalWindows.workout_window.start} - {optimalWindows.workout_window.end}
                        </Text>
                      </View>
                      <View style={styles.personalizedRow}>
                        <Text style={styles.personalizedLabel}>Focus</Text>
                        <Text style={styles.personalizedValue}>
                          {optimalWindows.focus_window.start} - {optimalWindows.focus_window.end}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </Animated.View>
            )}

            {activeTab === 'tips' && (
              <Animated.View entering={FadeIn}>
                {/* Improvement Suggestions */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Improve Your Alignment</Text>
                  <Text style={styles.sectionSubtitle}>
                    Current: {alignmentTip.label}
                  </Text>
                  {alignmentTip.suggestions.map((suggestion, idx) => (
                    <View key={idx} style={styles.tipItem}>
                      <View style={[styles.tipNumber, { backgroundColor: theme.accent }]}>
                        <Text style={styles.tipNumberText}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.tipText}>{suggestion}</Text>
                    </View>
                  ))}
                </View>

                {/* General Tips */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Tips for {chronotypeInfo.name}s</Text>
                  {chronotypeInfo.tips.map((tip, idx) => (
                    <View key={idx} style={styles.listItem}>
                      <Ionicons name="bulb" size={16} color={theme.warning} />
                      <Text style={styles.listItemText}>{tip}</Text>
                    </View>
                  ))}
                </View>

                {/* Challenges */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Common Challenges</Text>
                  {chronotypeInfo.challenges.map((challenge, idx) => (
                    <View key={idx} style={styles.listItem}>
                      <Ionicons name="alert-circle" size={16} color={theme.error} />
                      <Text style={styles.listItemText}>{challenge}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}

            <Text style={styles.disclaimer}>
              Based on your logged sleep patterns. Not a medical assessment.
            </Text>

            <View style={{ height: 40 }} />
          </ScrollView>
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
    tabsContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.surfaceSecondary,
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: theme.accent,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    tabTextActive: {
      color: '#fff',
    },
    modalContent: {
      flex: 1,
      padding: 16,
    },
    chronotypeCard: {
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 24,
      marginBottom: 16,
    },
    chronotypeEmoji: {
      fontSize: 48,
    },
    chronotypeName: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
      marginTop: 8,
    },
    confidenceLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 8,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 12,
    },
    descriptionText: {
      fontSize: 15,
      color: theme.textSecondary,
      lineHeight: 22,
    },
    alignmentCard: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    alignmentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    alignmentLabel: {
      fontSize: 16,
      fontWeight: '600',
    },
    alignmentScore: {
      fontSize: 24,
      fontWeight: '700',
    },
    alignmentDescription: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 10,
      gap: 10,
    },
    listItemText: {
      flex: 1,
      fontSize: 14,
      color: theme.textPrimary,
      lineHeight: 20,
    },
    peakHoursGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    peakHourCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    peakHourLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 6,
      textAlign: 'center',
    },
    peakHourTime: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textPrimary,
      marginTop: 2,
      textAlign: 'center',
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
    personalizedSection: {
      marginTop: 24,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    personalizedTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    personalizedSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 12,
    },
    personalizedCard: {
      backgroundColor: theme.accentLight,
      borderRadius: 12,
      padding: 14,
    },
    personalizedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    personalizedLabel: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    personalizedValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.accent,
    },
    tipItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
      gap: 12,
    },
    tipNumber: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tipNumberText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#fff',
    },
    tipText: {
      flex: 1,
      fontSize: 14,
      color: theme.textPrimary,
      lineHeight: 20,
    },
    disclaimer: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      fontStyle: 'italic',
      marginTop: 20,
    },
  });
}
