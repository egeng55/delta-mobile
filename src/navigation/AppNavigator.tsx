/**
 * App Navigator - Root navigation structure.
 *
 * ARCHITECTURE (V2 Redesign):
 * 3-tab navigation: Today | Dashboard | You
 * + Delta pull-tab bottom sheet chat (overlays all tabs)
 *
 * - Today: Welcome + Delta-prioritized insight modules
 * - Dashboard: Delta-curated trend visualizations
 * - You: Patterns, Delta's brain, profile
 * - △ Pull-tab: Centered above tab bar, drags up to reveal chat sheet
 */

import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, Modal } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { DeltaLogoSimple } from '../components/DeltaLogo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { DeltaUIProvider } from '../context/DeltaUIContext';

// Screens
import AuthScreen from '../screens/AuthScreen';
import DailyInsightsScreen from '../screens/DailyInsightsScreen';
import DashboardScreen from '../screens/DashboardScreen';
import YouScreen from '../screens/YouScreen';
import SettingsScreen from '../screens/SettingsScreen';
import WelcomeAnimationScreen from '../screens/WelcomeAnimationScreen';
import OnboardingScreen, { hasCompletedOnboarding } from '../screens/OnboardingScreen';

// Chat bottom sheet
import ChatBottomSheet, { ChatBottomSheetRef } from '../components/Chat/ChatBottomSheet';

// Type definitions
export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
};

export type MainTabParamList = {
  Today: undefined;
  Dashboard: undefined;
  You: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Bottom tab navigator - 3 tabs: Today | Dashboard | You
 * + ChatBottomSheet overlay
 */
function MainTabs(): React.ReactNode {
  const { theme } = useTheme();
  const [settingsVisible, setSettingsVisible] = useState<boolean>(false);
  const chatRef = useRef<ChatBottomSheetRef>(null);

  const openSettings = (): void => {
    setSettingsVisible(true);
  };

  const closeSettings = (): void => {
    setSettingsVisible(false);
  };

  const handleOpenChat = (prefill?: string): void => {
    chatRef.current?.openFull(prefill);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DeltaUIProvider>
      <View style={{ flex: 1 }}>
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
            tabBarShowLabel: false,
          }}
        >
          <Tab.Screen
            name="Today"
            options={{
              tabBarIcon: ({ color }) => (
                <DeltaLogoSimple size={26} color={color} />
              ),
            }}
          >
            {() => <DailyInsightsScreen theme={theme} onOpenChat={handleOpenChat} />}
          </Tab.Screen>

          <Tab.Screen
            name="Dashboard"
            options={{
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="stats-chart-outline" size={size} color={color} />
              ),
            }}
          >
            {() => <DashboardScreen theme={theme} />}
          </Tab.Screen>

          <Tab.Screen
            name="You"
            options={{
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="person-outline" size={size} color={color} />
              ),
            }}
          >
            {() => <YouScreen theme={theme} onOpenSettings={openSettings} />}
          </Tab.Screen>
        </Tab.Navigator>

        {/* Chat Bottom Sheet — overlays all tabs */}
        <ChatBottomSheet ref={chatRef} theme={theme} />
      </View>

      </DeltaUIProvider>

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
    </GestureHandlerRootView>
  );
}

/**
 * Root navigator component.
 */
export default function AppNavigator(): React.ReactNode {
  const { isLoading, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const [showWelcome, setShowWelcome] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState<boolean>(true);
  const wasAuthenticated = useRef<boolean>(false);

  useEffect(() => {
    const checkOnboarding = async (): Promise<void> => {
      const completed = await hasCompletedOnboarding();
      setShowOnboarding(completed !== true);
      setIsCheckingOnboarding(false);
    };
    checkOnboarding();
  }, []);

  useEffect(() => {
    if (isAuthenticated === true && wasAuthenticated.current === false) {
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

  if (isLoading === true || isCheckingOnboarding === true) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (showOnboarding === true && isAuthenticated !== true) {
    return (
      <OnboardingScreen theme={theme} onComplete={handleOnboardingComplete} />
    );
  }

  if (showWelcome === true && isAuthenticated === true) {
    return (
      <WelcomeAnimationScreen theme={theme} onComplete={handleWelcomeComplete} />
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
