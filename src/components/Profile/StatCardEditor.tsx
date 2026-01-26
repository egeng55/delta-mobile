/**
 * StatCardEditor - Modal for adding/editing stat cards.
 *
 * Preset options:
 * - Bench Max, Squat Max, Deadlift Max
 * - Mile Time, 5K Time
 * - Body Weight, Body Fat
 * - Custom (user-defined)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../theme/colors';
import { StatCard, StatCardInput } from '../../services/api';

interface StatCardEditorProps {
  theme: Theme;
  visible: boolean;
  card?: StatCard | null;
  onClose: () => void;
  onSave: (data: StatCardInput) => Promise<void>;
  onDelete?: (cardId: string) => Promise<void>;
}

interface PresetOption {
  type: string;
  name: string;
  unit: string;
  icon: string;
}

const PRESET_OPTIONS: PresetOption[] = [
  { type: 'bench_max', name: 'Bench Press Max', unit: 'lbs', icon: 'barbell-outline' },
  { type: 'squat_max', name: 'Squat Max', unit: 'lbs', icon: 'fitness-outline' },
  { type: 'deadlift_max', name: 'Deadlift Max', unit: 'lbs', icon: 'barbell-outline' },
  { type: 'mile_time', name: 'Mile Time', unit: 'min:sec', icon: 'stopwatch-outline' },
  { type: '5k_time', name: '5K Time', unit: 'min:sec', icon: 'timer-outline' },
  { type: 'body_weight', name: 'Body Weight', unit: 'lbs', icon: 'scale-outline' },
  { type: 'body_fat', name: 'Body Fat', unit: '%', icon: 'body-outline' },
  { type: 'custom', name: 'Custom Stat', unit: '', icon: 'star-outline' },
];

export default function StatCardEditor({
  theme,
  visible,
  card,
  onClose,
  onSave,
  onDelete,
}: StatCardEditorProps): React.ReactNode {
  const insets = useSafeAreaInsets();
  const isEditing = card !== undefined && card !== null;

  const [selectedType, setSelectedType] = useState<string>('custom');
  const [displayName, setDisplayName] = useState<string>('');
  const [value, setValue] = useState<string>('');
  const [unit, setUnit] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Reset form when modal opens
  useEffect(() => {
    if (visible === true) {
      if (isEditing && card !== null) {
        setSelectedType(card.card_type);
        setDisplayName(card.display_name);
        setValue(card.value);
        setUnit(card.unit || '');
      } else {
        setSelectedType('custom');
        setDisplayName('');
        setValue('');
        setUnit('');
      }
    }
  }, [visible, card, isEditing]);

  const handlePresetSelect = (preset: PresetOption): void => {
    setSelectedType(preset.type);
    if (preset.type !== 'custom') {
      setDisplayName(preset.name);
      setUnit(preset.unit);
    } else {
      setDisplayName('');
      setUnit('');
    }
  };

  const handleSave = async (): Promise<void> => {
    if (displayName.trim().length === 0) {
      Alert.alert('Error', 'Please enter a name for this stat');
      return;
    }
    if (value.trim().length === 0) {
      Alert.alert('Error', 'Please enter a value');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        card_type: selectedType,
        display_name: displayName.trim(),
        value: value.trim(),
        unit: unit.trim() || undefined,
        recorded_at: new Date().toISOString(),
      });
      onClose();
    } catch {
      Alert.alert('Error', 'Could not save stat. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (): void => {
    if (onDelete === undefined || card === null || card === undefined) return;

    Alert.alert(
      'Delete Stat',
      'Are you sure you want to delete this stat?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(card.id);
              onClose();
            } catch {
              Alert.alert('Error', 'Could not delete stat.');
            }
          },
        },
      ]
    );
  };

  const styles = createStyles(theme, insets.top);

  return (
    <Modal
      visible={visible === true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {isEditing ? 'Edit Stat' : 'Add Stat'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={isSaving === true}>
            <Text style={[styles.saveText, isSaving === true && styles.disabled]}>
              {isSaving === true ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Preset Selection (only for new cards) */}
          {isEditing !== true && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Choose a Stat Type</Text>
              <View style={styles.presetGrid}>
                {PRESET_OPTIONS.map((preset) => (
                  <TouchableOpacity
                    key={preset.type}
                    style={[
                      styles.presetButton,
                      selectedType === preset.type && styles.presetButtonSelected,
                    ]}
                    onPress={() => handlePresetSelect(preset)}
                  >
                    <Ionicons
                      name={preset.icon as any}
                      size={24}
                      color={selectedType === preset.type ? theme.accent : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.presetLabel,
                        selectedType === preset.type && styles.presetLabelSelected,
                      ]}
                      numberOfLines={2}
                    >
                      {preset.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Name Input */}
          <View style={styles.section}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g., Bench Press Max"
              placeholderTextColor={theme.textSecondary}
              maxLength={30}
            />
          </View>

          {/* Value Input */}
          <View style={styles.section}>
            <Text style={styles.inputLabel}>Value</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              placeholder="e.g., 225"
              placeholderTextColor={theme.textSecondary}
              keyboardType={selectedType === 'mile_time' || selectedType === '5k_time' ? 'default' : 'numeric'}
              maxLength={20}
            />
          </View>

          {/* Unit Input */}
          <View style={styles.section}>
            <Text style={styles.inputLabel}>Unit (optional)</Text>
            <TextInput
              style={styles.input}
              value={unit}
              onChangeText={setUnit}
              placeholder="e.g., lbs, kg, min:sec"
              placeholderTextColor={theme.textSecondary}
              maxLength={10}
            />
          </View>

          {/* Delete Button (for editing) */}
          {isEditing === true && onDelete !== undefined && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={18} color={theme.error} />
              <Text style={styles.deleteText}>Delete Stat</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(theme: Theme, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: topInset + 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    cancelText: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    saveText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.accent,
    },
    disabled: {
      opacity: 0.5,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 12,
    },
    presetGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -4,
    },
    presetButton: {
      width: '25%',
      padding: 4,
      alignItems: 'center',
    },
    presetButtonSelected: {
      backgroundColor: theme.accentLight,
      borderRadius: 12,
    },
    presetLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 4,
    },
    presetLabelSelected: {
      color: theme.accent,
      fontWeight: '600',
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.border,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      marginTop: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.error,
    },
    deleteText: {
      fontSize: 15,
      color: theme.error,
      fontWeight: '500',
      marginLeft: 8,
    },
  });
}
