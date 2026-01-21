/**
 * AuthScreen - Login and Signup screen with Supabase.
 *
 * Design: Clean, minimal, no card/box around form.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

interface AuthScreenProps {
  theme: Theme;
}

type AuthMode = 'login' | 'signup';

export default function AuthScreen({ theme }: AuthScreenProps): React.ReactNode {
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const handleSubmit = async (): Promise<void> => {
    setError('');
    setSuccessMessage('');

    // Validation
    if (email.trim().length === 0) {
      setError('Email is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (mode === 'signup' && name.trim().length === 0) {
      setError('Name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      let result: { success: boolean; error?: string };

      if (mode === 'login') {
        result = await login(email.trim(), password);
      } else {
        result = await signup(email.trim(), password, name.trim());
        if (result.success === true) {
          setSuccessMessage('Account created! Check your email to verify.');
        }
      }

      if (result.success !== true) {
        setError(result.error ?? 'Authentication failed');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = (): void => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setSuccessMessage('');
  };

  const styles = createStyles(theme);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>DELTA</Text>
          <Text style={styles.subtitle}>Health Intelligence</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </Text>

          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              editable={isSubmitting !== true}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={isSubmitting !== true}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
            autoCapitalize="none"
            editable={isSubmitting !== true}
          />

          {error.length > 0 && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {successMessage.length > 0 && (
            <Text style={styles.successText}>{successMessage}</Text>
          )}

          <TouchableOpacity
            style={[styles.button, isSubmitting === true && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting === true}
            activeOpacity={0.8}
          >
            {isSubmitting === true ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleButton}
            onPress={toggleMode}
            disabled={isSubmitting === true}
          >
            <Text style={styles.toggleText}>
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 32,
    },
    header: {
      alignItems: 'center',
      marginBottom: 48,
    },
    title: {
      fontSize: 56,
      fontWeight: '800',
      color: theme.accent,
      letterSpacing: 4,
    },
    subtitle: {
      fontSize: 16,
      color: theme.textSecondary,
      marginTop: 8,
      letterSpacing: 1,
    },
    form: {
      // No card/box styling - blends with background
    },
    formTitle: {
      fontSize: 28,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 32,
    },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.textPrimary,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    errorText: {
      color: theme.error,
      fontSize: 14,
      marginBottom: 16,
    },
    successText: {
      color: theme.success,
      fontSize: 14,
      marginBottom: 16,
    },
    button: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      padding: 18,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 17,
      fontWeight: '600',
    },
    toggleButton: {
      marginTop: 20,
      alignItems: 'center',
    },
    toggleText: {
      color: theme.accent,
      fontSize: 15,
    },
  });
}
