/**
 * SettingsScreen - App settings and preferences.
 *
 * SAFETY DECISIONS:
 * - Simple toggle handling
 * - Explicit boolean values
 * - Account deletion with confirmation
 * - Dark/Light mode integration
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  Share,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAccess } from '../context/AccessContext';
import { exportApi, MenstrualSettings } from '../services/api';
import * as menstrualService from '../services/menstrualTracking';
import * as notificationService from '../services/notifications';
import { formatPeriod, formatExpirationDate, formatSubscriptionStatus } from '../services/subscriptionSync';
import SupportScreen from './SupportScreen';

const API_BASE_URL = 'https://delta-80ht.onrender.com';

interface SettingsScreenProps {
  theme: Theme;
  onClose: () => void;
}

export default function SettingsScreen({ theme, onClose }: SettingsScreenProps): React.ReactNode {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme, useSystemTheme, isUsingSystem } = useTheme();
  const { subscription, hasAccess, isDeveloper, showPaywall, showCustomerCenter, subscriptionStatus } = useAccess();

  const [notifications, setNotifications] = useState<boolean>(true);
  const [dailyReminder, setDailyReminder] = useState<boolean>(false);
  const [haptics, setHaptics] = useState<boolean>(true);
  const [menstrualTracking, setMenstrualTracking] = useState<boolean>(false);
  const [menstrualSettings, setMenstrualSettings] = useState<MenstrualSettings | null>(null);
  const [isLoadingMenstrual, setIsLoadingMenstrual] = useState<boolean>(true);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState<boolean>(true);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');
  const [showSupport, setShowSupport] = useState<boolean>(false);

  // Load notification settings on mount
  useEffect(() => {
    const loadNotificationSettings = async (): Promise<void> => {
      try {
        const settings = await notificationService.getSettings();
        setNotifications(settings.enabled === true);
        setDailyReminder(settings.dailyReminder === true);
      } catch {
        // Silent fail - use defaults
      } finally {
        setIsLoadingNotifications(false);
      }
    };
    loadNotificationSettings();
  }, []);

  // Load menstrual settings on mount
  useEffect(() => {
    const loadMenstrualSettings = async (): Promise<void> => {
      if (!user?.id) return;
      try {
        const settings = await menstrualService.getSettings(user.id);
        setMenstrualSettings(settings);
        setMenstrualTracking(settings.tracking_enabled === true);
      } catch {
        // Silent fail - use defaults
      } finally {
        setIsLoadingMenstrual(false);
      }
    };
    loadMenstrualSettings();
  }, [user?.id]);

  // Handle notifications toggle
  const handleNotificationsToggle = useCallback(async (value: boolean): Promise<void> => {
    setNotifications(value);
    try {
      if (value === true) {
        const hasPermission = await notificationService.requestPermissions();
        if (hasPermission !== true) {
          setNotifications(false);
          Alert.alert(
            'Notifications Disabled',
            'Please enable notifications in your device settings to receive reminders.'
          );
          return;
        }
      }
      await notificationService.saveSettings({ enabled: value });
      if (value !== true) {
        await notificationService.cancelAllNotifications();
      }
    } catch {
      setNotifications(!value);
      Alert.alert('Error', 'Could not update notification settings.');
    }
  }, []);

  // Handle daily reminder toggle
  const handleDailyReminderToggle = useCallback(async (value: boolean): Promise<void> => {
    setDailyReminder(value);
    try {
      await notificationService.saveSettings({ dailyReminder: value });
    } catch {
      setDailyReminder(!value);
      Alert.alert('Error', 'Could not update reminder settings.');
    }
  }, []);

  // Handle menstrual tracking toggle
  const handleMenstrualToggle = useCallback(async (value: boolean): Promise<void> => {
    if (!user?.id) return;
    setMenstrualTracking(value);
    try {
      const updated = await menstrualService.updateSettings(user.id, { tracking_enabled: value });
      setMenstrualSettings(updated);
    } catch {
      // Revert on error
      setMenstrualTracking(!value);
      Alert.alert('Error', 'Could not update setting. Please try again.');
    }
  }, [user?.id]);

  const openLink = async (url: string): Promise<void> => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported === true) {
        await Linking.openURL(url);
      }
    } catch {
      // Silent fail
    }
  };

  const handleExportData = async (): Promise<void> => {
    if (!user?.id) return;

    Alert.alert(
      'Export Your Data',
      'We will prepare a copy of all your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/user/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id }),
              });
              if (response.ok === true) {
                Alert.alert('Success', 'Your data export is ready.');
              } else {
                Alert.alert('Error', 'Could not export data.');
              }
            } catch {
              Alert.alert('Error', 'Could not connect to server.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = (): void => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => executeAccountDeletion(),
        },
      ]
    );
  };

  const executeAccountDeletion = async (): Promise<void> => {
    if (!user?.id) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/user/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, confirm: true }),
      });
      if (response.ok === true) {
        Alert.alert('Account Deleted', 'Your account has been deleted.', [
          { text: 'OK', onPress: () => logout() },
        ]);
      } else {
        Alert.alert('Error', 'Could not delete account.');
      }
    } catch {
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleExportInsights = async (): Promise<void> => {
    if (!user?.id) return;

    setIsExporting(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      if (exportFormat === 'pdf') {
        const blob = await exportApi.exportPdf(user.id, { start_date: startDate, end_date: endDate });
        const arrayBuffer = await blob.arrayBuffer();
        const file = new File(Paths.cache, `delta_insights_${endDate}.pdf`);
        await file.write(new Uint8Array(arrayBuffer));

        const canShare = await Sharing.isAvailableAsync();
        if (canShare === true) {
          await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf' });
        } else {
          Alert.alert('Export Ready', 'PDF generated but sharing not available on this device.');
        }
      } else if (exportFormat === 'csv') {
        const csvContent = await exportApi.exportCsv(user.id, { start_date: startDate, end_date: endDate });
        const file = new File(Paths.cache, `delta_metrics_${endDate}.csv`);
        await file.write(csvContent);

        const canShare = await Sharing.isAvailableAsync();
        if (canShare === true) {
          await Sharing.shareAsync(file.uri, { mimeType: 'text/csv' });
        }
      } else {
        const jsonData = await exportApi.exportJson(user.id, { start_date: startDate, end_date: endDate });
        const jsonString = JSON.stringify(jsonData, null, 2);
        const file = new File(Paths.cache, `delta_insights_${endDate}.json`);
        await file.write(jsonString);

        const canShare = await Sharing.isAvailableAsync();
        if (canShare === true) {
          await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
        }
      }

      Alert.alert('Export Complete', 'Your insights have been exported.');
    } catch (error) {
      Alert.alert('Export Failed', 'Could not generate export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const styles = createStyles(theme, insets.top);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Health Disclaimer */}
      <View style={styles.disclaimerBanner}>
        <Ionicons name="information-circle" size={18} color={theme.warning} />
        <Text style={styles.disclaimerText}>
          Delta provides wellness guidance only, not medical advice.
        </Text>
      </View>

      {/* Account Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="mail-outline" size={20} color={theme.accent} />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Email</Text>
            <Text style={styles.settingDescription}>{user?.email ?? 'Not set'}</Text>
          </View>
        </View>
        <View style={styles.settingRow}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="calendar-outline" size={20} color={theme.accent} />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Member Since</Text>
            <Text style={styles.settingDescription}>January 2025</Text>
          </View>
        </View>
      </View>

      {/* Subscription */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        {isDeveloper === true ? (
          <View style={styles.settingRow}>
            <View style={[styles.settingIconContainer, { backgroundColor: theme.success + '20' }]}>
              <Ionicons name="shield-checkmark" size={20} color={theme.success} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Developer Access</Text>
              <Text style={styles.settingDescription}>All features unlocked</Text>
            </View>
          </View>
        ) : hasAccess === true && subscriptionStatus !== null ? (
          <>
            <View style={styles.settingRow}>
              <View style={[styles.settingIconContainer, { backgroundColor: theme.accent + '20' }]}>
                <Ionicons name="diamond" size={20} color={theme.accent} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>
                  Delta Health Intelligence Pro
                </Text>
                <Text style={styles.settingDescription}>
                  {formatPeriod(subscriptionStatus.periodType)} subscription
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: theme.success + '20' }]}>
                <Text style={[styles.statusBadgeText, { color: theme.success }]}>
                  {subscriptionStatus.isTrialing ? 'Trial' : subscriptionStatus.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            {subscriptionStatus.expirationDate !== null && (
              <View style={styles.settingRow}>
                <View style={styles.settingIconContainer}>
                  <Ionicons name="time-outline" size={20} color={theme.accent} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>
                    {subscriptionStatus.willRenew ? 'Renews' : 'Access Until'}
                  </Text>
                  <Text style={styles.settingDescription}>
                    {formatExpirationDate(subscriptionStatus.expirationDate)}
                  </Text>
                </View>
              </View>
            )}
            <TouchableOpacity
              style={styles.linkRow}
              onPress={showCustomerCenter}
            >
              <View style={styles.settingIconContainer}>
                <Ionicons name="settings-outline" size={20} color={theme.accent} />
              </View>
              <Text style={styles.linkText}>Manage Subscription</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.settingRow}>
              <View style={styles.settingIconContainer}>
                <Ionicons name="person-outline" size={20} color={theme.accent} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Free Plan</Text>
                <Text style={styles.settingDescription}>Limited features</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.upgradeButton, { backgroundColor: theme.accent }]}
              onPress={showPaywall}
            >
              <Ionicons name="diamond" size={18} color="#fff" />
              <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="moon-outline" size={20} color={theme.accent} />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Dark Mode</Text>
            <Text style={styles.settingDescription}>
              {isUsingSystem === true ? 'Following system' : isDark === true ? 'On' : 'Off'}
            </Text>
          </View>
          <Switch
            value={isDark === true}
            onValueChange={toggleTheme}
            trackColor={{ false: theme.border, true: theme.accent }}
            thumbColor="#ffffff"
          />
        </View>
        <TouchableOpacity style={styles.linkRow} onPress={useSystemTheme}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="phone-portrait-outline" size={20} color={theme.accent} />
          </View>
          <Text style={styles.linkText}>Use System Theme</Text>
          {isUsingSystem === true && (
            <Ionicons name="checkmark" size={20} color={theme.success} />
          )}
        </TouchableOpacity>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="notifications-outline" size={20} color={theme.accent} />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Push Notifications</Text>
            <Text style={styles.settingDescription}>Health tips and reminders</Text>
          </View>
          {isLoadingNotifications === true ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <Switch
              value={notifications === true}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor="#ffffff"
            />
          )}
        </View>
        <View style={styles.settingRow}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="alarm-outline" size={20} color={theme.accent} />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Daily Reminder</Text>
            <Text style={styles.settingDescription}>Check in with Delta daily at 9 AM</Text>
          </View>
          {isLoadingNotifications === true ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <Switch
              value={dailyReminder === true}
              onValueChange={handleDailyReminderToggle}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor="#ffffff"
              disabled={notifications !== true}
            />
          )}
        </View>
        <View style={styles.settingRow}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="phone-portrait-outline" size={20} color={theme.accent} />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Haptic Feedback</Text>
            <Text style={styles.settingDescription}>Vibration feedback</Text>
          </View>
          <Switch
            value={haptics === true}
            onValueChange={setHaptics}
            trackColor={{ false: theme.border, true: theme.accent }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {/* Health Tracking */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health Tracking</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="calendar-outline" size={20} color={theme.accent} />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Cycle Tracking</Text>
            <Text style={styles.settingDescription}>Track menstrual cycle and hormonal phases</Text>
          </View>
          {isLoadingMenstrual === true ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <Switch
              value={menstrualTracking === true}
              onValueChange={handleMenstrualToggle}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor="#ffffff"
            />
          )}
        </View>
      </View>

      {/* Export Insights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Export Insights</Text>
        <View style={styles.exportCard}>
          <View style={styles.exportHeader}>
            <Ionicons name="download-outline" size={24} color={theme.accent} />
            <View style={styles.exportHeaderText}>
              <Text style={styles.exportTitle}>Download Your Insights</Text>
              <Text style={styles.exportSubtitle}>Export last 30 days of trend data</Text>
            </View>
          </View>

          <Text style={styles.exportDisclaimer}>
            Exports contain derived metrics and trends only. No raw health data is included.
            For personal reference - not medical advice.
          </Text>

          <View style={styles.formatSelector}>
            <TouchableOpacity
              style={[styles.formatButton, exportFormat === 'pdf' && styles.formatButtonActive]}
              onPress={() => setExportFormat('pdf')}
            >
              <Text style={[styles.formatButtonText, exportFormat === 'pdf' && styles.formatButtonTextActive]}>
                PDF Report
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.formatButton, exportFormat === 'csv' && styles.formatButtonActive]}
              onPress={() => setExportFormat('csv')}
            >
              <Text style={[styles.formatButtonText, exportFormat === 'csv' && styles.formatButtonTextActive]}>
                CSV
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.formatButton, exportFormat === 'json' && styles.formatButtonActive]}
              onPress={() => setExportFormat('json')}
            >
              <Text style={[styles.formatButtonText, exportFormat === 'json' && styles.formatButtonTextActive]}>
                JSON
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.exportButton, isExporting === true && styles.exportButtonDisabled]}
            onPress={handleExportInsights}
            disabled={isExporting === true}
          >
            {isExporting === true ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="#fff" />
                <Text style={styles.exportButtonText}>
                  {exportFormat === 'pdf' ? 'Download PDF' : `Export ${exportFormat.toUpperCase()}`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help & Support</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => setShowSupport(true)}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.accent} />
          </View>
          <Text style={styles.linkText}>Contact Support</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Legal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => openLink(`${API_BASE_URL}/terms`)}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="document-text-outline" size={20} color={theme.accent} />
          </View>
          <Text style={styles.linkText}>Terms of Service</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => openLink(`${API_BASE_URL}/privacy`)}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="shield-outline" size={20} color={theme.accent} />
          </View>
          <Text style={styles.linkText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkRow} onPress={() => openLink(`${API_BASE_URL}/disclaimer`)}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="medical-outline" size={20} color={theme.accent} />
          </View>
          <Text style={styles.linkText}>Health Disclaimer</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Data</Text>
        <TouchableOpacity style={styles.linkRow} onPress={handleExportData}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="download-outline" size={20} color={theme.accent} />
          </View>
          <Text style={styles.linkText}>Export Data</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.linkRow, styles.dangerRow]}
          onPress={handleDeleteAccount}
          disabled={isDeleting === true}
        >
          <View style={[styles.settingIconContainer, styles.dangerIcon]}>
            {isDeleting === true ? (
              <ActivityIndicator size="small" color={theme.error} />
            ) : (
              <Ionicons name="trash-outline" size={20} color={theme.error} />
            )}
          </View>
          <Text style={[styles.linkText, styles.dangerText]}>Delete Account</Text>
          <Ionicons name="chevron-forward" size={20} color={theme.error} />
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={theme.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Delta v1.0.0</Text>
        <Text style={styles.footerDisclaimer}>
          Not intended to diagnose, treat, cure, or prevent any disease.
        </Text>
      </View>

      {/* Support Modal */}
      <Modal
        visible={showSupport === true}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSupport(false)}
      >
        <SupportScreen theme={theme} onClose={() => setShowSupport(false)} />
      </Modal>
    </ScrollView>
  );
}

