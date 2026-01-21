/**
 * ProfileScreen - User profile with editing capabilities.
 *
 * SAFETY DECISIONS:
 * - Explicit boolean checks
 * - Image picker with proper permissions
 * - Profile data persistence
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const PROFILE_STORAGE_KEY = '@delta_user_profile';

interface ProfileScreenProps {
  theme: Theme;
  onOpenSettings: () => void;
}

interface ProfileData {
  displayName: string;
  bio: string;
  profileImage: string | null;
}

export default function ProfileScreen({ theme, onOpenSettings }: ProfileScreenProps): React.ReactNode {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    displayName: user?.name ?? 'User',
    bio: '',
    profileImage: null,
  });
  const [editData, setEditData] = useState<ProfileData>(profileData);

  // Load saved profile data
  useEffect(() => {
    const loadProfile = async (): Promise<void> => {
      try {
        const saved = await AsyncStorage.getItem(`${PROFILE_STORAGE_KEY}_${user?.id}`);
        if (saved !== null) {
          const parsed = JSON.parse(saved) as ProfileData;
          setProfileData(parsed);
          setEditData(parsed);
        }
      } catch {
        // Use defaults
      }
    };
    loadProfile();
  }, [user?.id]);

  const saveProfile = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await AsyncStorage.setItem(
        `${PROFILE_STORAGE_KEY}_${user?.id}`,
        JSON.stringify(editData)
      );
      setProfileData(editData);
      setIsEditing(false);
    } catch {
      Alert.alert('Error', 'Could not save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = (): void => {
    setEditData(profileData);
    setIsEditing(false);
  };

  const pickImage = async (): Promise<void> => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted !== true) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to select a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (result.canceled !== true && result.assets && result.assets.length > 0) {
      setEditData(prev => ({ ...prev, profileImage: result.assets[0].uri }));
    }
  };

  const removeImage = (): void => {
    setEditData(prev => ({ ...prev, profileImage: null }));
  };

  const styles = createStyles(theme, insets.top);

  const displayImage = isEditing === true ? editData.profileImage : profileData.profileImage;
  const displayName = isEditing === true ? editData.displayName : profileData.displayName;
  const displayBio = isEditing === true ? editData.bio : profileData.bio;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PROFILE</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={onOpenSettings}>
          <Ionicons name="settings-outline" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        {/* Profile Picture */}
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={isEditing === true ? pickImage : undefined}
          disabled={isEditing !== true}
        >
          {displayImage !== null ? (
            <Image source={{ uri: displayImage }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {isEditing === true && (
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        {isEditing === true && displayImage !== null && (
          <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
            <Text style={styles.removeImageText}>Remove Photo</Text>
          </TouchableOpacity>
        )}

        {/* Name */}
        {isEditing === true ? (
          <TextInput
            style={styles.nameInput}
            value={editData.displayName}
            onChangeText={(text) => setEditData(prev => ({ ...prev, displayName: text }))}
            placeholder="Your name"
            placeholderTextColor={theme.textSecondary}
            maxLength={30}
          />
        ) : (
          <Text style={styles.userName}>{displayName}</Text>
        )}

        {/* Bio */}
        {isEditing === true ? (
          <TextInput
            style={styles.bioInput}
            value={editData.bio}
            onChangeText={(text) => setEditData(prev => ({ ...prev, bio: text }))}
            placeholder="Add a bio..."
            placeholderTextColor={theme.textSecondary}
            multiline={true}
            maxLength={150}
          />
        ) : (
          displayBio.length > 0 && <Text style={styles.userBio}>{displayBio}</Text>
        )}

        <Text style={styles.userEmail}>{user?.email ?? ''}</Text>

        {/* Edit/Save Buttons */}
        {isEditing === true ? (
          <View style={styles.editButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelEdit}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, isSaving === true && styles.buttonDisabled]}
              onPress={saveProfile}
              disabled={isSaving === true}
            >
              {isSaving === true ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.editProfileButton} onPress={() => setIsEditing(true)}>
            <Ionicons name="pencil" size={16} color={theme.accent} />
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Info</Text>
        <View style={styles.infoRow}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="mail-outline" size={20} color={theme.accent} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email ?? 'Not set'}</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="calendar-outline" size={20} color={theme.accent} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>January 2025</Text>
          </View>
        </View>
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: topInset + 8,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.textPrimary,
      letterSpacing: 1,
    },
    settingsButton: {
      padding: 8,
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
      position: 'relative',
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
    },
    avatarText: {
      fontSize: 40,
      fontWeight: '700',
      color: '#ffffff',
    },
    editBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: theme.surface,
    },
    removeImageButton: {
      marginBottom: 12,
    },
    removeImageText: {
      fontSize: 14,
      color: theme.error,
    },
    userName: {
      fontSize: 24,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 4,
    },
    nameInput: {
      fontSize: 24,
      fontWeight: '600',
      color: theme.textPrimary,
      textAlign: 'center',
      marginBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.accent,
      paddingBottom: 4,
      minWidth: 150,
    },
    userBio: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 4,
      paddingHorizontal: 32,
    },
    bioInput: {
      fontSize: 14,
      color: theme.textPrimary,
      textAlign: 'center',
      marginBottom: 4,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.surfaceSecondary,
      borderRadius: 8,
      minWidth: 200,
      maxHeight: 80,
    },
    userEmail: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
    },
    editProfileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 16,
      paddingVertical: 8,
      paddingHorizontal: 16,
      backgroundColor: theme.accentLight,
      borderRadius: 20,
    },
    editProfileText: {
      fontSize: 14,
      color: theme.accent,
      fontWeight: '600',
      marginLeft: 6,
    },
    editButtons: {
      flexDirection: 'row',
      marginTop: 16,
      gap: 12,
    },
    cancelButton: {
      paddingVertical: 10,
      paddingHorizontal: 24,
      backgroundColor: theme.surfaceSecondary,
      borderRadius: 20,
    },
    cancelButtonText: {
      fontSize: 14,
      color: theme.textPrimary,
      fontWeight: '600',
    },
    saveButton: {
      paddingVertical: 10,
      paddingHorizontal: 24,
      backgroundColor: theme.accent,
      borderRadius: 20,
      minWidth: 80,
      alignItems: 'center',
    },
    saveButtonText: {
      fontSize: 14,
      color: '#fff',
      fontWeight: '600',
    },
    buttonDisabled: {
      opacity: 0.7,
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
  });
}
