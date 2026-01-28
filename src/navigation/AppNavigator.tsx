/**
 * App Navigator - Root navigation structure.
 *
 * ARCHITECTURE (Conversation-first redesign):
 * 3-tab navigation: Delta (chat) | Journal (log) | You (profile + intelligence)
 *
 * Delta is not a dashboard. It's an AI scientist studying you.
 * The chat IS the app, patterns are the product, transparency is the differentiator.
 *
 * SAFETY DECISIONS:
 * - No custom theme with fonts (caused issues)
 * - Explicit boolean checks for auth state
 * - Simple screen options without complex types
 * - Settings as modal from You tab
 */

import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, Modal } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Screens
import AuthScreen from '../screens/AuthScreen';
import ChatScreen from '../screens/ChatScreen';
import JournalScreen from '../screens/JournalScreen';
import YouScreen from '../screens/YouScreen';
import SettingsScreen from '../screens/SettingsScreen';
import WelcomeAnimationScreen from '../screens/WelcomeAnimationScreen';
import OnboardingScreen, { hasCompletedOnboarding } from '../screens/OnboardingScreen';

// Type definitions
export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
};

export type MainTabParamList = {
  Delta: undefined;
  Journal: undefined;
  You: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Bottom tab navigator - 3 tabs: Delta | Journal | You
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
            backgroundColor: theme.mode === 'dark' ? '#0A0A0F' : theme.surface,
            borderTopColor: theme.mode === 'dark' ? '#1E1E2E' : theme.border,
            borderTopWidth: 1,
            paddingTop: 12,
            paddingBottom: 30,
            height: 90,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '500',
            marginTop: 2,
          },
        }}
      >
        <Tab.Screen
          name="Delta"
          options={{
            tabBarLabel: 'Delta',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="triangle-outline" size={size} color={color} />
            ),
          }}
        >
          {() => <ChatScreen theme={theme} />}
        </Tab.Screen>

        <Tab.Screen
          name="Journal"
          options={{
            tabBarLabel: 'Journal',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book-outline" size={size} color={color} />
            ),
          }}
        >
          {() => <JournalScreen theme={theme} />}
        </Tab.Screen>

        <Tab.Screen
          name="You"
          options={{
            tabBarLabel: 'You',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        >
          {() => <YouScreen theme={theme} onOpenSettings={openSettings} />}
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
