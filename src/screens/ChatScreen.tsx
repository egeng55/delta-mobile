/**
 * ChatScreen - Main Delta AI chat interface with image support.
 *
 * Features:
 * - Markdown rendering for Delta messages (no bubbles)
 * - User messages in bubbles
 * - Delta logo in header with spin on hold
 * - Rich formatting support (bold, headers, lists, tables)
 */

import React, { useState, useRef, useMemo, useCallback, memo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  ActionSheetIOS,
  ScrollView,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Markdown from 'react-native-markdown-display';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useAccess } from '../context/AccessContext';
import { useUnits } from '../context/UnitsContext';
import { chatApi, conversationsApi, dashboardInsightApi } from '../services/api';
import { DeltaLogoSimple } from '../components/DeltaLogo';
import { MainTabParamList } from '../navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInsightsData } from '../hooks/useInsightsData';
import { supabase } from '../services/supabase';
import { getWeather, formatWeatherForContext, WeatherData } from '../services/weather';
import { PullDownDashboard } from '../components/Dashboard';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import VoiceChatModal from '../components/Chat/VoiceChatModal';

const springConfig = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

interface ChatScreenProps {
  theme: Theme;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  imageUri?: string;
}

interface SavedConversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

const CONVERSATIONS_STORAGE_KEY = '@delta_conversations';
const CURRENT_CONVERSATION_KEY = '@delta_current_conversation';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WELCOME_MESSAGE = `**Welcome to Delta!**

I'm your personal health intelligence assistant. Here's what I can help you with:

**Track & Log**
- Meals, workouts, sleep, mood, and more
- Just tell me naturally - no forms needed
- Share food photos for instant meal logging

**Insights & Trends**
- See patterns in your health data
- Get personalized recommendations
- Weekly and monthly summaries

**Ask Anything**
- Nutrition questions
- Workout suggestions
- Sleep optimization tips

To get started, try saying something like:
- "I just had a chicken salad for lunch"
- "Went for a 30 minute run this morning"
- "How did I sleep this week?"

*Your data stays private and secure.*`;

