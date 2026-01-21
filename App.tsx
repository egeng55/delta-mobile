/**
 * Delta Mobile App - Main entry point.
 *
 * SAFETY DECISIONS:
 * - No Suspense or lazy loading
 * - No custom fonts (caused issues)
 * - Explicit theme handling
 * - Safe color scheme detection
 */

import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { getTheme } from './src/theme/colors';

export default function App(): React.ReactNode {
  // SAFETY: useColorScheme returns 'light' | 'dark' | null
  const colorScheme = useColorScheme();

  // SAFETY: getTheme handles null/undefined explicitly
  const theme = getTheme(colorScheme);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />
      <AuthProvider>
        <AppNavigator theme={theme} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
