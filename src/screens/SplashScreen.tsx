/**
 * SplashScreen - App loading screen with Delta logo.
 *
 * Displayed while:
 * - App is initializing
 * - Auth state is being determined
 * - Initial data is loading
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DeltaLogo from '../components/DeltaLogo';

interface SplashScreenProps {
  message?: string;
  showSpinner?: boolean;
}

export default function SplashScreen({
  message = 'Loading...',
  showSpinner = true,
}: SplashScreenProps): React.ReactNode {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <DeltaLogo size={180} strokeColor="#ffffff" />
        <Text style={styles.title}>Delta</Text>
        <Text style={styles.subtitle}>Your AI Health Companion</Text>
      </View>

      {showSpinner && (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color="#6366F1" />
          <Text style={styles.message}>{message}</Text>
        </View>
      )}

      <Text style={styles.disclaimer}>
        Wellness guidance only. Not medical advice.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 24,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 12,
  },
  disclaimer: {
    fontSize: 11,
    color: '#475569',
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