function createStyles(theme: Theme, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: topInset + 8,
      paddingBottom: 8,
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary, letterSpacing: 1 },
    closeButton: { padding: 8 },
    disclaimerBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.warning + '15',
      marginHorizontal: 16,
      marginTop: 8,
      padding: 10,
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: theme.warning,
    },
    disclaimerText: { flex: 1, fontSize: 12, color: theme.textSecondary, marginLeft: 8 },
    section: { padding: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginBottom: 12 },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    settingIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    settingContent: { flex: 1 },
    settingLabel: { fontSize: 15, color: theme.textPrimary, marginBottom: 2 },
    settingDescription: { fontSize: 12, color: theme.textSecondary },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    linkText: { flex: 1, fontSize: 15, color: theme.textPrimary },
    dangerRow: { borderColor: theme.error + '30' },
    dangerIcon: { backgroundColor: theme.error + '15' },
    dangerText: { color: theme.error },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.error + '50',
    },
    signOutText: { fontSize: 14, color: theme.error, fontWeight: '500', marginLeft: 6 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusBadgeText: { fontSize: 12, fontWeight: '600' },
    upgradeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 10,
      marginTop: 8,
    },
    upgradeButtonText: { color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 8 },
    footer: { alignItems: 'center', padding: 24 },
    footerText: { fontSize: 13, color: theme.textSecondary },
    footerDisclaimer: {
      fontSize: 10,
      color: theme.textSecondary,
      marginTop: 8,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    // Export styles
    exportCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    exportHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    exportHeaderText: {
      marginLeft: 12,
      flex: 1,
    },
    exportTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    exportSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    exportDisclaimer: {
      fontSize: 12,
      color: theme.textSecondary,
      backgroundColor: theme.surfaceSecondary,
      padding: 10,
      borderRadius: 8,
      marginBottom: 16,
      lineHeight: 18,
    },
    formatSelector: {
      flexDirection: 'row',
      marginBottom: 16,
    },
    formatButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: theme.surfaceSecondary,
      borderRadius: 8,
      marginHorizontal: 4,
      alignItems: 'center',
    },
    formatButtonActive: {
      backgroundColor: theme.accentLight,
    },
    formatButtonText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    formatButtonTextActive: {
      color: theme.accent,
    },
    exportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
      paddingVertical: 14,
      borderRadius: 10,
    },
    exportButtonDisabled: {
      opacity: 0.7,
    },
    exportButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#fff',
      marginLeft: 8,
    },
  });
}
