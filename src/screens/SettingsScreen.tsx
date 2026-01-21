/**
 * SettingsScreen - App settings and preferences.
 *
 * SAFETY DECISIONS:
 * - Simple toggle handling
 * - No complex state
 * - Explicit boolean values
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../theme/colors';

interface SettingsScreenProps {
  theme: Theme;
}

interface SettingToggle {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export default function SettingsScreen({ theme }: SettingsScreenProps): React.ReactNode {
  const insets = useSafeAreaInsets();

  // Settings state - explicit boolean initialization
  const [notifications, setNotifications] = useState<boolean>(true);
  const [dailyReminder, setDailyReminder] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(theme.mode === 'dark');
  const [haptics, setHaptics] = useState<boolean>(true);

  const toggleSettings: SettingToggle[] = [
    {
      id: 'notifications',
      label: 'Push Notifications',
      description: 'Receive health tips and reminders',
      icon: 'notifications-outline',
    },
    {
      id: 'dailyReminder',
      label: 'Daily Check-in Reminder',
      description: 'Get reminded to chat with Delta daily',
      icon: 'alarm-outline',
    },
    {
      id: 'darkMode',
      label: 'Dark Mode',
      description: 'Use dark theme (follows system by default)',
      icon: 'moon-outline',
    },
    {
      id: 'haptics',
      label: 'Haptic Feedback',
      description: 'Vibration feedback for interactions',
      icon: 'phone-portrait-outline',
    },
  ];

  const getToggleValue = (id: string): boolean => {
    switch (id) {
      case 'notifications':
        return notifications === true;
      case 'dailyReminder':
        return dailyReminder === true;
      case 'darkMode':
        return darkMode === true;
      case 'haptics':
        return haptics === true;
      default:
        return false;
    }
  };

  const handleToggle = (id: string, value: boolean): void => {
    // SAFETY: value is already boolean from Switch, but be explicit
    const boolValue = value === true;

    switch (id) {
      case 'notifications':
        setNotifications(boolValue);
        break;
      case 'dailyReminder':
        setDailyReminder(boolValue);
        break;
      case 'darkMode':
        setDarkMode(boolValue);
        break;
      case 'haptics':
        setHaptics(boolValue);
        break;
    }
  };

  const styles = createStyles(theme, insets.top);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SETTINGS</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        {toggleSettings.map(setting => (
          <View key={setting.id} style={styles.settingRow}>
            <View style={styles.settingIconContainer}>
              <Ionicons name={setting.icon} size={20} color={theme.accent} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>{setting.label}</Text>
              <Text style={styles.settingDescription}>{setting.description}</Text>
            </View>
            <Switch
              value={getToggleValue(setting.id)}
              onValueChange={(value) => handleToggle(setting.id, value)}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor="#ffffff"
            />
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <TouchableOpacity style={styles.linkRow}>
          <View style={styles.linkIconContainer}>
            <Ionicons name="document-text-outline" size={20} color={theme.accent} />
          </View>
          <Text style={styles.linkText}>Terms of Service</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow}>
          <View style={styles.linkIconContainer}>
            <Ionicons name="shield-outline" size={20} color={theme.accent} />
          </View>
          <Text style={styles.linkText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow}>
          <View style={styles.linkIconContainer}>
            <Ionicons name="help-circle-outline" size={20} color={theme.accent} />
          </View>
          <Text style={styles.linkText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Delta v1.0.0</Text>
        <Text style={styles.footerSubtext}>Your AI Health Companion</Text>
      </View>
    </ScrollView>
  );
}

function createStyles(theme: Theme, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: topInset + 8,
      paddingBottom: 8,
      backgroundColor: theme.background + 'F0',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.textPrimary,
      letterSpacing: 1,
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 12,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    settingIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    settingContent: {
      flex: 1,
    },
    settingLabel: {
      fontSize: 16,
      color: theme.textPrimary,
      marginBottom: 2,
    },
    settingDescription: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    linkIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    linkText: {
      flex: 1,
      fontSize: 16,
      color: theme.textPrimary,
    },
    footer: {
      alignItems: 'center',
      padding: 32,
    },
    footerText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    footerSubtext: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
  });
}