export default function ChatScreen({ theme }: ChatScreenProps): React.ReactNode {
  const { user } = useAuth();
  const { profile } = useAccess();
  const { unitSystem } = useUnits();
  const { invalidateCache } = useInsightsData();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const insets = useSafeAreaInsets();
  const sendButtonScale = useSharedValue(1);
  const imageButtonScale = useSharedValue(1);
  const logoRotation = useSharedValue(0);
  const [profileImage, setProfileImage] = React.useState<string | null>(null);
  const [weatherData, setWeatherData] = React.useState<WeatherData | null>(null);
  const [showDashboard, setShowDashboard] = useState<boolean>(false);

  // Load weather data for Delta's context
  React.useEffect(() => {
    const loadWeather = async (): Promise<void> => {
      try {
        const weather = await getWeather();
        if (weather) {
          setWeatherData(weather);
        }
      } catch {
        // Weather is optional enhancement
      }
    };
    loadWeather();
  }, []);

  // Load profile image from Supabase (cloud only - no fallback to stale cache)
  React.useEffect(() => {
    const loadProfileImage = async (): Promise<void> => {
      if (!user?.id) return;

      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();

        if (!error && profileData?.avatar_url) {
          setProfileImage(profileData.avatar_url);
        } else {
          setProfileImage(null); // Clear any stale state
        }
      } catch {
        setProfileImage(null);
      }
    };
    loadProfileImage();
  }, [user?.id]);

  const sendButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
  }));

  const imageButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: imageButtonScale.value }],
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${logoRotation.value}deg` }],
  }));

  const handleSendPressIn = (): void => {
    sendButtonScale.value = withSpring(0.9, springConfig);
  };

  const handleSendPressOut = (): void => {
    sendButtonScale.value = withSpring(1, springConfig);
  };

  const handleImagePressIn = (): void => {
    imageButtonScale.value = withSpring(0.9, springConfig);
  };

  const handleImagePressOut = (): void => {
    imageButtonScale.value = withSpring(1, springConfig);
  };

  const handleLogoPressIn = (): void => {
    logoRotation.value = withTiming(360, { duration: 600, easing: Easing.out(Easing.cubic) });
  };

  const handleLogoPressOut = (): void => {
    logoRotation.value = withTiming(0, { duration: 300 });
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: WELCOME_MESSAGE,
      isUser: false,
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSidebar, setShowSidebar] = useState<boolean>(false);
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState<boolean>(false);
  const [renameConvId, setRenameConvId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState<string>('');
  const [showVoiceModal, setShowVoiceModal] = useState<boolean>(false);
  const [dashboardMessage, setDashboardMessage] = useState<string | undefined>(undefined);
  const [isLoadingDashboardMessage, setIsLoadingDashboardMessage] = useState<boolean>(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  const inputRef = useRef<TextInput>(null);
  const renameInputRef = useRef<TextInput>(null);

  // Load saved conversations on mount
  useEffect(() => {
    loadConversations();
  }, [user?.id]);

  // Fetch dashboard insight on app load (once weather is ready)
  useEffect(() => {
    if (user?.id && weatherData) {
      fetchDashboardInsight();
    }
  }, [user?.id, weatherData]);

  // Auto-save current conversation when messages change
  useEffect(() => {
    if (messages.length > 1) { // Don't save just the welcome message
      saveCurrentConversation();
    }
  }, [messages]);

  const loadConversations = async (): Promise<void> => {
    try {
      const saved = await AsyncStorage.getItem(`${CONVERSATIONS_STORAGE_KEY}_${user?.id}`);
      if (saved) {
        const parsed = JSON.parse(saved) as SavedConversation[];
        setConversations(parsed.sort((a, b) => b.updatedAt - a.updatedAt));
      }
      // Load current conversation ID
      const currentId = await AsyncStorage.getItem(`${CURRENT_CONVERSATION_KEY}_${user?.id}`);
      if (currentId) {
        setCurrentConversationId(currentId);
        // Load the conversation messages
        const conv = JSON.parse(saved || '[]').find((c: SavedConversation) => c.id === currentId);
        if (conv) {
          setMessages(conv.messages);
        }
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const saveCurrentConversation = async (): Promise<void> => {
    try {
      let convId = currentConversationId;
      const now = Date.now();

      if (!convId) {
        convId = `conv_${now}`;
        setCurrentConversationId(convId);
        await AsyncStorage.setItem(`${CURRENT_CONVERSATION_KEY}_${user?.id}`, convId);
      }

      const updatedConversations = [...conversations];
      const existingIndex = updatedConversations.findIndex(c => c.id === convId);

      // Preserve existing title if conversation was renamed, otherwise auto-generate
      let title: string;
      if (existingIndex >= 0 && updatedConversations[existingIndex].title) {
        // Keep the existing title (may have been renamed by user)
        title = updatedConversations[existingIndex].title;
      } else {
        // Generate title from first user message for new conversations
        const firstUserMsg = messages.find(m => m.isUser);
        title = firstUserMsg
          ? firstUserMsg.text.slice(0, 40) + (firstUserMsg.text.length > 40 ? '...' : '')
          : 'New conversation';
      }

      const conversation: SavedConversation = {
        id: convId,
        title,
        messages,
        createdAt: existingIndex >= 0 ? updatedConversations[existingIndex].createdAt : now,
        updatedAt: now,
      };

      if (existingIndex >= 0) {
        updatedConversations[existingIndex] = conversation;
      } else {
        updatedConversations.unshift(conversation);
      }

      setConversations(updatedConversations.sort((a, b) => b.updatedAt - a.updatedAt));
      await AsyncStorage.setItem(
        `${CONVERSATIONS_STORAGE_KEY}_${user?.id}`,
        JSON.stringify(updatedConversations)
      );
      // Sync conversation metadata to backend
      if (user?.id && convId) {
        try {
          await conversationsApi.create(user.id, convId, title);
        } catch {
          // Silently fail - local storage is primary
        }
      }
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  };

  const startNewConversation = async (): Promise<void> => {
    setMessages([
      {
        id: 'welcome',
        text: WELCOME_MESSAGE,
        isUser: false,
        timestamp: Date.now(),
      },
    ]);
    setCurrentConversationId(null);
    await AsyncStorage.removeItem(`${CURRENT_CONVERSATION_KEY}_${user?.id}`);
    setShowSidebar(false);
  };

  const loadConversation = (conv: SavedConversation): void => {
    setMessages(conv.messages);
    setCurrentConversationId(conv.id);
    AsyncStorage.setItem(`${CURRENT_CONVERSATION_KEY}_${user?.id}`, conv.id);
    setShowSidebar(false);
  };

  const showConversationOptions = (conv: SavedConversation): void => {
    Alert.alert(
      conv.title,
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rename',
          onPress: () => renameConversation(conv),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => confirmDeleteConversation(conv.id),
        },
      ]
    );
  };

  const renameConversation = (conv: SavedConversation): void => {
    setRenameConvId(conv.id);
    setRenameText(conv.title);
    setRenameModalVisible(true);
    // Focus the input after modal opens to trigger selection
    setTimeout(() => renameInputRef.current?.focus(), 100);
  };

  const handleRenameSave = async (): Promise<void> => {
    if (renameConvId && renameText.trim()) {
      const trimmedTitle = renameText.trim();
      const updated = conversations.map(c =>
        c.id === renameConvId ? { ...c, title: trimmedTitle } : c
      );
      setConversations(updated);
      await AsyncStorage.setItem(
        `${CONVERSATIONS_STORAGE_KEY}_${user?.id}`,
        JSON.stringify(updated)
      );
      // Sync to backend
      if (user?.id) {
        try {
          await conversationsApi.updateTitle(user.id, renameConvId, trimmedTitle);
        } catch {
          // Silently fail - local storage is primary
        }
      }
    }
    setRenameModalVisible(false);
    setRenameConvId(null);
    setRenameText('');
  };

  const confirmDeleteConversation = async (convId: string): Promise<void> => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = conversations.filter(c => c.id !== convId);
            setConversations(updated);
            await AsyncStorage.setItem(
              `${CONVERSATIONS_STORAGE_KEY}_${user?.id}`,
              JSON.stringify(updated)
            );
            // Sync deletion to backend
            if (user?.id) {
              try {
                await conversationsApi.delete(user.id, convId);
              } catch {
                // Silently fail - local storage is primary
              }
            }
            if (convId === currentConversationId) {
              startNewConversation();
            }
          },
        },
      ]
    );
  };

  const pickImage = async (useCamera: boolean): Promise<void> => {
    try {
      if (useCamera === true) {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraPermission.granted !== true) {
          Alert.alert('Permission Required', 'Please allow camera access to take photos.');
          return;
        }
      } else {
        const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (libraryPermission.granted !== true) {
          Alert.alert('Permission Required', 'Please allow photo library access to select images.');
          return;
        }
      }

      const result = useCamera === true
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
          });

      if (result.canceled !== true && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Could not access images. Please try again.');
    }
  };

  const showImageOptions = (): void => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            pickImage(true);
          } else if (buttonIndex === 2) {
            pickImage(false);
          }
        }
      );
    } else {
      Alert.alert(
        'Add Photo',
        'How would you like to add a photo?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => pickImage(true) },
          { text: 'Choose from Library', onPress: () => pickImage(false) },
        ]
      );
    }
  };

  const clearSelectedImage = (): void => {
    setSelectedImage(null);
  };

  // Fetch personalized dashboard insight from Delta
  const fetchDashboardInsight = async (): Promise<void> => {
    if (!user?.id) return;

    setIsLoadingDashboardMessage(true);
    try {
      const weatherContext = weatherData ? formatWeatherForContext(weatherData) : undefined;
      const response = await dashboardInsightApi.generateInsight(
        user.id,
        weatherContext,
        unitSystem
      );
      setDashboardMessage(response.message);
    } catch (e) {
      console.log('[Dashboard] Error fetching insight:', e);
      // Keep undefined to show fallback weather-based message
      setDashboardMessage(undefined);
    } finally {
      setIsLoadingDashboardMessage(false);
    }
  };

  // Open dashboard and fetch insight
  const openDashboard = (): void => {
    setShowDashboard(true);
    fetchDashboardInsight();
  };

  // Handle voice input - send text directly
  const handleVoiceSend = async (text: string): Promise<void> => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      isUser: true,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const userId = user?.id ?? 'anonymous';
      const weatherContext = weatherData ? formatWeatherForContext(weatherData) : undefined;
      const responseText = await chatApi.sendMessage(userId, text.trim(), unitSystem, weatherContext);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        isUser: false,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMessage]);
      // Invalidate and refetch so other tabs show fresh data
      invalidateCache('analytics', true);
      invalidateCache('workout', true);
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting. Please try again.",
        isUser: false,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (): Promise<void> => {
    // Blur input first to commit any autocorrect
    inputRef.current?.blur();

    // Small delay to allow autocorrect to commit
    await new Promise(resolve => setTimeout(resolve, 10));

    const trimmedText = inputText.trim();
    const hasText = trimmedText.length > 0;
    const hasImage = selectedImage !== null;

    if ((hasText !== true && hasImage !== true) || isLoading === true) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: hasText ? trimmedText : 'Shared a photo',
      isUser: true,
      timestamp: Date.now(),
      imageUri: selectedImage ?? undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    const imageToSend = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const userId = user?.id ?? 'anonymous';
      let responseText: string;

      if (hasImage && imageToSend) {
        const base64Image = await FileSystem.readAsStringAsync(imageToSend, {
          encoding: 'base64',
        });

        const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const clientLocalTime = new Date().toISOString();
        const weatherContext = weatherData ? formatWeatherForContext(weatherData) : undefined;

        const response = await chatApi.sendMessageWithImage(
          userId,
          hasText ? trimmedText : null,
          base64Image,
          clientTimezone,
          clientLocalTime,
          unitSystem,
          weatherContext
        );
        responseText = response.response;
      } else {
        const weatherContext = weatherData ? formatWeatherForContext(weatherData) : undefined;
        responseText = await chatApi.sendMessage(userId, trimmedText, unitSystem, weatherContext);
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        isUser: false,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMessage]);

      // Invalidate caches and refetch so other tabs show fresh data after logging
      invalidateCache('analytics', true);
      invalidateCache('workout', true);
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting. Please try again.",
        isUser: false,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Markdown styles for Delta messages (memoized to prevent recreation)
  const markdownStyles = useMemo(() => ({
    body: {
      color: theme.textPrimary,
      fontSize: 15,
      lineHeight: 22,
    },
    heading1: {
      color: theme.textPrimary,
      fontSize: 22,
      fontWeight: '700' as const,
      marginBottom: 8,
      marginTop: 12,
    },
    heading2: {
      color: theme.textPrimary,
      fontSize: 18,
      fontWeight: '600' as const,
      marginBottom: 6,
      marginTop: 10,
    },
    heading3: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '600' as const,
      marginBottom: 4,
      marginTop: 8,
    },
    strong: {
      color: theme.textPrimary,
      fontWeight: '600' as const,
    },
    em: {
      color: theme.textSecondary,
      fontStyle: 'italic' as const,
    },
    paragraph: {
      marginBottom: 8,
      marginTop: 0,
    },
    bullet_list: {
      marginBottom: 8,
    },
    bullet_list_icon: {
      color: theme.accent,
      fontSize: 8,
      marginRight: 8,
    },
    list_item: {
      marginBottom: 4,
      flexDirection: 'row' as const,
    },
    code_inline: {
      backgroundColor: theme.surface,
      color: theme.accent,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 14,
    },
    code_block: {
      backgroundColor: theme.surface,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },
    fence: {
      backgroundColor: theme.surface,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
    },
    table: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      marginVertical: 8,
    },
    thead: {
      backgroundColor: theme.surface,
    },
    th: {
      padding: 8,
      fontWeight: '600' as const,
    },
    td: {
      padding: 8,
      borderTopWidth: 1,
      borderColor: theme.border,
    },
    blockquote: {
      backgroundColor: theme.surface,
      borderLeftWidth: 3,
      borderLeftColor: theme.accent,
      paddingLeft: 12,
      paddingVertical: 8,
      marginVertical: 8,
    },
    hr: {
      backgroundColor: theme.border,
      height: 1,
      marginVertical: 12,
    },
    link: {
      color: theme.accent,
    },
  }), [theme]);

  const styles = useMemo(() => createStyles(theme, insets.top), [theme, insets.top]);

  // Memoized message component to prevent unnecessary re-renders
  const MessageBubble = useCallback(({ item }: { item: Message }): React.ReactElement => {
    const entering = item.isUser === true
      ? FadeInRight.duration(300).springify()
      : FadeInLeft.duration(300).springify();

    if (item.isUser === true) {
      return (
        <Animated.View
          entering={entering}
          style={[styles.messageBubble, styles.userBubble]}
        >
          {item.imageUri && (
            <Image
              source={{ uri: item.imageUri }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          )}
          <Text style={[styles.messageText, styles.userText]}>{item.text}</Text>
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={entering} style={styles.deltaMessage}>
        <View style={styles.deltaHeader}>
          <DeltaLogoSimple size={20} color={theme.accent} />
          <Text style={styles.deltaLabel}>Delta</Text>
        </View>
        <View style={styles.deltaContent}>
          <Markdown style={markdownStyles}>{item.text}</Markdown>
        </View>
      </Animated.View>
    );
  }, [styles, theme.accent, markdownStyles]);

  // Use memoized MessageBubble for rendering
  const renderMessage = useCallback(({ item }: { item: Message }): React.ReactElement => {
    return <MessageBubble item={item} />;
  }, [MessageBubble]);

  const canSend = inputText.trim().length > 0 || selectedImage !== null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Sidebar Modal - slides from left */}
      <Modal
        visible={showSidebar}
        animationType="none"
        transparent={true}
        onRequestClose={() => setShowSidebar(false)}
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.sidebarOverlay}
        >
          <Animated.View
            entering={FadeInLeft.duration(250)}
            style={styles.sidebar}
          >
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Conversations</Text>
              <TouchableOpacity onPress={() => setShowSidebar(false)}>
                <Ionicons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.newChatButton} onPress={startNewConversation}>
              <Ionicons name="add-circle-outline" size={20} color={theme.accent} />
              <Text style={styles.newChatText}>New Conversation</Text>
            </TouchableOpacity>

            <ScrollView style={styles.conversationList}>
              {conversations.length === 0 ? (
                <Text style={styles.noConversations}>No saved conversations yet</Text>
              ) : (
                conversations.map(conv => (
                  <TouchableOpacity
                    key={conv.id}
                    style={[
                      styles.conversationItem,
                      conv.id === currentConversationId && styles.conversationItemActive,
                    ]}
                    onPress={() => loadConversation(conv)}
                    onLongPress={() => showConversationOptions(conv)}
                    delayLongPress={300}
                  >
                    <View style={styles.conversationContent}>
                      <Text
                        style={[
                          styles.conversationTitle,
                          conv.id === currentConversationId && styles.conversationTitleActive,
                        ]}
                        numberOfLines={1}
                      >
                        {conv.title}
                      </Text>
                      <Text style={styles.conversationDate}>
                        {new Date(conv.updatedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => showConversationOptions(conv)}
                    >
                      <Ionicons name="ellipsis-horizontal" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <Text style={styles.sidebarHint}>Long press to delete</Text>
          </Animated.View>
          <Pressable style={styles.sidebarDismiss} onPress={() => setShowSidebar(false)} />
        </Animated.View>
      </Modal>

      {/* Rename Conversation Modal */}
      <Modal
        visible={renameModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <Pressable
          style={styles.renameModalOverlay}
          onPress={() => setRenameModalVisible(false)}
        >
          <Pressable style={styles.renameModalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.renameModalTitle}>Rename Conversation</Text>
            <TextInput
              ref={renameInputRef}
              style={styles.renameInput}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Enter conversation name"
              placeholderTextColor={theme.textSecondary}
              selectTextOnFocus={true}
              autoFocus={true}
              onSubmitEditing={handleRenameSave}
              returnKeyType="done"
            />
            <View style={styles.renameModalButtons}>
              <TouchableOpacity
                style={styles.renameModalCancel}
                onPress={() => setRenameModalVisible(false)}
              >
                <Text style={styles.renameModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.renameModalSave}
                onPress={handleRenameSave}
              >
                <Text style={styles.renameModalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Swipe area for opening sidebar */}
      <View
        style={styles.swipeArea}
        onTouchStart={(e) => {
          if (e.nativeEvent.locationX < 20) {
            setShowSidebar(true);
          }
        }}
      />

      <Pressable
        style={styles.header}
        onPress={openDashboard}
      >
        <Pressable
          onPressIn={handleLogoPressIn}
          onPressOut={handleLogoPressOut}
          style={styles.logoButton}
        >
          <Animated.View style={logoAnimatedStyle}>
            <DeltaLogoSimple size={28} color={theme.accent} />
          </Animated.View>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>DELTA</Text>
          <Ionicons name="chevron-down" size={14} color={theme.textSecondary} style={styles.headerChevron} />
        </View>
        <Pressable
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          {profileImage !== null ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profileInitial}>
                {(profile?.name ?? user?.name ?? 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </Pressable>
      </Pressable>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messageList}
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={10}
        initialNumToRender={15}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }}
      />

      {isLoading === true && (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIndicator}>
            <DeltaLogoSimple size={16} color={theme.accent} />
            <Text style={styles.loadingText}>Delta is thinking...</Text>
          </View>
        </View>
      )}

      {/* Image Preview */}
      {selectedImage !== null && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.imagePreviewContainer}>
          <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
          <Pressable style={styles.removeImageButton} onPress={clearSelectedImage}>
            <Ionicons name="close-circle" size={24} color={theme.textPrimary} />
          </Pressable>
        </Animated.View>
      )}

      <View style={styles.inputContainer}>
        {/* Image Button */}
        <Pressable
          onPress={showImageOptions}
          onPressIn={handleImagePressIn}
          onPressOut={handleImagePressOut}
          disabled={isLoading === true}
          style={styles.imageButtonWrapper}
        >
          <Animated.View
            style={[
              styles.imageButton,
              imageButtonAnimatedStyle,
              isLoading === true && styles.buttonDisabled,
            ]}
          >
            <Ionicons name="camera-outline" size={22} color={theme.accent} />
          </Animated.View>
        </Pressable>

        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={selectedImage ? "Add a message (optional)" : "Message"}
          placeholderTextColor={theme.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline={true}
          maxLength={10000}
          editable={isLoading !== true}
        />

        <Pressable
          onPress={sendMessage}
          onPressIn={handleSendPressIn}
          onPressOut={handleSendPressOut}
          disabled={canSend !== true || isLoading === true}
        >
          <Animated.View
            style={[
              styles.sendButton,
              sendButtonAnimatedStyle,
              (canSend !== true || isLoading === true) && styles.buttonDisabled,
            ]}
          >
            <Ionicons name="arrow-up" size={20} color="#ffffff" />
          </Animated.View>
        </Pressable>
      </View>

      {/* Pull-down Dashboard */}
      <PullDownDashboard
        theme={theme}
        weatherData={weatherData}
        isVisible={showDashboard}
        onClose={() => setShowDashboard(false)}
        onVoiceChat={() => {
          // Close dashboard and open voice modal
          setShowDashboard(false);
          setTimeout(() => {
            setShowVoiceModal(true);
          }, 200);
        }}
        userName={profile?.name ?? user?.name}
        deltaMessage={dashboardMessage}
        isLoadingMessage={isLoadingDashboardMessage}
      />

      {/* Voice Chat Modal */}
      <VoiceChatModal
        visible={showVoiceModal}
        theme={theme}
        onClose={() => setShowVoiceModal(false)}
        onSend={handleVoiceSend}
      />
    </KeyboardAvoidingView>
    </GestureHandlerRootView>
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
      paddingHorizontal: 16,
      paddingTop: topInset + 8,
      paddingBottom: 8,
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    logoButton: {
      marginRight: 10,
    },
    headerCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.textPrimary,
      letterSpacing: 1,
    },
    headerChevron: {
      marginLeft: 4,
      marginTop: 1,
    },
    profileButton: {
      marginLeft: 10,
    },
    profileImage: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    profilePlaceholder: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileInitial: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.accent,
    },
    messageList: {
      padding: 16,
      paddingBottom: 8,
    },
    // User message bubble
    messageBubble: {
      maxWidth: '80%',
      padding: 12,
      borderRadius: 18,
      marginBottom: 12,
    },
    userBubble: {
      backgroundColor: theme.accent,
      alignSelf: 'flex-end',
    },
    messageText: {
      fontSize: 15,
      lineHeight: 20,
    },
    userText: {
      color: '#ffffff',
    },
    messageImage: {
      width: 200,
      height: 150,
      borderRadius: 12,
      marginBottom: 8,
    },
    // Delta message (no bubble)
    deltaMessage: {
      marginBottom: 16,
      paddingRight: 16,
    },
    deltaHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    deltaLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginLeft: 6,
    },
    deltaContent: {
      paddingLeft: 4,
    },
    loadingContainer: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      alignItems: 'flex-start',
    },
    loadingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: theme.surface,
      borderRadius: 12,
    },
    loadingText: {
      marginLeft: 8,
      fontSize: 13,
      color: theme.textSecondary,
    },
    imagePreviewContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.surface,
      marginHorizontal: 12,
      marginBottom: 4,
      borderRadius: 12,
    },
    imagePreview: {
      width: 60,
      height: 60,
      borderRadius: 8,
    },
    removeImageButton: {
      marginLeft: 8,
      padding: 4,
    },
    inputContainer: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.background,
      alignItems: 'flex-end',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    imageButtonWrapper: {
      marginRight: 8,
    },
    imageButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    input: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.textPrimary,
      maxHeight: 100,
      marginRight: 8,
    },
    sendButton: {
      backgroundColor: theme.accent,
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    swipeArea: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 20,
      zIndex: 10,
    },
    // Sidebar styles - slides from left
    sidebarOverlay: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sidebarDismiss: {
      flex: 1,
    },
    sidebar: {
      width: SCREEN_WIDTH * 0.8,
      maxWidth: 320,
      backgroundColor: theme.background,
      paddingTop: topInset + 16,
      paddingHorizontal: 16,
      paddingBottom: 32,
      // Shadow for depth
      shadowColor: '#000',
      shadowOffset: { width: 2, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 10,
    },
    sidebarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    sidebarTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    newChatButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      padding: 12,
      borderRadius: 10,
      marginBottom: 16,
      gap: 8,
    },
    newChatText: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.accent,
    },
    conversationList: {
      flex: 1,
    },
    noConversations: {
      color: theme.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 20,
    },
    conversationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      marginBottom: 8,
      backgroundColor: theme.surface,
    },
    conversationItemActive: {
      backgroundColor: theme.accent + '20',
      borderColor: theme.accent,
      borderWidth: 1,
    },
    conversationContent: {
      flex: 1,
    },
    conversationTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.textPrimary,
      marginBottom: 4,
    },
    conversationTitleActive: {
      color: theme.accent,
    },
    conversationDate: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    deleteButton: {
      padding: 8,
    },
    sidebarHint: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 12,
    },
    // Rename Modal Styles
    renameModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    renameModalContent: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
      width: '100%',
      maxWidth: 340,
    },
    renameModalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 16,
      textAlign: 'center',
    },
    renameInput: {
      backgroundColor: theme.background,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 20,
    },
    renameModalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    renameModalCancel: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: theme.background,
      alignItems: 'center',
    },
    renameModalCancelText: {
      fontSize: 16,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    renameModalSave: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: theme.accent,
      alignItems: 'center',
    },
    renameModalSaveText: {
      fontSize: 16,
      color: '#fff',
      fontWeight: '600',
    },
  });
}
