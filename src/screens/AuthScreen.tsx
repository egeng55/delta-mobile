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
import { supabase } from '../services/supabase';

interface AuthScreenProps {
  theme: Theme;
}

type AuthMode = 'login' | 'signup';
type SignupStep = 1 | 2;
type Gender = 'male' | 'female' | 'other' | '';

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export default function AuthScreen({ theme }: AuthScreenProps): React.ReactNode {
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signup');
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<Gender>('');
  const [isCheckingUsername, setIsCheckingUsername] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const handleSubmit = async (): Promise<void> => {
    setError('');
    setSuccessMessage('');

    if (mode === 'login') {
      // Login validation
      if (email.trim().length === 0) {
        setError('Email is required');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await login(email.trim(), password);
        if (result.success !== true) {
          setError(result.error ?? 'Authentication failed');
        }
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    } else if (signupStep === 1) {
      // Signup step 1 validation
      if (name.trim().length === 0) {
        setError('Name is required');
        return;
      }
      if (email.trim().length === 0) {
        setError('Email is required');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      // Move to step 2
      setSignupStep(2);
    } else {
      // Signup step 2 validation
      const trimmedUsername = username.trim().toLowerCase();

      // Username validation
      if (trimmedUsername.length < 3) {
        setError('Username must be at least 3 characters');
        return;
      }
      if (trimmedUsername.length > 20) {
        setError('Username must be 20 characters or less');
        return;
      }
      if (!/^[a-z0-9_]+$/.test(trimmedUsername)) {
        setError('Username can only contain letters, numbers, and underscores');
        return;
      }

      // Age validation
      if (age.trim().length === 0) {
        setError('Age is required');
        return;
      }
      const ageNum = parseInt(age, 10);
      if (isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
        setError('Please enter a valid age (13-120)');
        return;
      }
      if (gender.length === 0) {
        setError('Please select a gender');
        return;
      }

      setIsSubmitting(true);
      try {
        // Check if username is taken
        setIsCheckingUsername(true);
        const { data: existingUser, error: checkError } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', trimmedUsername)
          .maybeSingle();
        setIsCheckingUsername(false);

        if (checkError && checkError.code !== 'PGRST116') {
          setError('Could not verify username availability');
          setIsSubmitting(false);
          return;
        }

        if (existingUser !== null) {
          setError('This username is already taken');
          setIsSubmitting(false);
          return;
        }

        const result = await signup(email.trim(), password, name.trim(), trimmedUsername, ageNum, gender);
        if (result.success === true) {
          setSuccessMessage('Account created! Check your email to verify.');
        } else {
          setError(result.error ?? 'Authentication failed');
        }
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setIsSubmitting(false);
        setIsCheckingUsername(false);
      }
    }
  };

  const handleBack = (): void => {
    setSignupStep(1);
    setError('');
  };

  const toggleMode = (): void => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setSignupStep(1);
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
            {mode === 'login'
              ? 'Welcome back'
              : signupStep === 1
                ? 'Create account'
                : 'About you'}
          </Text>

          {mode === 'signup' && signupStep === 2 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          )}

          {mode === 'login' ? (
            <>
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
            </>
          ) : signupStep === 1 ? (
            <>
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
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={theme.textSecondary}
                value={username}
                onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
                editable={isSubmitting !== true}
                maxLength={20}
              />
              <Text style={styles.usernameHint}>Letters, numbers, and underscores only</Text>

              <TextInput
                style={styles.input}
                placeholder="Age"
                placeholderTextColor={theme.textSecondary}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                editable={isSubmitting !== true}
              />

              <Text style={styles.genderLabel}>Gender</Text>
              <View style={styles.genderOptions}>
                {GENDER_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.genderOption,
                      gender === option.value && styles.genderOptionSelected,
                    ]}
                    onPress={() => setGender(option.value)}
                    disabled={isSubmitting === true}
                  >
                    <Text
                      style={[
                        styles.genderOptionText,
                        gender === option.value && styles.genderOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

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
                {mode === 'login'
                  ? 'Sign in'
                  : signupStep === 1
                    ? 'Continue'
                    : 'Create account'}
              </Text>
            )}
          </TouchableOpacity>

          {(mode === 'login' || signupStep === 1) && (
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
          )}
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
      fontWeight: '300',
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
    backButton: {
      marginBottom: 16,
    },
    backButtonText: {
      color: theme.accent,
      fontSize: 15,
    },
    usernameHint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: -12,
      marginBottom: 16,
      marginLeft: 4,
    },
    genderLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 12,
    },
    genderOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    genderOption: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    genderOptionSelected: {
      backgroundColor: theme.accentLight,
      borderColor: theme.accent,
    },
    genderOptionText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    genderOptionTextSelected: {
      color: theme.accent,
      fontWeight: '600',
    },
  });
}
