/**
 * ProfileScreen - User profile display.
 *
 * SAFETY DECISIONS:
 * - Simple static display
 * - Explicit boolean checks
 * - No complex state management
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

interface ProfileScreenProps {
  theme: Theme;
}

interface ProfileItem {
  id: string;
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export default function ProfileScreen({ theme }: ProfileScreenProps): React.ReactNode {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  // Profile items
  const profileItems: ProfileItem[] = [
    {
      id: '1',
      label: 'Email',
      value: user?.email ?? 'Not set',
      icon: 'mail-outline',
    },
    {
      id: '2',
      label: 'Member Since',
      value: 'January 2025',
      icon: 'calendar-outline',
    },
    {
      id: '3',
      label: 'Conversations',
      value: '47 total',
      icon: 'chatbubbles-outline',
    },
  ];

  const handleLogout = async (): Promise<void> => {
    await logout();
  };

  const styles = createStyles(theme, insets.top);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PROFILE</Text>
      </View>

      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </Text>
          </View>
        </View>
        <Text style={styles.userName}>{user?.name ?? 'User'}</Text>
        <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Info</Text>
        {profileItems.map(item => (
          <View key={item.id} style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name={item.icon} size={20} color={theme.accent} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <View style={styles.achievementsContainer}>
          <View style={styles.achievement}>
            <View style={[styles.achievementIcon, { backgroundColor: theme.success + '20' }]}>
              <Ionicons name="star" size={24} color={theme.success} />
            </View>
            <Text style={styles.achievementLabel}>First Chat</Text>
          </View>
          <View style={styles.achievement}>
            <View style={[styles.achievementIcon, { backgroundColor: theme.warning + '20' }]}>
              <Ionicons name="flame" size={24} color={theme.warning} />
            </View>
            <Text style={styles.achievementLabel}>7 Day Streak</Text>
          </View>
          <View style={styles.achievement}>
            <View style={[styles.achievementIcon, { backgroundColor: theme.accent + '20' }]}>
              <Ionicons name="heart" size={24} color={theme.accent} />
            </View>
            <Text style={styles.achievementLabel}>Health Check</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={theme.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
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
    profileSection: {
      alignItems: 'center',
      padding: 24,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    avatarContainer: {
      marginBottom: 16,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 32,
      fontWeight: '700',
      color: '#ffffff',
    },
    userName: {
      fontSize: 24,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: theme.textSecondary,
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
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    infoIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    infoContent: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    infoValue: {
      fontSize: 16,
      color: theme.textPrimary,
    },
    achievementsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    achievement: {
      alignItems: 'center',
    },
    achievementIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    achievementLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.error,
    },
    logoutText: {
      fontSize: 16,
      color: theme.error,
      fontWeight: '600',
      marginLeft: 8,
    },
  });
}
