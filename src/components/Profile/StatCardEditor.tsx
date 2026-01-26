/**
 * StatCardEditor - Modal for adding/editing stat cards.
 *
 * Uses a searchable dropdown for stat type selection instead of a grid.
 * Supports many preset options plus custom stats.
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  FlatList,
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
  category: string;
}

// Comprehensive list of preset options organized by category
const PRESET_OPTIONS: PresetOption[] = [
  // Strength - Compound Lifts
  { type: 'bench_max', name: 'Bench Press Max', unit: 'lbs', icon: 'barbell-outline', category: 'Strength' },
  { type: 'squat_max', name: 'Squat Max', unit: 'lbs', icon: 'fitness-outline', category: 'Strength' },
  { type: 'deadlift_max', name: 'Deadlift Max', unit: 'lbs', icon: 'barbell-outline', category: 'Strength' },
  { type: 'overhead_press_max', name: 'Overhead Press Max', unit: 'lbs', icon: 'arrow-up-outline', category: 'Strength' },
  { type: 'row_max', name: 'Barbell Row Max', unit: 'lbs', icon: 'swap-horizontal-outline', category: 'Strength' },
  { type: 'clean_max', name: 'Power Clean Max', unit: 'lbs', icon: 'flash-outline', category: 'Strength' },
  { type: 'snatch_max', name: 'Snatch Max', unit: 'lbs', icon: 'flash-outline', category: 'Strength' },

  // Strength - Isolation
  { type: 'bicep_curl_max', name: 'Bicep Curl Max', unit: 'lbs', icon: 'fitness-outline', category: 'Strength' },
  { type: 'tricep_extension_max', name: 'Tricep Extension Max', unit: 'lbs', icon: 'fitness-outline', category: 'Strength' },
  { type: 'lat_pulldown_max', name: 'Lat Pulldown Max', unit: 'lbs', icon: 'arrow-down-outline', category: 'Strength' },
  { type: 'leg_press_max', name: 'Leg Press Max', unit: 'lbs', icon: 'fitness-outline', category: 'Strength' },
  { type: 'leg_curl_max', name: 'Leg Curl Max', unit: 'lbs', icon: 'fitness-outline', category: 'Strength' },

  // Bodyweight
  { type: 'pullups_max', name: 'Max Pull-ups', unit: 'reps', icon: 'body-outline', category: 'Bodyweight' },
  { type: 'pushups_max', name: 'Max Push-ups', unit: 'reps', icon: 'body-outline', category: 'Bodyweight' },
  { type: 'dips_max', name: 'Max Dips', unit: 'reps', icon: 'body-outline', category: 'Bodyweight' },
  { type: 'situps_max', name: 'Max Sit-ups', unit: 'reps', icon: 'body-outline', category: 'Bodyweight' },
  { type: 'plank_max', name: 'Max Plank Hold', unit: 'sec', icon: 'timer-outline', category: 'Bodyweight' },
  { type: 'wall_sit_max', name: 'Max Wall Sit', unit: 'sec', icon: 'timer-outline', category: 'Bodyweight' },

  // Running
  { type: 'mile_time', name: 'Mile Time', unit: 'min:sec', icon: 'stopwatch-outline', category: 'Running' },
  { type: '5k_time', name: '5K Time', unit: 'min:sec', icon: 'timer-outline', category: 'Running' },
  { type: '10k_time', name: '10K Time', unit: 'min:sec', icon: 'timer-outline', category: 'Running' },
  { type: 'half_marathon_time', name: 'Half Marathon Time', unit: 'hr:min', icon: 'timer-outline', category: 'Running' },
  { type: 'marathon_time', name: 'Marathon Time', unit: 'hr:min', icon: 'timer-outline', category: 'Running' },
  { type: '400m_time', name: '400m Time', unit: 'sec', icon: 'stopwatch-outline', category: 'Running' },
  { type: 'longest_run', name: 'Longest Run', unit: 'mi', icon: 'map-outline', category: 'Running' },

  // Cardio
  { type: 'vo2_max', name: 'VO2 Max', unit: 'mL/kg/min', icon: 'pulse-outline', category: 'Cardio' },
  { type: 'resting_hr', name: 'Resting Heart Rate', unit: 'bpm', icon: 'heart-outline', category: 'Cardio' },
  { type: 'max_hr', name: 'Max Heart Rate', unit: 'bpm', icon: 'heart-outline', category: 'Cardio' },
  { type: '2k_row_time', name: '2K Row Time', unit: 'min:sec', icon: 'boat-outline', category: 'Cardio' },
  { type: 'bike_ftp', name: 'Cycling FTP', unit: 'W', icon: 'bicycle-outline', category: 'Cardio' },

  // Body Composition
  { type: 'body_weight', name: 'Body Weight', unit: 'lbs', icon: 'scale-outline', category: 'Body' },
  { type: 'body_fat', name: 'Body Fat', unit: '%', icon: 'body-outline', category: 'Body' },
  { type: 'muscle_mass', name: 'Muscle Mass', unit: 'lbs', icon: 'fitness-outline', category: 'Body' },
  { type: 'waist', name: 'Waist', unit: 'in', icon: 'resize-outline', category: 'Body' },
  { type: 'chest', name: 'Chest', unit: 'in', icon: 'resize-outline', category: 'Body' },
  { type: 'bicep', name: 'Bicep', unit: 'in', icon: 'resize-outline', category: 'Body' },
  { type: 'thigh', name: 'Thigh', unit: 'in', icon: 'resize-outline', category: 'Body' },
  { type: 'height', name: 'Height', unit: 'ft-in', icon: 'resize-outline', category: 'Body' },

  // Flexibility & Mobility
  { type: 'sit_reach', name: 'Sit and Reach', unit: 'in', icon: 'expand-outline', category: 'Flexibility' },
  { type: 'squat_depth', name: 'Squat Depth', unit: 'in', icon: 'arrow-down-outline', category: 'Flexibility' },
  { type: 'shoulder_mobility', name: 'Shoulder Mobility', unit: 'in', icon: 'expand-outline', category: 'Flexibility' },

  // Sports Specific
  { type: 'vertical_jump', name: 'Vertical Jump', unit: 'in', icon: 'arrow-up-outline', category: 'Sports' },
  { type: 'broad_jump', name: 'Broad Jump', unit: 'in', icon: 'arrow-forward-outline', category: 'Sports' },
  { type: '40_yard_dash', name: '40 Yard Dash', unit: 'sec', icon: 'flash-outline', category: 'Sports' },
  { type: 'shuttle_run', name: '5-10-5 Shuttle', unit: 'sec', icon: 'shuffle-outline', category: 'Sports' },
  { type: 'sprint_100m', name: '100m Sprint', unit: 'sec', icon: 'flash-outline', category: 'Sports' },

  // Custom
  { type: 'custom', name: 'Custom Stat', unit: '', icon: 'create-outline', category: 'Custom' },
];

// Get unique categories for filtering
const CATEGORIES = [...new Set(PRESET_OPTIONS.map(p => p.category))];

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

  // Dropdown state
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter options based on search and category
  const filteredOptions = useMemo(() => {
    let options = PRESET_OPTIONS;

    if (selectedCategory !== null) {
      options = options.filter(o => o.category === selectedCategory);
    }

    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      options = options.filter(o =>
        o.name.toLowerCase().includes(query) ||
        o.category.toLowerCase().includes(query) ||
        o.type.toLowerCase().includes(query)
      );
    }

    return options;
  }, [searchQuery, selectedCategory]);

  // Get selected preset
  const selectedPreset = useMemo(() => {
    return PRESET_OPTIONS.find(p => p.type === selectedType) ?? PRESET_OPTIONS[PRESET_OPTIONS.length - 1];
  }, [selectedType]);

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
      setShowDropdown(false);
      setSearchQuery('');
      setSelectedCategory(null);
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
    setShowDropdown(false);
    setSearchQuery('');
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

  const renderDropdownItem = ({ item }: { item: PresetOption }) => (
    <TouchableOpacity
      style={[
        styles.dropdownItem,
        selectedType === item.type && styles.dropdownItemSelected,
      ]}
      onPress={() => handlePresetSelect(item)}
    >
      <View style={styles.dropdownItemLeft}>
        <View style={[styles.dropdownItemIcon, selectedType === item.type && styles.dropdownItemIconSelected]}>
          <Ionicons
            name={item.icon as any}
            size={20}
            color={selectedType === item.type ? '#fff' : theme.textSecondary}
          />
        </View>
        <View>
          <Text style={[styles.dropdownItemName, selectedType === item.type && styles.dropdownItemNameSelected]}>
            {item.name}
          </Text>
          <Text style={styles.dropdownItemCategory}>{item.category}</Text>
        </View>
      </View>
      {item.unit.length > 0 && (
        <Text style={styles.dropdownItemUnit}>{item.unit}</Text>
      )}
    </TouchableOpacity>
  );

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

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Stat Type Selector (only for new cards) */}
          {isEditing !== true && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Stat Type</Text>

              {/* Selected Stat Display / Dropdown Trigger */}
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setShowDropdown(!showDropdown)}
              >
                <View style={styles.dropdownTriggerLeft}>
                  <View style={styles.selectedIcon}>
                    <Ionicons
                      name={selectedPreset.icon as any}
                      size={22}
                      color={theme.accent}
                    />
                  </View>
                  <View>
                    <Text style={styles.dropdownTriggerText}>{selectedPreset.name}</Text>
                    <Text style={styles.dropdownTriggerCategory}>{selectedPreset.category}</Text>
                  </View>
                </View>
                <Ionicons
                  name={showDropdown ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>

              {/* Dropdown Content */}
              {showDropdown === true && (
                <View style={styles.dropdownContainer}>
                  {/* Search Input */}
                  <View style={styles.searchContainer}>
                    <Ionicons name="search" size={18} color={theme.textSecondary} />
                    <TextInput
                      style={styles.searchInput}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Search stats..."
                      placeholderTextColor={theme.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Category Pills */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.categoryScroll}
                    contentContainerStyle={styles.categoryContainer}
                  >
                    <TouchableOpacity
                      style={[
                        styles.categoryPill,
                        selectedCategory === null && styles.categoryPillSelected,
                      ]}
                      onPress={() => setSelectedCategory(null)}
                    >
                      <Text style={[
                        styles.categoryPillText,
                        selectedCategory === null && styles.categoryPillTextSelected,
                      ]}>
                        All
                      </Text>
                    </TouchableOpacity>
                    {CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryPill,
                          selectedCategory === cat && styles.categoryPillSelected,
                        ]}
                        onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                      >
                        <Text style={[
                          styles.categoryPillText,
                          selectedCategory === cat && styles.categoryPillTextSelected,
                        ]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Options List */}
                  <View style={styles.optionsList}>
                    <FlatList
                      data={filteredOptions}
                      keyExtractor={(item) => item.type}
                      renderItem={renderDropdownItem}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      style={styles.flatList}
                      ListEmptyComponent={
                        <Text style={styles.noResults}>No stats found</Text>
                      }
                    />
                  </View>
                </View>
              )}
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
              keyboardType={selectedType.includes('time') ? 'default' : 'numeric'}
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

          {/* Extra spacing at bottom */}
          <View style={{ height: 40 }} />
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

    // Dropdown Trigger
    dropdownTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    dropdownTriggerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    selectedIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: theme.accentLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    dropdownTriggerText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    dropdownTriggerCategory: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },

    // Dropdown Container
    dropdownContainer: {
      marginTop: 12,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },

    // Search
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    searchInput: {
      flex: 1,
      marginLeft: 8,
      fontSize: 15,
      color: theme.textPrimary,
    },

    // Categories
    categoryScroll: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    categoryContainer: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    categoryPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.background,
      marginRight: 8,
    },
    categoryPillSelected: {
      backgroundColor: theme.accent,
    },
    categoryPillText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    categoryPillTextSelected: {
      color: '#fff',
    },

    // Options List
    optionsList: {
      maxHeight: 280,
    },
    flatList: {
      flexGrow: 0,
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    dropdownItemSelected: {
      backgroundColor: theme.accentLight,
    },
    dropdownItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    dropdownItemIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    dropdownItemIconSelected: {
      backgroundColor: theme.accent,
    },
    dropdownItemName: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.textPrimary,
    },
    dropdownItemNameSelected: {
      color: theme.accent,
      fontWeight: '600',
    },
    dropdownItemCategory: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 1,
    },
    dropdownItemUnit: {
      fontSize: 13,
      color: theme.textSecondary,
      marginLeft: 8,
    },
    noResults: {
      padding: 20,
      textAlign: 'center',
      color: theme.textSecondary,
      fontSize: 14,
    },

    // Input Fields
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

    // Delete Button
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
