/**
 * App Navigator - Root navigation structure.
 *
 * SAFETY DECISIONS:
 * - No custom theme with fonts (caused issues)
 * - Explicit boolean checks for auth state
 * - Simple screen options without complex types
 * - Settings as modal from Profile
 */

import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet, Modal } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Screens
import AuthScreen from '../screens/AuthScreen';
import ChatScreen from '../screens/ChatScreen';
import ActivityScreen from '../screens/ActivityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import WelcomeAnimationScreen from '../screens/WelcomeAnimationScreen';
import OnboardingScreen, { hasCompletedOnboarding } from '../screens/OnboardingScreen';

// Navigators
import InsightsNavigator from './InsightsNavigator';
// Note: Using RevenueCat's built-in Paywall UI instead of custom PaywallScreen
// Access showPaywall() from useAccess() to present the paywall

// Type definitions
export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
};

export type MainTabParamList = {
  Chat: undefined;
  Activity: undefined;
  Insights: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Bottom tab navigator for authenticated users.
 * SAFETY: Icon names are typed, no dynamic string interpolation.
 */
function MainTabs(): React.ReactNode {
  const { theme } = useTheme();
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false);

  const openSettings = (): void => {
    setSettingsVisible(true);
  };

  const closeSettings = (): void => {
    setSettingsVisible(false);
  };

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.textPrimary,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.mode === 'dark' ? '#000000' : theme.surface,
            borderTopColor: theme.mode === 'dark' ? '#1a1a1a' : theme.border,
            borderTopWidth: 1,
            paddingTop: 12,
            paddingBottom: 30,
            height: 90,
          },
        }}
      >
        <Tab.Screen
          name="Chat"
          options={{
            tabBarShowLabel: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="triangle-outline" size={size} color={color} />
            ),
          }}
        >
          {() => <ChatScreen theme={theme} />}
        </Tab.Screen>

        <Tab.Screen
          name="Activity"
          options={{
            tabBarShowLabel: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="barbell-outline" size={size} color={color} />
            ),
          }}
        >
          {() => <ActivityScreen theme={theme} />}
        </Tab.Screen>

        <Tab.Screen
          name="Insights"
          options={{
            tabBarShowLabel: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart-outline" size={size} color={color} />
            ),
          }}
        >
          {() => <InsightsNavigator theme={theme} />}
        </Tab.Screen>

        <Tab.Screen
          name="Profile"
          options={{
            tabBarShowLabel: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        >
          {() => <ProfileScreen theme={theme} onOpenSettings={openSettings} />}
        </Tab.Screen>
      </Tab.Navigator>

      {/* Settings Modal */}
      <Modal
        visible={settingsVisible === true}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeSettings}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <SettingsScreen theme={theme} onClose={closeSettings} />
        </View>
      </Modal>
    </>
  );
}

/**
 * Root navigator component.
 * SAFETY: Explicit boolean checks, no NavigationContainer theme prop.
 */
export default function AppNavigator(): React.ReactNode {
  const { isLoading, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const [showWelcome, setShowWelcome] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState<boolean>(true);
  const wasAuthenticated = useRef<boolean>(false);

  // Check if onboarding has been completed
  useEffect(() => {
    const checkOnboarding = async (): Promise<void> => {
      const completed = await hasCompletedOnboarding();
      setShowOnboarding(completed !== true);
      setIsCheckingOnboarding(false);
    };
    checkOnboarding();
  }, []);

  // Track auth state changes to trigger welcome animation on login
  useEffect(() => {
    if (isAuthenticated === true && wasAuthenticated.current === false) {
      // User just logged in - show welcome animation
      setShowWelcome(true);
    }
    wasAuthenticated.current = isAuthenticated === true;
  }, [isAuthenticated]);

  const handleWelcomeComplete = (): void => {
    setShowWelcome(false);
  };

  const handleOnboardingComplete = (): void => {
    setShowOnboarding(false);
  };

  // SAFETY: Explicit boolean check
  if (isLoading === true || isCheckingOnboarding === true) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // Show onboarding on first launch (before auth)
  if (showOnboarding === true && isAuthenticated !== true) {
    return (
      <OnboardingScreen theme={theme} onComplete={handleOnboardingComplete} />
    );
  }

  // Show welcome animation after login
  if (showWelcome === true && isAuthenticated === true) {
    return (
      <WelcomeAnimationScreen theme={theme} onComplete={handleWelcomeComplete} />
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* SAFETY: Explicit boolean comparison */}
        {isAuthenticated === true ? (
          <Stack.Screen name="MainTabs" component={MainTabs} />
        ) : (
          <Stack.Screen name="Auth">
            {() => <AuthScreen theme={theme} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
  },
});
