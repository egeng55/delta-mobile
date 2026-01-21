/**
 * Delta Mobile App - Main entry point.
 *
 * SAFETY DECISIONS:
 * - No Suspense or lazy loading
 * - No custom fonts (caused issues)
 * - Explicit theme handling via ThemeContext
 * - Safe color scheme detection
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/context/AuthContext';
import { AccessProvider } from './src/context/AccessContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';

function AppContent(): React.ReactNode {
  const { theme, isDark } = useTheme();

  return (
    <>
      <StatusBar
        barStyle={isDark === true ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />
      <AppNavigator />
    </>
  );
}

export default function App(): React.ReactNode {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AccessProvider>
            <AppContent />
          </AccessProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
