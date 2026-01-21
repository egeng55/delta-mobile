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
import InsightsScreen from '../screens/InsightsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import WelcomeAnimationScreen from '../screens/WelcomeAnimationScreen';

// Type definitions
export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
};

export type MainTabParamList = {
  Chat: undefined;
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
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            paddingTop: 10,
            paddingBottom: 28,
            height: 85,
          },
        }}
      >
        <Tab.Screen
          name="Chat"
          options={{
            tabBarShowLabel: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubbles-outline" size={size} color={color} />
            ),
          }}
        >
          {() => <ChatScreen theme={theme} />}
        </Tab.Screen>

        <Tab.Screen
          name="Insights"
          options={{
            tabBarShowLabel: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="analytics-outline" size={size} color={color} />
            ),
          }}
        >
          {() => <InsightsScreen theme={theme} />}
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
  const wasAuthenticated = useRef<boolean>(false);

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

  // SAFETY: Explicit boolean check
  if (isLoading === true) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
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
