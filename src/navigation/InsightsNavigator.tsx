/**
 * InsightsNavigator - Top tab navigation for Insights screens
 *
 * Screens:
 * - Today: Daily summary, progress rings
 * - Recovery: Sleep, recovery state, heart metrics
 * - History: Calendar view, trends
 *
 * Note: Activity has its own dedicated tab in the bottom nav bar
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../theme/colors';
import { spacing, typography, borderRadius } from '../theme/designSystem';

// Import individual screens
import TodayScreen from '../screens/TodayScreen';
import RecoveryScreen from '../screens/RecoveryScreen';
import HistoryScreen from '../screens/HistoryScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabType = 'today' | 'recovery' | 'history';

interface Tab {
  key: TabType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TABS: Tab[] = [
  { key: 'today', label: 'Today', icon: 'sunny-outline' },
  { key: 'recovery', label: 'Recovery', icon: 'bed-outline' },
  { key: 'history', label: 'History', icon: 'calendar-outline' },
];

interface InsightsNavigatorProps {
  theme: Theme;
}

export default function InsightsNavigator({ theme }: InsightsNavigatorProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const scrollViewRef = useRef<ScrollView>(null);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  const handleTabPress = useCallback((tab: TabType) => {
    const tabIndex = TABS.findIndex(t => t.key === tab);

    // Animate indicator
    Animated.spring(indicatorAnim, {
      toValue: tabIndex,
      useNativeDriver: true,
      tension: 300,
      friction: 30,
    }).start();

    setActiveTab(tab);
  }, [indicatorAnim]);

  // Navigation callbacks for TodayScreen
  const navigateToRecovery = useCallback(() => handleTabPress('recovery'), [handleTabPress]);
  const navigateToHistory = useCallback(() => handleTabPress('history'), [handleTabPress]);

  const styles = createStyles(theme, insets.top);

  const tabWidth = (SCREEN_WIDTH - spacing.lg * 2) / TABS.length;
  const indicatorTranslateX = indicatorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, tabWidth, tabWidth * 2],
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'today':
        return (
          <TodayScreen
            theme={theme}
            isFocused={activeTab === 'today'}
            onNavigateToRecovery={navigateToRecovery}
            onNavigateToHistory={navigateToHistory}
          />
        );
      case 'recovery':
        return <RecoveryScreen theme={theme} isFocused={activeTab === 'recovery'} />;
      case 'history':
        return <HistoryScreen theme={theme} isFocused={activeTab === 'history'} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBarContainer}>
        <View style={styles.tabBar}>
          {/* Animated Indicator */}
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                width: tabWidth - spacing.xs * 2,
                transform: [{ translateX: indicatorTranslateX }],
              },
            ]}
          />

          {/* Tabs */}
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tab}
                onPress={() => handleTabPress(tab.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isActive ? tab.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap : tab.icon}
                  size={18}
                  color={isActive ? theme.accent : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.tabText,
                    isActive && styles.tabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Screen Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>
    </View>
  );
}

function createStyles(theme: Theme, topInset: number) {
  const tabWidth = (SCREEN_WIDTH - spacing.lg * 2) / TABS.length;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    tabBarContainer: {
      paddingTop: topInset + spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: theme.surfaceSecondary,
      borderRadius: borderRadius.md,
      padding: spacing.xs,
      position: 'relative',
    },
    tabIndicator: {
      position: 'absolute',
      top: spacing.xs,
      left: spacing.xs,
      bottom: spacing.xs,
      backgroundColor: theme.surface,
      borderRadius: borderRadius.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      gap: 4,
      zIndex: 1,
    },
    tabText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    tabTextActive: {
      color: theme.accent,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
  });
}
