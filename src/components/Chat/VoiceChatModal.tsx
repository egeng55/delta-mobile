/**
 * VoiceChatModal - On-device speech-to-text (free, no API costs)
 *
 * Uses iOS/Android built-in speech recognition. May pause after
 * periods of silence - user can tap to continue recording.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';
import { Theme } from '../../theme/colors';
import DeltaLogo from '../DeltaLogo';

interface VoiceChatModalProps {
  visible: boolean;
  theme: Theme;
  onClose: () => void;
  onSend: (text: string) => void;
}

export default function VoiceChatModal({
  visible,
  theme,
  onClose,
  onSend,
}: VoiceChatModalProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [isListening, setIsListening] = useState(false);
  const [currentPartial, setCurrentPartial] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Store accumulated text from multiple listening sessions
  const accumulatedText = useRef<string>('');
  const [displayText, setDisplayText] = useState('');

  // Pulsing animation
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  useEffect(() => {
    if (isListening) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 800, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.1, { duration: 800 }),
          withTiming(0.3, { duration: 800 })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = withTiming(1, { duration: 200 });
      pulseOpacity.value = withTiming(0.3, { duration: 200 });
    }
  }, [isListening]);

  // Voice event handlers
  const onSpeechResults = useCallback((e: SpeechResultsEvent) => {
    if (e.value && e.value.length > 0) {
      const result = e.value[0];
      setCurrentPartial(result);
      // Update display with accumulated + current
      const full = accumulatedText.current
        ? `${accumulatedText.current} ${result}`
        : result;
      setDisplayText(full);
    }
  }, []);

  const onSpeechError = useCallback((e: SpeechErrorEvent) => {
    console.log('[Voice] Error:', e.error);
    setIsListening(false);
    // Save current partial to accumulated on error
    if (currentPartial) {
      accumulatedText.current = accumulatedText.current
        ? `${accumulatedText.current} ${currentPartial}`
        : currentPartial;
      setCurrentPartial('');
    }
  }, [currentPartial]);

  const onSpeechEnd = useCallback(() => {
    console.log('[Voice] Speech ended');
    setIsListening(false);
    // Save current partial to accumulated
    if (currentPartial) {
      accumulatedText.current = accumulatedText.current
        ? `${accumulatedText.current} ${currentPartial}`
        : currentPartial;
      setDisplayText(accumulatedText.current);
      setCurrentPartial('');
    }
  }, [currentPartial]);

  // Set up voice listeners
  useEffect(() => {
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechEnd = onSpeechEnd;

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, [onSpeechResults, onSpeechError, onSpeechEnd]);

  // Reset when modal opens/closes
  useEffect(() => {
    if (visible) {
      accumulatedText.current = '';
      setDisplayText('');
      setCurrentPartial('');
      setError(null);
      startListening();
    } else {
      stopListening();
      accumulatedText.current = '';
      setDisplayText('');
      setCurrentPartial('');
    }
  }, [visible]);

  const startListening = async () => {
    try {
      setError(null);
      setIsListening(true);
      await Voice.start('en-US');
    } catch (e) {
      console.log('[Voice] Start error:', e);
      setError('Failed to start. Tap mic to retry.');
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
      setIsListening(false);
    } catch (e) {
      console.log('[Voice] Stop error:', e);
    }
  };

  const handleMicPress = () => {
    if (isListening) {
      // Stop listening
      stopListening();
    } else {
      // Start/continue listening
      startListening();
    }
  };

  const handleSend = () => {
    const finalText = displayText.trim();
    if (finalText) {
      stopListening();
      onSend(finalText);
      onClose();
    }
  };

  const handleCancel = () => {
    stopListening();
    Voice.destroy().catch(() => {});
    onClose();
  };

  const handleClear = () => {
    accumulatedText.current = '';
    setDisplayText('');
    setCurrentPartial('');
  };

  const hasText = displayText.trim().length > 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleCancel}
    >
      <View style={[styles.overlay, { backgroundColor: theme.background + 'F5' }]}>
        <Pressable style={styles.closeArea} onPress={handleCancel} />

        <View style={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
          {/* Delta logo */}
          <DeltaLogo size={48} strokeColor={theme.accent} />

          {/* Status */}
          <Text style={[styles.statusText, { color: theme.textSecondary }]}>
            {isListening
              ? 'Listening...'
              : hasText
              ? 'Tap mic to add more, or send'
              : error || 'Tap mic to start'}
          </Text>

          {/* Transcript area */}
          <ScrollView
            style={styles.transcriptScroll}
            contentContainerStyle={styles.transcriptContent}
          >
            <Text
              style={[
                styles.transcript,
                { color: hasText ? theme.textPrimary : theme.textSecondary },
              ]}
            >
              {displayText || (isListening ? 'Start speaking...' : 'Tap the mic button to start')}
            </Text>
          </ScrollView>

          {/* Clear button if there's text */}
          {hasText && !isListening && (
            <Pressable onPress={handleClear} style={styles.clearButton}>
              <Text style={[styles.clearText, { color: theme.textSecondary }]}>
                Clear and start over
              </Text>
            </Pressable>
          )}

          {/* Mic button */}
          <View style={styles.micContainer}>
            {isListening && (
              <Animated.View
                style={[
                  styles.pulse,
                  { backgroundColor: theme.accent },
                  pulseStyle,
                ]}
              />
            )}
            <Pressable
              onPress={handleMicPress}
              style={[
                styles.micButton,
                { backgroundColor: isListening ? theme.accent : theme.surface },
              ]}
            >
              <Ionicons
                name={isListening ? 'pause' : 'mic'}
                size={36}
                color={isListening ? '#fff' : theme.accent}
              />
            </Pressable>
          </View>

          {/* Hint */}
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            {isListening
              ? 'Tap to pause'
              : hasText
              ? 'Tap to continue speaking'
              : 'On-device recognition (free)'}
          </Text>

          {/* Action buttons */}
          <View style={styles.actions}>
            <Pressable
              onPress={handleCancel}
              style={[styles.actionButton, { backgroundColor: theme.surface }]}
            >
              <Text style={[styles.actionText, { color: theme.textSecondary }]}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSend}
              disabled={!hasText}
              style={[
                styles.actionButton,
                styles.sendButton,
                { backgroundColor: hasText ? theme.accent : theme.surface },
              ]}
            >
              <Text
                style={[
                  styles.actionText,
                  { color: hasText ? '#fff' : theme.textSecondary },
                ]}
              >
                Send
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  closeArea: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  statusText: {
    fontSize: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  transcriptScroll: {
    maxHeight: 150,
    width: '100%',
  },
  transcriptContent: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  transcript: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 26,
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  clearText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  micContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  pulse: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    fontSize: 12,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
  },
  sendButton: {
    minWidth: 140,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
