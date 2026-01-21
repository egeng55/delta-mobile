/**
 * SupportScreen - Contact form for user support requests.
 *
 * SAFETY DECISIONS:
 * - Input validation with length limits
 * - Rate limiting handled by backend (5/hour)
 * - Clear feedback on submission status
 * - Keyboard-aware layout
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { supportApi, ApiError } from '../services/api';

interface SupportScreenProps {
  theme: Theme;
  onClose: () => void;
}

const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;
const MIN_MESSAGE_LENGTH = 10;

export default function SupportScreen({ theme, onClose }: SupportScreenProps): React.ReactNode {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [email, setEmail] = useState<string>(user?.email || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const canSubmit =
    subject.trim().length > 0 &&
    message.trim().length >= MIN_MESSAGE_LENGTH &&
    message.trim().length <= MAX_MESSAGE_LENGTH &&
    isSubmitting === false;

  const handleSubmit = async (): Promise<void> => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to submit a support request.');
      return;
    }

    if (subject.trim().length === 0) {
      Alert.alert('Missing Subject', 'Please enter a subject for your message.');
      return;
    }

    if (message.trim().length < MIN_MESSAGE_LENGTH) {
      Alert.alert('Message Too Short', `Please enter at least ${MIN_MESSAGE_LENGTH} characters.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await supportApi.submit({
        user_id: user.id,
        subject: subject.trim(),
        message: message.trim(),
        user_email: email.trim() || undefined,
        metadata: {
          platform: Platform.OS,
          app_version: '1.0.0',
        },
      });

      Alert.alert(
        'Request Sent',
        'Your message has been sent. We will get back to you as soon as possible.',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 429) {
          Alert.alert(
            'Rate Limit Reached',
            'You have sent too many messages. Please wait an hour before sending another.'
          );
        } else {
          Alert.alert('Error', error.message || 'Could not send your message. Please try again.');
        }
      } else {
        Alert.alert('Error', 'Could not connect to the server. Please check your connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = createStyles(theme, insets.top, insets.bottom);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CONTACT SUPPORT</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.introCard}>
            <Ionicons name="mail-outline" size={28} color={theme.accent} />
            <View style={styles.introText}>
              <Text style={styles.introTitle}>How can we help?</Text>
              <Text style={styles.introSubtitle}>
                Send us a message and we will get back to you as soon as possible.
              </Text>
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Your Email (optional)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="For us to reply back"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Subject */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Subject</Text>
              <Text style={styles.charCount}>{subject.length}/{MAX_SUBJECT_LENGTH}</Text>
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="text-outline" size={18} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={(text) => setSubject(text.slice(0, MAX_SUBJECT_LENGTH))}
                placeholder="What is this about?"
                placeholderTextColor={theme.textSecondary}
                maxLength={MAX_SUBJECT_LENGTH}
              />
            </View>
          </View>

          {/* Message */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Message</Text>
              <Text style={[
                styles.charCount,
                message.length < MIN_MESSAGE_LENGTH && styles.charCountWarning,
              ]}>
                {message.length}/{MAX_MESSAGE_LENGTH}
              </Text>
            </View>
            <View style={[styles.inputContainer, styles.textAreaContainer]}>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={message}
                onChangeText={(text) => setMessage(text.slice(0, MAX_MESSAGE_LENGTH))}
                placeholder="Describe your issue or question in detail..."
                placeholderTextColor={theme.textSecondary}
                maxLength={MAX_MESSAGE_LENGTH}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
            {message.length > 0 && message.length < MIN_MESSAGE_LENGTH && (
              <Text style={styles.validationHint}>
                Please enter at least {MIN_MESSAGE_LENGTH} characters
              </Text>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, canSubmit === false && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={canSubmit === false}
          >
            {isSubmitting === true ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.submitButtonText}>Send Message</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Info */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
            <Text style={styles.infoText}>
              Messages are sent to eric@egeng.co and typically receive a response within 24-48 hours.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: Theme, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollView: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: topInset + 8,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.textPrimary,
      letterSpacing: 1,
    },
    closeButton: {
      padding: 8,
    },
    content: {
      padding: 16,
      paddingBottom: bottomInset + 32,
    },
    introCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.border,
    },
    introText: {
      flex: 1,
      marginLeft: 12,
    },
    introTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 4,
    },
    introSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    inputGroup: {
      marginBottom: 20,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textPrimary,
      marginBottom: 8,
    },
    charCount: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 8,
    },
    charCountWarning: {
      color: theme.warning,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
    },
    inputIcon: {
      marginRight: 8,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: theme.textPrimary,
      paddingVertical: 14,
    },
    textAreaContainer: {
      alignItems: 'flex-start',
      paddingTop: 4,
    },
    textArea: {
      minHeight: 140,
      paddingTop: 12,
    },
    validationHint: {
      fontSize: 12,
      color: theme.warning,
      marginTop: 6,
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
      paddingVertical: 16,
      borderRadius: 12,
      marginTop: 8,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
      marginLeft: 8,
    },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.surfaceSecondary,
      borderRadius: 8,
      padding: 12,
      marginTop: 20,
    },
    infoText: {
      flex: 1,
      fontSize: 12,
      color: theme.textSecondary,
      marginLeft: 8,
      lineHeight: 18,
    },
  });
}
