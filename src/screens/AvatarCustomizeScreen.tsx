/**
 * AvatarCustomizeScreen - Simple avatar customization
 *
 * Select body type, style, and skin tone for your avatar.
 * Body scan is available as a separate optional feature in settings.
 */

import React, { useState, useEffect, Suspense } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import AnimatedAvatar from '../components/Avatar/AnimatedAvatar';
import {
  UserAvatar,
  AvatarTemplate,
  AvatarStyle,
  AVATAR_TEMPLATES,
  SKIN_TONES,
  DEFAULT_AVATAR,
} from '../types/avatar';
import { avatarService } from '../services/avatarService';

// Lazy load scan screen to avoid expo-camera issues
const AvatarScanScreen = React.lazy(() => import('./AvatarScanScreen'));

interface AvatarCustomizeScreenProps {
  theme: Theme;
  onClose: () => void;
  onSave?: (avatar: UserAvatar) => void;
}

const STYLES: { id: AvatarStyle; name: string }[] = [
  { id: 'soft', name: 'Soft' },
  { id: 'geometric', name: 'Angular' },
  { id: 'minimal', name: 'Simple' },
];

export default function AvatarCustomizeScreen({
  theme,
  onClose,
  onSave,
}: AvatarCustomizeScreenProps): React.ReactElement {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [avatar, setAvatar] = useState<UserAvatar>(DEFAULT_AVATAR);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [bodyScanEnabled, setBodyScanEnabled] = useState(false);
  const [showScan, setShowScan] = useState(false);

  // Load existing avatar
  useEffect(() => {
    const loadAvatar = async () => {
      if (user?.id) {
        const existing = await avatarService.getAvatar(user.id);
        setAvatar(existing);
      }
      setIsLoading(false);
    };
    loadAvatar();
  }, [user?.id]);

  // Load body scan setting
  useEffect(() => {
    const loadBodyScanSetting = async () => {
      try {
        const saved = await AsyncStorage.getItem('@delta:bodyScanEnabled');
        setBodyScanEnabled(saved === 'true');
      } catch {
        // Default to false
      }
    };
    loadBodyScanSetting();
  }, []);

  const handleSave = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      await avatarService.saveAvatar(user.id, avatar);
      onSave?.(avatar);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Could not save avatar. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectTemplate = (template: AvatarTemplate) => {
    setAvatar(prev => ({ ...prev, templateId: template.id }));
  };

  const selectStyle = (style: AvatarStyle) => {
    setAvatar(prev => ({ ...prev, style }));
  };

  const selectSkinTone = (color: string) => {
    setAvatar(prev => ({ ...prev, skinTone: color }));
  };

  const styles = createStyles(theme, insets.top);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerButton}>
          <Ionicons name="close" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Avatar</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.headerButton}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Spinning Preview */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.previewContainer}>
          <AnimatedAvatar
            templateId={avatar.templateId}
            style={avatar.style}
            skinTone={avatar.skinTone}
            size={180}
            spinning
            spinDuration={10000}
          />
        </Animated.View>

        {/* Body Type */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <Text style={styles.sectionTitle}>Body Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.templateScroll}
          >
            {AVATAR_TEMPLATES.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={[
                  styles.templateCard,
                  avatar.templateId === template.id && styles.templateCardSelected,
                ]}
                onPress={() => selectTemplate(template)}
              >
                <AnimatedAvatar
                  templateId={template.id}
                  style={avatar.style}
                  skinTone={avatar.skinTone}
                  size={60}
                  spinning={false}
                />
                <Text
                  style={[
                    styles.templateName,
                    avatar.templateId === template.id && styles.templateNameSelected,
                  ]}
                >
                  {template.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Style */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <Text style={styles.sectionTitle}>Style</Text>
          <View style={styles.styleRow}>
            {STYLES.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.styleChip,
                  avatar.style === s.id && styles.styleChipSelected,
                ]}
                onPress={() => selectStyle(s.id)}
              >
                <Text
                  style={[
                    styles.styleChipText,
                    avatar.style === s.id && styles.styleChipTextSelected,
                  ]}
                >
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Skin Tone */}
        <Animated.View entering={FadeInDown.delay(300).duration(300)}>
          <Text style={styles.sectionTitle}>Skin Tone</Text>
          <View style={styles.skinToneRow}>
            {SKIN_TONES.map((tone) => (
              <TouchableOpacity
                key={tone.id}
                style={[
                  styles.skinToneButton,
                  { backgroundColor: tone.color },
                  avatar.skinTone === tone.color && styles.skinToneSelected,
                ]}
                onPress={() => selectSkinTone(tone.color)}
              >
                {avatar.skinTone === tone.color && (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Body Scan Button (conditional) */}
        {bodyScanEnabled && (
          <Animated.View entering={FadeInDown.delay(400).duration(300)}>
            <Text style={styles.sectionTitle}>Advanced</Text>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => setShowScan(true)}
            >
              <View style={styles.scanButtonIcon}>
                <Ionicons name="scan-outline" size={24} color={theme.accent} />
              </View>
              <View style={styles.scanButtonContent}>
                <Text style={styles.scanButtonTitle}>Scan Body</Text>
                <Text style={styles.scanButtonSubtitle}>
                  Use camera to customize proportions
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Body Scan Modal */}
      <Modal
        visible={showScan}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowScan(false)}
      >
        <Suspense
          fallback={
            <View style={[styles.container, styles.centered]}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          }
        >
          <AvatarScanScreen
            theme={theme}
            onClose={() => setShowScan(false)}
            onComplete={() => setShowScan(false)}
          />
        </Suspense>
      </Modal>
    </View>
  );
}

function createStyles(theme: Theme, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: topInset + 8,
      paddingBottom: 8,
      paddingHorizontal: 16,
    },
    headerButton: {
      width: 50,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    saveText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.accent,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
    },
    previewContainer: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 24,
      marginBottom: 12,
    },
    templateScroll: {
      gap: 12,
      paddingVertical: 4,
    },
    templateCard: {
      width: 90,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 12,
      backgroundColor: theme.surface,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    templateCardSelected: {
      borderColor: theme.accent,
    },
    templateName: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.textSecondary,
      marginTop: 8,
    },
    templateNameSelected: {
      color: theme.accent,
      fontWeight: '600',
    },
    styleRow: {
      flexDirection: 'row',
      gap: 10,
    },
    styleChip: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: theme.surface,
      alignItems: 'center',
    },
    styleChipSelected: {
      backgroundColor: theme.accent,
    },
    styleChipText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    styleChipTextSelected: {
      color: '#fff',
    },
    skinToneRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    },
    skinToneButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: 'transparent',
    },
    skinToneSelected: {
      borderColor: theme.accent,
    },
    scanButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    scanButtonIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    scanButtonContent: {
      flex: 1,
    },
    scanButtonTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    scanButtonSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
  });
}
