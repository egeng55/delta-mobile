/**
 * ReasoningChain - Visual representation of Delta's thought process.
 *
 * Shows a step-by-step chain of reasoning:
 * Observation -> Analysis -> Inference -> Conclusion
 *
 * Used to build trust by showing HOW Delta arrived at insights,
 * not just WHAT the insight is.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInLeft } from 'react-native-reanimated';
import { Theme } from '../../theme/colors';
import { ReasoningStep } from './types';

interface ReasoningChainProps {
  theme: Theme;
  steps: ReasoningStep[];
  compact?: boolean;
}

// Step type configuration
const STEP_CONFIG: Record<string, {
  icon: string;
  label: string;
  colorKey: keyof Theme;
}> = {
  observation: {
    icon: 'eye-outline',
    label: 'Observed',
    colorKey: 'accent',
  },
  analysis: {
    icon: 'analytics-outline',
    label: 'Analyzed',
    colorKey: 'warning',
  },
  inference: {
    icon: 'bulb-outline',
    label: 'Inferred',
    colorKey: 'sleep',
  },
  conclusion: {
    icon: 'checkmark-circle-outline',
    label: 'Concluded',
    colorKey: 'success',
  },
};

export default function ReasoningChain({
  theme,
  steps,
  compact = false,
}: ReasoningChainProps): React.ReactNode {
  if (!steps || steps.length === 0) {
    return null;
  }

  const styles = createStyles(theme, compact);

  const renderStep = (step: ReasoningStep, index: number, isLast: boolean) => {
    const config = STEP_CONFIG[step.type] || STEP_CONFIG.observation;
    const stepColor = theme[config.colorKey] as string;

    return (
      <Animated.View
        key={index}
        entering={FadeInLeft.delay(index * 100).springify()}
        style={styles.stepContainer}
      >
        {/* Connector line */}
        {!isLast && (
          <View style={styles.connectorContainer}>
            <View style={[styles.connectorLine, { backgroundColor: theme.border }]} />
          </View>
        )}

        {/* Step node */}
        <View style={styles.stepNode}>
          <View style={[styles.iconCircle, { backgroundColor: stepColor + '20' }]}>
            <Ionicons name={config.icon as any} size={compact ? 14 : 16} color={stepColor} />
          </View>
        </View>

        {/* Step content */}
        <View style={styles.stepContent}>
          <View style={styles.stepHeader}>
            <Text style={[styles.stepLabel, { color: stepColor }]}>
              {config.label}
            </Text>
            {step.confidence !== undefined && (
              <View style={[styles.confidencePill, { backgroundColor: stepColor + '15' }]}>
                <Text style={[styles.confidenceText, { color: stepColor }]}>
                  {Math.round(step.confidence * 100)}%
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.stepText}>{step.content}</Text>
          {step.dataPoint && (
            <View style={styles.dataPointContainer}>
              <Ionicons name="document-text-outline" size={12} color={theme.textSecondary} />
              <Text style={styles.dataPointText}>{step.dataPoint}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={14} color={theme.accent} />
        <Text style={styles.headerText}>Delta's Reasoning</Text>
      </View>
      <View style={styles.stepsContainer}>
        {steps.map((step, index) => renderStep(step, index, index === steps.length - 1))}
      </View>
    </View>
  );
}

/**
 * Standalone reasoning step for use outside the full chain.
 */
export function ReasoningStepView({
  theme,
  step,
  showConnector = false,
}: {
  theme: Theme;
  step: ReasoningStep;
  showConnector?: boolean;
}): React.ReactNode {
  const config = STEP_CONFIG[step.type] || STEP_CONFIG.observation;
  const stepColor = theme[config.colorKey] as string;
  const styles = createStepStyles(theme, stepColor);

  return (
    <View style={styles.container}>
      {showConnector && (
        <View style={styles.connector}>
          <View style={styles.connectorDot} />
          <View style={styles.connectorLine} />
        </View>
      )}
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Ionicons name={config.icon as any} size={14} color={stepColor} />
        </View>
        <View style={styles.textWrapper}>
          <Text style={styles.label}>{config.label}</Text>
          <Text style={styles.text}>{step.content}</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: Theme, compact: boolean) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.background,
      borderRadius: 10,
      padding: compact ? 10 : 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.accent,
      marginLeft: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    stepsContainer: {
      paddingLeft: 4,
    },
    stepContainer: {
      flexDirection: 'row',
      marginBottom: compact ? 12 : 16,
      position: 'relative',
    },
    connectorContainer: {
      position: 'absolute',
      left: compact ? 10 : 12,
      top: compact ? 24 : 28,
      bottom: compact ? -12 : -16,
      width: 2,
      alignItems: 'center',
    },
    connectorLine: {
      flex: 1,
      width: 2,
      borderRadius: 1,
    },
    stepNode: {
      marginRight: compact ? 10 : 12,
    },
    iconCircle: {
      width: compact ? 24 : 28,
      height: compact ? 24 : 28,
      borderRadius: compact ? 12 : 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepContent: {
      flex: 1,
      paddingTop: 2,
    },
    stepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    stepLabel: {
      fontSize: compact ? 10 : 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    confidencePill: {
      marginLeft: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    confidenceText: {
      fontSize: 10,
      fontWeight: '600',
    },
    stepText: {
      fontSize: compact ? 12 : 13,
      color: theme.textPrimary,
      lineHeight: compact ? 16 : 18,
    },
    dataPointContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      backgroundColor: theme.surface,
      borderRadius: 6,
      padding: 6,
    },
    dataPointText: {
      fontSize: 11,
      color: theme.textSecondary,
      marginLeft: 6,
      fontStyle: 'italic',
    },
  });
}

function createStepStyles(theme: Theme, stepColor: string) {
  return StyleSheet.create({
    container: {
      marginBottom: 8,
    },
    connector: {
      position: 'absolute',
      left: 10,
      top: -8,
      alignItems: 'center',
    },
    connectorDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
    },
    connectorLine: {
      width: 2,
      height: 8,
      backgroundColor: theme.border,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    iconWrapper: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: stepColor + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    textWrapper: {
      flex: 1,
    },
    label: {
      fontSize: 10,
      fontWeight: '600',
      color: stepColor,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    text: {
      fontSize: 12,
      color: theme.textPrimary,
      lineHeight: 16,
    },
  });
}
