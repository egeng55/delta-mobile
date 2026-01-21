/**
 * App Navigator - Root navigation structure.
 *
 * SAFETY DECISIONS:
 * - No custom theme with fonts (caused issues)
 * - Explicit boolean checks for auth state
 * - Simple screen options without complex types
 * - No animated transitions that could cause issues
 */

import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { Theme } from '../theme/colors';

// Screens
import AuthScreen from '../screens/AuthScreen';
import ChatScreen from '../screens/ChatScreen';
import InsightsScreen from '../screens/InsightsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Type definitions
export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
};

export type MainTabParamList = {
  Chat: undefined;
  Insights: undefined;
  Profile: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

interface MainTabsProps {
  theme: Theme;
}

/**
 * Bottom tab navigator for authenticated users.
 * SAFETY: Icon names are typed, no dynamic string interpolation.
 */
function MainTabs({ theme }: MainTabsProps): React.ReactNode {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
        },
        // SAFETY: No animation config that could cause issues
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
            <Ionicons name="bulb-outline" size={size} color={color} />
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
        {() => <ProfileScreen theme={theme} />}
      </Tab.Screen>

      <Tab.Screen
        name="Settings"
        options={{
          tabBarShowLabel: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      >
        {() => <SettingsScreen theme={theme} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

interface AppNavigatorProps {
  theme: Theme;
}

/**
 * Root navigator component.
 * SAFETY: Explicit boolean checks, no NavigationContainer theme prop.
 */
export default function AppNavigator({ theme }: AppNavigatorProps): React.ReactNode {
  const { isLoading, isAuthenticated } = useAuth();

  // SAFETY: Explicit boolean check
  if (isLoading === true) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* SAFETY: Explicit boolean comparison */}
        {isAuthenticated === true ? (
          <Stack.Screen name="MainTabs">
            {() => <MainTabs theme={theme} />}
          </Stack.Screen>
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
});
