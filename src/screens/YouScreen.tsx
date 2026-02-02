/**
 * YouScreen - Everything Delta knows about you (Tab 3: You).
 *
 * Replaces Profile + Insights analytics. Three scrollable sections:
 *
 * Section A: Your Patterns (hero) - discovered causal chains
 * Section B: Delta's Brain - predictions, beliefs, gaps
 * Section C: Profile - name, avatar, bio, stat cards, settings
 *
 * API endpoints used:
 * - GET /health-intelligence/{user_id}/learned-chains
 * - GET /health-intelligence/{user_id}/predictions
 * - GET /health-intelligence/{user_id}/belief-updates
 * - GET /health-intelligence/{user_id}/uncertainty
 * - GET /health-intelligence/{user_id}/learning-status
 * - GET /profile/{user_id}/cards
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useAccess } from '../context/AccessContext';
import { supabase } from '../services/supabase';
import { decode } from 'base64-arraybuffer';
import {
  healthIntelligenceApi,
  profileApi,
  dashboardApi,
  LearnedChain,
  Prediction,
  BeliefUpdate,
  KnowledgeGap,
  LearningStatusResponse,
  DashboardResponse,
} from '../services/api';
import PatternCard from '../components/PatternCard';
import DeltaBrain from '../components/DeltaBrain';

type Gender = 'male' | 'female' | 'other' | null;

interface YouScreenProps {
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

export default function YouScreen({ theme, onOpenSettings }: YouScreenProps): React.ReactNode {
  const { user } = useAuth();
  const { profile, checkAccess } = useAccess();
  const insets = useSafeAreaInsets();

  // Intelligence data
  const [chains, setChains] = useState<LearnedChain[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [beliefUpdates, setBeliefUpdates] = useState<BeliefUpdate[]>([]);
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([]);
  const [learningStatus, setLearningStatus] = useState<LearningStatusResponse | null>(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(true);

  // Profile data (migrated from ProfileScreen)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    displayName: user?.name ?? 'User',
    username: profile?.username ?? '',
    age: profile?.age?.toString() ?? '',
    gender: profile?.gender ?? null,
    bio: '',
    profileImage: null,
  });
  const [editData, setEditData] = useState<ProfileData>(profileData);
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const styles = createStyles(theme, insets.top);

  // Fetch intelligence data
  const fetchIntelligence = useCallback(async () => {
    if (!user?.id) return;
    setIntelligenceLoading(true);
    try {
      const [chainsRes, predsRes, beliefsRes, gapsRes, statusRes] = await Promise.all([
        healthIntelligenceApi.getLearnedChains(user.id),
        healthIntelligenceApi.getPredictions(user.id),
        healthIntelligenceApi.getBeliefUpdates(user.id),
        healthIntelligenceApi.getUncertainty(user.id),
        healthIntelligenceApi.getLearningStatus(user.id),
      ]);
      setChains(chainsRes.chains);
      setPredictions(predsRes.predictions);
      setBeliefUpdates(beliefsRes.updates);
      setKnowledgeGaps(gapsRes.gaps);
      setLearningStatus(statusRes);
    } catch {
      // Silent fail - show empty state
    } finally {
      setIntelligenceLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchIntelligence(); }, [fetchIntelligence]);

  // Load profile data (same as old ProfileScreen)
  useEffect(() => {
    setProfileData(prev => ({
      ...prev,
      displayName: profile?.name ?? user?.name ?? 'User',
      username: profile?.username ?? '',
      age: profile?.age?.toString() ?? '',
      gender: profile?.gender ?? null,
    }));
    setEditData(prev => ({
      ...prev,
      displayName: profile?.name ?? user?.name ?? 'User',
      username: profile?.username ?? '',
      age: profile?.age?.toString() ?? '',
      gender: profile?.gender ?? null,
    }));
  }, [user?.name, profile?.name, profile?.username, profile?.age, profile?.gender]);

  useEffect(() => {
    const loadCloudData = async () => {
      if (!user?.id) return;
      try {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('avatar_url, bio')
          .eq('id', user.id)
          .single();
        const avatarUrl = profileRow?.avatar_url ?? null;
        const bio = profileRow?.bio ?? '';
        setProfileData(prev => ({ ...prev, profileImage: avatarUrl, bio }));
        setEditData(prev => ({ ...prev, profileImage: avatarUrl, bio }));
      } catch { /* */ }
    };
    loadCloudData();
  }, [user?.id]);

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user?.id) return;
      try {
        const data = await dashboardApi.getDashboard(user.id);
        setDashboardData(data);
      } catch { /* */ }
    };
    loadDashboard();
  }, [user?.id]);

  useEffect(() => {
    const loadMemberDate = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('created_at')
          .eq('id', user.id)
          .single();
        if (data?.created_at) {
          const date = new Date(data.created_at);
          setMemberSince(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
        }
      } catch { /* */ }
    };
    loadMemberDate();
  }, [user?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchIntelligence();
    setRefreshing(false);
  };

  // Profile edit handlers
  const openEditModal = () => { setEditData(profileData); setEditModalVisible(true); };
  const closeEditModal = () => { setEditData(profileData); setEditModalVisible(false); };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted !== true) {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
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

  const saveProfile = async () => {
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
      if (user?.id && editData.profileImage !== profileData.profileImage) {
        if (editData.profileImage) {
          try {
            const base64 = await FileSystem.readAsStringAsync(editData.profileImage, { encoding: 'base64' });
            const ext = editData.profileImage.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${user.id}/avatar.${ext}`;
            const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
            const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(fileName, decode(base64), { contentType, upsert: true });
            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
              avatarUrl = urlData?.publicUrl ?? null;
            }
          } catch { /* */ }
        } else {
          avatarUrl = null;
        }
      }
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
            bio: editData.bio,
          })
          .eq('id', user.id);
        if (updateError?.code === '23505') {
          Alert.alert('Error', 'This username is already taken');
          setIsSaving(false);
          return;
        }
        try { await profileApi.syncToDelta(user.id); } catch { /* */ }
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

  return (
    <>
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>You</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={onOpenSettings}>
          <Ionicons name="settings-outline" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ====== SECTION A: YOUR PATTERNS ====== */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="git-network-outline" size={18} color={theme.accent} />
          <Text style={styles.sectionTitle}>Your Patterns</Text>
        </View>

        {intelligenceLoading ? (
          <ActivityIndicator color={theme.accent} style={{ padding: 24 }} />
        ) : chains.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="search-outline" size={28} color={theme.textSecondary} />
            <Text style={styles.emptyText}>Delta is still learning your patterns</Text>
            <Text style={styles.emptyHint}>Keep logging data - patterns emerge after 7-14 days</Text>
          </View>
        ) : (
          chains.map((chain, index) => (
            <PatternCard key={chain.id} theme={theme} chain={chain} index={index} />
          ))
        )}
      </View>

      {/* ====== SECTION B: DELTA'S BRAIN ====== */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="sparkles" size={18} color={theme.accent} />
          <Text style={styles.sectionTitle}>Delta's Brain</Text>
        </View>

        {intelligenceLoading ? (
          <ActivityIndicator color={theme.accent} style={{ padding: 24 }} />
        ) : (
          <DeltaBrain
            theme={theme}
            learningStatus={learningStatus}
            predictions={predictions}
            beliefUpdates={beliefUpdates}
            knowledgeGaps={knowledgeGaps}
          />
        )}
      </View>

      {/* ====== SECTION C: PROFILE ====== */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person-outline" size={18} color={theme.accent} />
          <Text style={styles.sectionTitle}>Profile</Text>
        </View>

        {/* Profile card */}
        <Animated.View entering={FadeInDown.springify()} style={styles.profileCard}>
          <View style={styles.profileRow}>
            {profileData.profileImage !== null ? (
              <Image source={{ uri: profileData.profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profileData.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{profileData.displayName}</Text>
              {profileData.username.length > 0 && (
                <Text style={styles.userHandle}>@{profileData.username}</Text>
              )}
              {profileData.bio.length > 0 && (
                <Text style={styles.userBio}>{profileData.bio}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
              <Ionicons name="pencil" size={16} color={theme.accent} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Overview grid */}
        <View style={styles.overviewGrid}>
          {dashboardData?.streak && (
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{dashboardData.streak.current_streak}</Text>
              <Text style={styles.overviewLabel}>Day Streak</Text>
            </View>
          )}
          {dashboardData?.streak && (
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{dashboardData.streak.longest_streak}</Text>
              <Text style={styles.overviewLabel}>Best Streak</Text>
            </View>
          )}
          {profileData.age.length > 0 && (
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{profileData.age}</Text>
              <Text style={styles.overviewLabel}>Age</Text>
            </View>
          )}
          {memberSince && (
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{memberSince}</Text>
              <Text style={styles.overviewLabel}>Member Since</Text>
            </View>
          )}
        </View>

      </View>

      <View style={{ height: 32 }} />
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
          <TouchableOpacity onPress={saveProfile} disabled={isSaving === true}>
            {isSaving === true ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <Text style={styles.modalSave}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
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
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={editData.displayName}
              onChangeText={(text) => setEditData(prev => ({ ...prev, displayName: text }))}
              placeholder="Your name"
              placeholderTextColor={theme.textSecondary}
              maxLength={30}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={styles.input}
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
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Age</Text>
            <TextInput
              style={styles.input}
              value={editData.age}
              onChangeText={(text) => setEditData(prev => ({ ...prev, age: text.replace(/[^0-9]/g, '') }))}
              placeholder="Your age"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Gender</Text>
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
                  <Text style={[
                    styles.genderOptionText,
                    editData.gender === option && styles.genderOptionTextSelected,
                  ]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              value={editData.bio}
              onChangeText={(text) => setEditData(prev => ({ ...prev, bio: text }))}
              placeholder="Add a bio..."
              placeholderTextColor={theme.textSecondary}
              multiline
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
    settingsButton: {
      padding: 8,
    },
    section: {
      padding: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    emptyCard: {
      alignItems: 'center',
      padding: 32,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    emptyText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textPrimary,
      marginTop: 12,
    },
    emptyHint: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    // Profile
    profileCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 12,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatarImage: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 22,
      fontWeight: '700',
      color: '#ffffff',
    },
    profileInfo: {
      flex: 1,
      marginLeft: 12,
    },
    userName: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    userHandle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 1,
    },
    userBio: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    editButton: {
      padding: 8,
    },
    overviewGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    overviewItem: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 12,
      flex: 1,
      minWidth: '45%' as unknown as number,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
    },
    overviewValue: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    overviewLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 2,
    },
    // Modal
    modalContainer: { flex: 1 },
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
    modalCancel: { fontSize: 16, color: theme.textSecondary },
    modalTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
    modalSave: { fontSize: 16, fontWeight: '600', color: theme.accent },
    modalContent: { flex: 1, padding: 16 },
    modalAvatarSection: { alignItems: 'center', marginBottom: 24 },
    modalAvatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    editBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.background,
    },
    inputGroup: { marginBottom: 20 },
    inputLabel: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 6 },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.border,
    },
    charCount: { fontSize: 11, color: theme.textSecondary, textAlign: 'right', marginTop: 4 },
    genderOptions: { flexDirection: 'row', gap: 8 },
    genderOption: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    genderOptionSelected: { backgroundColor: theme.accentLight, borderColor: theme.accent },
    genderOptionText: { fontSize: 14, color: theme.textSecondary },
    genderOptionTextSelected: { color: theme.accent, fontWeight: '600' },
  });
}
