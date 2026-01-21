/**
 * ProfileScreen - User profile with editing capabilities.
 *
 * SAFETY DECISIONS:
 * - Explicit boolean checks
 * - Image picker with proper permissions
 * - Profile data persistence
 * - Edit profile in modal
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
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { FadeInView, AnimatedCard } from '../components/Animated';

const springConfig = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

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

  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
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
      setEditModalVisible(false);
    } catch {
      Alert.alert('Error', 'Could not save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (): void => {
    setEditData(profileData);
    setEditModalVisible(true);
  };

  const closeEditModal = (): void => {
    setEditData(profileData);
    setEditModalVisible(false);
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

  return (
    <>
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            {profileData.displayName.length > 0 ? profileData.displayName : 'Profile'}
          </Text>
          <Text style={styles.headerSubtitle}>{user?.email ?? ''}</Text>
        </View>
        <TouchableOpacity style={styles.settingsButton} onPress={onOpenSettings}>
          <Ionicons name="settings-outline" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.profileSection}>
        {/* Profile Picture */}
        <View style={styles.avatarContainer}>
          {profileData.profileImage !== null ? (
            <Image source={{ uri: profileData.profileImage }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profileData.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <Text style={styles.userName}>{profileData.displayName}</Text>
          {profileData.bio.length > 0 && <Text style={styles.userBio}>{profileData.bio}</Text>}
          <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
        </View>

        {/* Edit Button */}
        <TouchableOpacity style={styles.editProfileButton} onPress={openEditModal}>
          <Ionicons name="pencil" size={16} color={theme.accent} />
        </TouchableOpacity>
      </Animated.View>

      <FadeInView style={styles.section} delay={200}>
        <Text style={styles.sectionTitle}>Account Info</Text>
        <AnimatedCard style={styles.infoRow} delay={250}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="mail-outline" size={20} color={theme.accent} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email ?? 'Not set'}</Text>
          </View>
        </AnimatedCard>
        <AnimatedCard style={styles.infoRow} delay={300}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="calendar-outline" size={20} color={theme.accent} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>January 2025</Text>
          </View>
        </AnimatedCard>
      </FadeInView>

    </ScrollView>

    {/* Edit Profile Modal */}
    <Modal
      visible={editModalVisible === true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeEditModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.modalContainer, { backgroundColor: theme.background }]}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={closeEditModal}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Profile</Text>
          <TouchableOpacity
            onPress={saveProfile}
            disabled={isSaving === true}
          >
            {isSaving === true ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <Text style={styles.modalSave}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Profile Picture */}
          <View style={styles.modalAvatarSection}>
            <TouchableOpacity onPress={pickImage}>
              {editData.profileImage !== null ? (
                <Image source={{ uri: editData.profileImage }} style={styles.modalAvatar} />
              ) : (
                <View style={[styles.modalAvatar, { backgroundColor: theme.accent }]}>
                  <Text style={styles.avatarText}>
                    {editData.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            {editData.profileImage !== null && (
              <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                <Text style={styles.removeImageText}>Remove Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Name Input */}
          <View style={styles.modalInputGroup}>
            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editData.displayName}
              onChangeText={(text) => setEditData(prev => ({ ...prev, displayName: text }))}
              placeholder="Your name"
              placeholderTextColor={theme.textSecondary}
              maxLength={30}
            />
          </View>

          {/* Bio Input */}
          <View style={styles.modalInputGroup}>
            <Text style={styles.modalLabel}>Bio</Text>
            <TextInput
              style={[styles.modalInput, styles.modalBioInput]}
              value={editData.bio}
              onChangeText={(text) => setEditData(prev => ({ ...prev, bio: text }))}
              placeholder="Add a bio..."
              placeholderTextColor={theme.textSecondary}
              multiline={true}
              maxLength={150}
            />
            <Text style={styles.charCount}>{editData.bio.length}/150</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
    </>
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
      fontSize: 22,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    settingsButton: {
      padding: 8,
    },
    profileSection: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    avatarContainer: {
      marginRight: 16,
      position: 'relative',
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarImage: {
      width: 72,
      height: 72,
      borderRadius: 36,
    },
    avatarText: {
      fontSize: 28,
      fontWeight: '700',
      color: '#ffffff',
    },
    profileInfo: {
      flex: 1,
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
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    userBio: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    userEmail: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    editProfileButton: {
      padding: 8,
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
    modalContainer: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      paddingTop: topInset + 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalCancel: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    modalSave: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.accent,
    },
    modalContent: {
      flex: 1,
      padding: 16,
    },
    modalAvatarSection: {
      alignItems: 'center',
      marginBottom: 32,
    },
    modalAvatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalInputGroup: {
      marginBottom: 24,
    },
    modalLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 8,
    },
    modalInput: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalBioInput: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    charCount: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'right',
      marginTop: 4,
    },
  });
}
