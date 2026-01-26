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
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useAccess } from '../context/AccessContext';
import { FadeInView, AnimatedCard } from '../components/Animated';
import { supabase } from '../services/supabase';
import { profileApi, profileCardsApi, StatCard as StatCardType, StatCardInput } from '../services/api';
import { decode } from 'base64-arraybuffer';
import { StatCard, StatCardEditor } from '../components/Profile';

type Gender = 'male' | 'female' | 'other' | null;

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
  username: string;
  age: string;
  gender: Gender;
  bio: string;
  profileImage: string | null;
}

export default function ProfileScreen({ theme, onOpenSettings }: ProfileScreenProps): React.ReactNode {
  const { user } = useAuth();
  const { profile, checkAccess } = useAccess();
  const insets = useSafeAreaInsets();

  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statCards, setStatCards] = useState<StatCardType[]>([]);
  const [statCardEditorVisible, setStatCardEditorVisible] = useState<boolean>(false);
  const [editingStatCard, setEditingStatCard] = useState<StatCardType | null>(null);
  const [profileData, setProfileData] = useState<ProfileData>({
    displayName: user?.name ?? 'User',
    username: profile?.username ?? '',
    age: profile?.age?.toString() ?? '',
    gender: profile?.gender ?? null,
    bio: '',
    profileImage: null,
  });
  const [editData, setEditData] = useState<ProfileData>(profileData);

  // Load saved profile data (from Supabase + local storage fallback)
  useEffect(() => {
    const loadProfile = async (): Promise<void> => {
      try {
        // Load local data for bio (still stored locally)
        const saved = await AsyncStorage.getItem(`${PROFILE_STORAGE_KEY}_${user?.id}`);
        const localData = saved !== null ? JSON.parse(saved) : {};

        // Load profile image URL from Supabase
        let cloudProfileImage: string | null = null;
        if (user?.id) {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single();

          if (profileRow?.avatar_url) {
            cloudProfileImage = profileRow.avatar_url;
          }
        }

        // Merge Supabase profile data with local data
        const mergedData: ProfileData = {
          displayName: profile?.name ?? user?.name ?? 'User',
          username: profile?.username ?? '',
          age: profile?.age?.toString() ?? '',
          gender: profile?.gender ?? null,
          bio: localData.bio ?? '',
          profileImage: cloudProfileImage ?? localData.profileImage ?? null,
        };

        setProfileData(mergedData);
        setEditData(mergedData);
      } catch {
        // Use defaults
      }
    };
    loadProfile();
  }, [user?.id, user?.name, profile?.name, profile?.username, profile?.age, profile?.gender]);

  // Load stat cards
  useEffect(() => {
    const loadStatCards = async (): Promise<void> => {
      if (!user?.id) return;
      try {
        const response = await profileCardsApi.getCards(user.id);
        setStatCards(response.cards);
      } catch {
        // Cards might not exist yet, that's fine
      }
    };
    loadStatCards();
  }, [user?.id]);

  const handleAddStatCard = (): void => {
    setEditingStatCard(null);
    setStatCardEditorVisible(true);
  };

  const handleEditStatCard = (card: StatCardType): void => {
    setEditingStatCard(card);
    setStatCardEditorVisible(true);
  };

  const handleSaveStatCard = async (data: StatCardInput): Promise<void> => {
    if (!user?.id) return;

    if (editingStatCard !== null) {
      // Update existing card
      const response = await profileCardsApi.updateCard(user.id, editingStatCard.id, data);
      setStatCards(prev => prev.map(c => c.id === editingStatCard.id ? response.card : c));
    } else {
      // Create new card
      const response = await profileCardsApi.createCard(user.id, data);
      setStatCards(prev => [...prev, response.card]);
    }
  };

  const handleDeleteStatCard = async (cardId: string): Promise<void> => {
    if (!user?.id) return;
    await profileCardsApi.deleteCard(user.id, cardId);
    setStatCards(prev => prev.filter(c => c.id !== cardId));
  };

  const saveProfile = async (): Promise<void> => {
    // Validate username
    if (editData.username.length > 0 && editData.username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }
    if (editData.username.length > 0 && !/^[a-z0-9_]+$/.test(editData.username)) {
      Alert.alert('Error', 'Username can only contain letters, numbers, and underscores');
      return;
    }

    setIsSaving(true);
    try {
      let avatarUrl: string | null = profileData.profileImage;

      // Upload profile image to Supabase Storage if it changed
      if (user?.id && editData.profileImage !== profileData.profileImage) {
        if (editData.profileImage) {
          try {
            // Read image as base64
            const base64 = await FileSystem.readAsStringAsync(editData.profileImage, {
              encoding: 'base64',
            });

            // Determine file extension
            const ext = editData.profileImage.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${user.id}/avatar.${ext}`;
            const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(fileName, decode(base64), {
                contentType,
                upsert: true,
              });

            if (uploadError) {
              console.error('Error uploading avatar:', uploadError);
            } else {
              // Get public URL
              const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);
              avatarUrl = urlData?.publicUrl ?? null;
            }
          } catch (uploadErr) {
            console.error('Error uploading profile image:', uploadErr);
          }
        } else {
          avatarUrl = null;
        }
      }

      // Save bio to AsyncStorage (still local - it's user content that doesn't need sync)
      await AsyncStorage.setItem(
        `${PROFILE_STORAGE_KEY}_${user?.id}`,
        JSON.stringify({ bio: editData.bio })
      );

      // Save to Supabase (username, age, gender, name, avatar_url)
      if (user?.id) {
        const ageNum = editData.age.length > 0 ? parseInt(editData.age, 10) : null;

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            name: editData.displayName,
            username: editData.username.length > 0 ? editData.username : null,
            age: ageNum,
            gender: editData.gender,
            avatar_url: avatarUrl,
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
          // Check for username conflict
          if (updateError.code === '23505') {
            Alert.alert('Error', 'This username is already taken');
            setIsSaving(false);
            return;
          }
        }

        // Sync profile to Delta's memory so Delta knows about the changes
        try {
          await profileApi.syncToDelta(user.id);
        } catch (syncError) {
          // Non-fatal - profile is saved, just not synced to Delta yet
          console.log('Profile sync to Delta deferred:', syncError);
        }

        // Refresh profile in AccessContext to update UI
        await checkAccess();
      }

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
        <Text style={styles.headerTitle}>
          @{profile?.username || profileData.username || (profile?.name ?? user?.name ?? 'user').toLowerCase().replace(/\s/g, '')}
        </Text>
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
        </View>

        {/* Edit Button */}
        <TouchableOpacity style={styles.editProfileButton} onPress={openEditModal}>
          <Ionicons name="pencil" size={16} color={theme.accent} />
        </TouchableOpacity>
      </Animated.View>

      {/* My Stats Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Stats</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddStatCard}>
            <Ionicons name="add-circle-outline" size={24} color={theme.accent} />
          </TouchableOpacity>
        </View>

        {statCards.length === 0 ? (
          <TouchableOpacity style={styles.emptyStatsCard} onPress={handleAddStatCard}>
            <Ionicons name="analytics-outline" size={32} color={theme.textSecondary} />
            <Text style={styles.emptyStatsText}>Add your first stat</Text>
            <Text style={styles.emptyStatsHint}>Track PRs, body metrics, and more</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.statsGrid}>
            {statCards.map((card, index) => (
              <StatCard
                key={card.id}
                theme={theme}
                card={card}
                onEdit={handleEditStatCard}
                index={index}
              />
            ))}
          </View>
        )}
      </View>

    </ScrollView>

    {/* Stat Card Editor Modal */}
    <StatCardEditor
      theme={theme}
      visible={statCardEditorVisible}
      card={editingStatCard}
      onClose={() => setStatCardEditorVisible(false)}
      onSave={handleSaveStatCard}
      onDelete={handleDeleteStatCard}
    />

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

          {/* Username Input */}
          <View style={styles.modalInputGroup}>
            <Text style={styles.modalLabel}>Username</Text>
            <TextInput
              style={styles.modalInput}
              value={editData.username}
              onChangeText={(text) => setEditData(prev => ({
                ...prev,
                username: text.toLowerCase().replace(/[^a-z0-9_]/g, '')
              }))}
              placeholder="your_username"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              maxLength={20}
            />
            <Text style={styles.inputHint}>Letters, numbers, and underscores only</Text>
          </View>

          {/* Age Input */}
          <View style={styles.modalInputGroup}>
            <Text style={styles.modalLabel}>Age</Text>
            <TextInput
              style={styles.modalInput}
              value={editData.age}
              onChangeText={(text) => setEditData(prev => ({ ...prev, age: text.replace(/[^0-9]/g, '') }))}
              placeholder="Your age"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>

          {/* Gender Selection */}
          <View style={styles.modalInputGroup}>
            <Text style={styles.modalLabel}>Gender</Text>
            <View style={styles.genderOptions}>
              {(['male', 'female', 'other'] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.genderOption,
                    editData.gender === option && styles.genderOptionSelected,
                  ]}
                  onPress={() => setEditData(prev => ({ ...prev, gender: option }))}
                >
                  <Text
                    style={[
                      styles.genderOptionText,
                      editData.gender === option && styles.genderOptionTextSelected,
                    ]}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
    inputHint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    genderOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    genderOption: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    genderOptionSelected: {
      backgroundColor: theme.accentLight,
      borderColor: theme.accent,
    },
    genderOptionText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    genderOptionTextSelected: {
      color: theme.accent,
      fontWeight: '600',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    addButton: {
      padding: 4,
    },
    emptyStatsCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 32,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: 'dashed',
    },
    emptyStatsText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
      marginTop: 12,
    },
    emptyStatsHint: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
    },
    statsGrid: {
      gap: 0,
    },
  });
}
