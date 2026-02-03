/**
 * ChatBottomSheet — Bottom sheet chat with 3 states: hidden, peek, full.
 *
 * Migrated from ChatScreen.tsx. Contains all chat logic:
 * messages, conversations, voice, image, markdown+viz rendering.
 *
 * Rendered at navigator level as a sibling to Tab.Navigator.
 */

import React, { useState, useRef, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
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
  Keyboard,
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
  withRepeat,
  withSequence,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
// BlurView removed — not supported in Expo Go
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Markdown from 'react-native-markdown-display';
import { Theme } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { useAccess } from '../../context/AccessContext';
import { useUnits } from '../../context/UnitsContext';
import { chatApi, conversationsApi, healthIntelligenceApi, AgentAction } from '../../services/api';
import { DeltaLogoSimple, PullTabHandle } from '../DeltaLogo';
import VizRenderer, { parseDeltaVizBlocks } from '../viz/VizRenderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInsightsData } from '../../hooks/useInsightsData';
import { getWeather, formatWeatherForContext, WeatherData } from '../../services/weather';
import VoiceChatModal from './VoiceChatModal';
import { ProactiveCardsList } from '../ProactiveCard';
import { useDeltaUI } from '../../context/DeltaUIContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const springConfig = {
  damping: 20,
  stiffness: 200,
  mass: 0.5,
};

type SheetState = 'hidden' | 'peek' | 'full';

const TAB_BAR_HEIGHT = 90;
const PULL_TAB_HEIGHT = 24; // shorter, wider solid triangle
const PEEK_HEIGHT = 56; // Just the input bar
const FULL_OFFSET = SCREEN_HEIGHT * 0.05; // 95% of screen = 5% from top

// Sheet positions (from top of screen)
// Hidden: pull tab sits directly above tab bar, triangle bottom edge touches tab bar top
const HIDDEN_Y = SCREEN_HEIGHT - TAB_BAR_HEIGHT - PULL_TAB_HEIGHT;
const PEEK_Y = SCREEN_HEIGHT - TAB_BAR_HEIGHT - PEEK_HEIGHT - PULL_TAB_HEIGHT;
const FULL_Y = FULL_OFFSET;

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

export interface ChatBottomSheetRef {
  openPeek: () => void;
  openFull: (prefill?: string) => void;
  close: () => void;
}

// NOTE: Conversation storage in AsyncStorage is unbounded. Consider pruning
// old conversations (e.g., keep only the most recent 50) to prevent storage bloat.
const CONVERSATIONS_STORAGE_KEY = '@delta_conversations';
const CURRENT_CONVERSATION_KEY = '@delta_current_conversation';

const WELCOME_MESSAGE = `**Welcome to Delta!**

I'm your personal health intelligence assistant. Tell me about your meals, workouts, sleep, or ask me anything about your health.

Try:
- "I had a chicken salad for lunch"
- "Went for a 30 minute run"
- "How did I sleep this week?"`;

interface ChatBottomSheetProps {
  theme: Theme;
}

const ChatBottomSheet = forwardRef<ChatBottomSheetRef, ChatBottomSheetProps>(
  ({ theme }, ref) => {
    const { user } = useAuth();
    const { profile } = useAccess();
    const { unitSystem } = useUnits();
    const { invalidateCache } = useInsightsData();
    const insets = useSafeAreaInsets();
    const { setChatSheetState: setDeltaUIChatState } = useDeltaUI();

    const translateY = useSharedValue(HIDDEN_Y);
    const [sheetState, setSheetState] = useState<SheetState>('hidden');
    const [contentVisible, setContentVisible] = useState(false);

    // Ensure translateY is synced on mount (fixes hot reload desync)
    useEffect(() => {
      translateY.value = HIDDEN_Y;
    }, []);

    // Breathing animation for pull-tab in hidden state
    const breatheOpacity = useSharedValue(1);
    useEffect(() => {
      breatheOpacity.value = withRepeat(
        withSequence(
          withTiming(0.95, { duration: 2000 }),
          withTiming(1.0, { duration: 2000 }),
        ),
        -1,
        false,
      );
    }, [breatheOpacity]);

    const pullTabAnimStyle = useAnimatedStyle(() => ({
      opacity: breatheOpacity.value,
    }));
    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [proactiveActions, setProactiveActions] = useState<AgentAction[]>([]);

    const [messages, setMessages] = useState<Message[]>([
      { id: 'welcome', text: WELCOME_MESSAGE, isUser: false, timestamp: Date.now() },
    ]);
    const [inputText, setInputText] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [conversations, setConversations] = useState<SavedConversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const flatListRef = useRef<FlatList<Message>>(null);
    const inputRef = useRef<TextInput>(null);

    // Guard: prevent onFocus auto-expand right after a state transition
    const lastTransition = useRef(0);

    // Animate to a state
    const animateTo = useCallback((state: SheetState) => {
      const target = state === 'hidden' ? HIDDEN_Y : state === 'peek' ? PEEK_Y : FULL_Y;
      translateY.value = withSpring(target, springConfig);
      setSheetState(state);
      setContentVisible(state !== 'hidden');
      setDeltaUIChatState(state);
      lastTransition.current = Date.now();
      if (state === 'hidden') {
        Keyboard.dismiss();
      }
      if (state === 'full') {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
          inputRef.current?.focus();
        }, 150);
      }
    }, [translateY, setDeltaUIChatState]);

    useImperativeHandle(ref, () => ({
      openPeek: () => animateTo('peek'),
      openFull: (prefill?: string) => {
        if (prefill) setInputText(prefill);
        animateTo('full');
        setTimeout(() => inputRef.current?.focus(), 450);
      },
      close: () => animateTo('hidden'),
    }));

    // Load weather + refresh every 30 minutes
    useEffect(() => {
      const fetchWeather = () => getWeather().then(w => w && setWeatherData(w)).catch(() => {});
      fetchWeather();
      const interval = setInterval(fetchWeather, 30 * 60 * 1000);
      return () => clearInterval(interval);
    }, []);

    // Load conversations
    useEffect(() => {
      loadConversations();
    }, [user?.id]);

    // Fetch proactive actions
    useEffect(() => {
      if (!user?.id) return;
      healthIntelligenceApi.getAgentActions(user.id)
        .then(r => setProactiveActions(r.actions))
        .catch(() => {});
    }, [user?.id]);

    // Auto-save
    useEffect(() => {
      if (messages.length > 1) saveCurrentConversation();
    }, [messages]);

    // Track keyboard height for FlatList bottom padding
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    useEffect(() => {
      const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
      });
      const hideSub = Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardHeight(0);
      });
      return () => { showSub.remove(); hideSub.remove(); };
    }, []);

    // Pan gesture for dragging sheet
    const panGesture = useMemo(() => {
      let startY = 0;
      return Gesture.Pan()
        .onStart(() => {
          startY = translateY.value;
          runOnJS(setContentVisible)(true);
        })
        .onUpdate((e) => {
          const newY = startY + e.translationY;
          translateY.value = Math.max(FULL_Y, Math.min(HIDDEN_Y, newY));
        })
        .onEnd((e) => {
          const currentY = translateY.value;
          const velocity = e.velocityY;

          // Snap to hidden or full based on velocity and position
          const midpoint = (HIDDEN_Y + FULL_Y) / 2;
          if (velocity > 500) {
            runOnJS(animateTo)('hidden');
          } else if (velocity < -500) {
            runOnJS(animateTo)('full');
          } else {
            // Snap to nearest
            if (currentY < midpoint) runOnJS(animateTo)('full');
            else runOnJS(animateTo)('hidden');
          }
        });
    }, [translateY, animateTo]);

    const sheetStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
    }));

    // Blur intensity: 0 at HIDDEN_Y, max at FULL_Y
    const blurOpacity = useAnimatedStyle(() => ({
      opacity: interpolate(
        translateY.value,
        [FULL_Y, PEEK_Y, HIDDEN_Y],
        [1, 0.5, 0],
        'clamp',
      ),
    }));

    // ---- Chat logic (migrated from ChatScreen) ----

    const loadConversations = async () => {
      try {
        const saved = await AsyncStorage.getItem(`${CONVERSATIONS_STORAGE_KEY}_${user?.id}`);
        if (saved) {
          let parsed: SavedConversation[];
          try { parsed = JSON.parse(saved) as SavedConversation[]; } catch { parsed = []; }
          setConversations(parsed.sort((a, b) => b.updatedAt - a.updatedAt));
        }
        const currentId = await AsyncStorage.getItem(`${CURRENT_CONVERSATION_KEY}_${user?.id}`);
        if (currentId && saved) {
          setCurrentConversationId(currentId);
          let allConvs: SavedConversation[];
          try { allConvs = JSON.parse(saved) as SavedConversation[]; } catch { allConvs = []; }
          const conv = allConvs.find((c: SavedConversation) => c.id === currentId);
          if (conv) setMessages(conv.messages);
        }
      } catch {}
    };

    const saveCurrentConversation = async () => {
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

        let title: string;
        if (existingIndex >= 0 && updatedConversations[existingIndex].title) {
          title = updatedConversations[existingIndex].title;
        } else {
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

        if (existingIndex >= 0) updatedConversations[existingIndex] = conversation;
        else updatedConversations.unshift(conversation);

        setConversations(updatedConversations.sort((a, b) => b.updatedAt - a.updatedAt));
        await AsyncStorage.setItem(
          `${CONVERSATIONS_STORAGE_KEY}_${user?.id}`,
          JSON.stringify(updatedConversations)
        );
        if (user?.id && convId) {
          conversationsApi.create(user.id, convId, title).catch(() => {});
        }
      } catch {}
    };

    const startNewConversation = async () => {
      setMessages([{ id: 'welcome', text: WELCOME_MESSAGE, isUser: false, timestamp: Date.now() }]);
      setCurrentConversationId(null);
      await AsyncStorage.removeItem(`${CURRENT_CONVERSATION_KEY}_${user?.id}`);
      setShowSidebar(false);
    };

    const loadConversation = (conv: SavedConversation) => {
      setMessages(conv.messages);
      setCurrentConversationId(conv.id);
      AsyncStorage.setItem(`${CURRENT_CONVERSATION_KEY}_${user?.id}`, conv.id);
      setShowSidebar(false);
    };

    const deleteConversation = async (convId: string) => {
      const updated = conversations.filter(c => c.id !== convId);
      setConversations(updated);
      await AsyncStorage.setItem(`${CONVERSATIONS_STORAGE_KEY}_${user?.id}`, JSON.stringify(updated));
      if (user?.id) conversationsApi.delete(user.id, convId).catch(() => {});
      if (convId === currentConversationId) startNewConversation();
    };

    const pickImage = async (useCamera: boolean) => {
      try {
        if (useCamera) {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission Required', 'Please allow camera access.'); return; }
        } else {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission Required', 'Please allow photo library access.'); return; }
        }
        const result = useCamera
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 });
        if (!result.canceled && result.assets?.length) setSelectedImage(result.assets[0].uri);
      } catch { Alert.alert('Error', 'Could not access images.'); }
    };

    const showImageOptions = () => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
          (i) => { if (i === 1) pickImage(true); else if (i === 2) pickImage(false); }
        );
      } else {
        Alert.alert('Add Photo', 'How would you like to add a photo?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => pickImage(true) },
          { text: 'Choose from Library', onPress: () => pickImage(false) },
        ]);
      }
    };

    const handleActionPress = (action: AgentAction) => {
      if (action.action_type === 'chat') setInputText(action.action_label || 'Tell me more');
      else if (action.action_type === 'log') setInputText(action.action_label || '');
      setProactiveActions(prev => prev.filter(a => a.id !== action.id));
      animateTo('full');
    };

    const handleVoiceSend = async (text: string) => {
      if (!text.trim() || isLoading) return;
      const userMessage: Message = { id: crypto.randomUUID(), text: text.trim(), isUser: true, timestamp: Date.now() };
      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);
      try {
        const userId = user?.id ?? 'anonymous';
        const weatherContext = weatherData ? formatWeatherForContext(weatherData) : undefined;
        const responseText = await chatApi.sendMessage(userId, text.trim(), unitSystem, weatherContext);
        setMessages(prev => [...prev, { id: crypto.randomUUID(), text: responseText, isUser: false, timestamp: Date.now() }]);
        invalidateCache('analytics', true);
        invalidateCache('workout', true);
      } catch {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), text: "I'm having trouble connecting. Please try again.", isUser: false, timestamp: Date.now() }]);
      } finally { setIsLoading(false); }
    };

    const sendMessage = async () => {
      inputRef.current?.blur();
      await new Promise(resolve => setTimeout(resolve, 10));
      const trimmedText = inputText.trim();
      const hasText = trimmedText.length > 0;
      const hasImage = selectedImage !== null;
      if (!hasText && !hasImage || isLoading) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
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
          const base64Image = await FileSystem.readAsStringAsync(imageToSend, { encoding: 'base64' });
          const weatherContext = weatherData ? formatWeatherForContext(weatherData) : undefined;
          const response = await chatApi.sendMessageWithImage(
            userId, hasText ? trimmedText : null, base64Image,
            Intl.DateTimeFormat().resolvedOptions().timeZone,
            new Date().toISOString(), unitSystem, weatherContext
          );
          responseText = response.response;
        } else {
          const weatherContext = weatherData ? formatWeatherForContext(weatherData) : undefined;
          responseText = await chatApi.sendMessage(userId, trimmedText, unitSystem, weatherContext);
        }
        setMessages(prev => [...prev, { id: crypto.randomUUID(), text: responseText, isUser: false, timestamp: Date.now() }]);
        invalidateCache('analytics', true);
        invalidateCache('workout', true);
      } catch {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), text: "I'm having trouble connecting. Please try again.", isUser: false, timestamp: Date.now() }]);
      } finally { setIsLoading(false); }
    };

    const markdownStyles = useMemo(() => ({
      body: { color: theme.textPrimary, fontSize: 15, lineHeight: 22 },
      heading1: { color: theme.textPrimary, fontSize: 22, fontWeight: '700' as const, marginBottom: 8, marginTop: 12 },
      heading2: { color: theme.textPrimary, fontSize: 18, fontWeight: '600' as const, marginBottom: 6, marginTop: 10 },
      heading3: { color: theme.textPrimary, fontSize: 16, fontWeight: '600' as const, marginBottom: 4, marginTop: 8 },
      strong: { color: theme.textPrimary, fontWeight: '600' as const },
      em: { color: theme.textSecondary, fontStyle: 'italic' as const },
      paragraph: { marginBottom: 8, marginTop: 0 },
      bullet_list: { marginBottom: 8 },
      bullet_list_icon: { color: theme.accent, fontSize: 8, marginRight: 8 },
      list_item: { marginBottom: 4, flexDirection: 'row' as const },
      code_inline: { backgroundColor: theme.surface, color: theme.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 14 },
      fence: { backgroundColor: theme.surface, padding: 12, borderRadius: 8, marginVertical: 8 },
      table: { borderWidth: 1, borderColor: theme.border, borderRadius: 8, marginVertical: 8 },
      thead: { backgroundColor: theme.surface },
      th: { padding: 8, fontWeight: '600' as const },
      td: { padding: 8, borderTopWidth: 1, borderColor: theme.border },
      blockquote: { backgroundColor: theme.surface, borderLeftWidth: 3, borderLeftColor: theme.accent, paddingLeft: 12, paddingVertical: 8, marginVertical: 8 },
      link: { color: theme.accent },
    }), [theme]);

    const keyExtractor = useCallback((item: Message) => item.id, []);
    const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

    const renderMessage = useCallback(({ item }: { item: Message }) => {
      const entering = item.isUser ? FadeInRight.duration(300).springify() : FadeInLeft.duration(300).springify();

      if (item.isUser) {
        return (
          <Animated.View entering={entering} style={[styles.userBubble]}>
            {item.imageUri && <Image source={{ uri: item.imageUri }} style={styles.messageImage} resizeMode="cover" />}
            <Text style={styles.userText}>{item.text}</Text>
          </Animated.View>
        );
      }

      const segments = parseDeltaVizBlocks(item.text);
      const hasViz = segments.some(s => s.type === 'viz');

      return (
        <Animated.View entering={entering} style={styles.deltaMessage}>
          <View style={styles.deltaContent}>
            {hasViz
              ? segments.map((seg, idx) =>
                  seg.type === 'text'
                    ? seg.content.trim() ? <Markdown key={idx} style={markdownStyles}>{seg.content}</Markdown> : null
                    : <VizRenderer key={idx} json={seg.json} />
                )
              : <Markdown style={markdownStyles}>{item.text}</Markdown>
            }
          </View>
        </Animated.View>
      );
    }, [styles, theme.accent, markdownStyles]);

    const canSend = inputText.trim().length > 0 || selectedImage !== null;

    // Pull tab is drag-only — no tap handler

    return (
      <>
        {/* Dark overlay — opacity driven continuously by translateY, stops above tab bar */}
        <Animated.View
          style={[StyleSheet.absoluteFill, blurOpacity, { zIndex: 50, backgroundColor: 'rgba(0,0,0,0.6)', bottom: TAB_BAR_HEIGHT }]}
          pointerEvents={contentVisible ? 'auto' : 'none'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => animateTo('hidden')} />
        </Animated.View>

        {/* Pull-tab + sheet — above blur */}
        <Animated.View
          style={[styles.sheetContainer, sheetStyle]}
          pointerEvents="box-none"
        >
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.pullTabWrapper, sheetState === 'hidden' ? pullTabAnimStyle : undefined]}>
              <PullTabHandle width={48} height={14} color={theme.mode === 'dark' ? '#4F46E5' : '#4338CA'} />
            </Animated.View>
          </GestureDetector>

          {/* Sheet content — only rendered when visible or dragging */}
          {contentVisible && <View style={[styles.sheetContent, { maxHeight: SCREEN_HEIGHT - FULL_OFFSET - PULL_TAB_HEIGHT - TAB_BAR_HEIGHT }]}>
            {/* Sidebar toggle + new chat */}
            {sheetState === 'full' && (
              <View style={styles.chatHeader}>
                <Pressable onPress={() => setShowSidebar(true)} style={styles.chatHeaderButton}>
                  <Ionicons name="menu-outline" size={22} color={theme.textPrimary} />
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable onPress={startNewConversation} style={styles.chatHeaderButton}>
                  <Ionicons name="add-outline" size={22} color={theme.textPrimary} />
                </Pressable>
              </View>
            )}

            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={keyExtractor}
              contentContainerStyle={styles.messageList}
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={10}
              initialNumToRender={15}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />

            {/* Proactive cards */}
            <ProactiveCardsList
              theme={theme}
              actions={proactiveActions}
              onActionPress={handleActionPress}
              onDismiss={(id) => setProactiveActions(prev => prev.filter(a => a.id !== id))}
            />

            {isLoading && (
              <View style={styles.loadingContainer}>
                <View style={styles.loadingIndicator}>
                  <DeltaLogoSimple size={16} color={theme.accent} />
                  <Text style={styles.loadingText}>Delta is thinking...</Text>
                </View>
              </View>
            )}

            {/* Image preview */}
            {selectedImage && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                <Pressable onPress={() => setSelectedImage(null)}>
                  <Ionicons name="close-circle" size={24} color={theme.textPrimary} />
                </Pressable>
              </View>
            )}

            {/* Input bar */}
            <View style={[styles.inputContainer, keyboardHeight > 0 && { paddingBottom: keyboardHeight - TAB_BAR_HEIGHT + 4 }]}>
              {sheetState === 'full' && (
                <Pressable onPress={showImageOptions} disabled={isLoading}>
                  <View style={[styles.iconButton, isLoading && { opacity: 0.4 }]}>
                    <Ionicons name="camera-outline" size={22} color={theme.accent} />
                  </View>
                </Pressable>
              )}

              {sheetState === 'full' && (
                <Pressable onPress={() => setShowVoiceModal(true)} disabled={isLoading}>
                  <View style={[styles.iconButton, isLoading && { opacity: 0.4 }]}>
                    <Ionicons name="mic-outline" size={22} color={theme.accent} />
                  </View>
                </Pressable>
              )}

              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Message Delta..."
                placeholderTextColor={theme.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                multiline={sheetState === 'full'}
                maxLength={10000}
                editable={!isLoading}
                returnKeyType="send"
                onSubmitEditing={sendMessage}
                onFocus={() => {
                  if (sheetState !== 'full' && Date.now() - lastTransition.current > 500) {
                    animateTo('full');
                  }
                }}
              />

              {sheetState === 'full' && (
                <Pressable onPress={sendMessage} disabled={!canSend || isLoading}>
                  <View style={[styles.sendButton, (!canSend || isLoading) && { opacity: 0.4 }]}>
                    <Ionicons name="arrow-up" size={20} color="#ffffff" />
                  </View>
                </Pressable>
              )}
            </View>
          </View>}
        </Animated.View>

        {/* Sidebar Modal */}
        <Modal visible={showSidebar} animationType="none" transparent onRequestClose={() => setShowSidebar(false)}>
          <View style={styles.sidebarOverlay}>
            <Animated.View entering={FadeInLeft.duration(250)} style={styles.sidebar}>
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
                {conversations.map(conv => (
                  <TouchableOpacity
                    key={conv.id}
                    style={[styles.conversationItem, conv.id === currentConversationId && styles.conversationItemActive]}
                    onPress={() => loadConversation(conv)}
                    onLongPress={() => {
                      Alert.alert(conv.title, 'Delete this conversation?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteConversation(conv.id) },
                      ]);
                    }}
                    delayLongPress={300}
                  >
                    <Text style={styles.conversationTitle} numberOfLines={1}>{conv.title}</Text>
                    <Text style={styles.conversationDate}>{new Date(conv.updatedAt).toLocaleDateString()}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
            <Pressable style={{ flex: 1 }} onPress={() => setShowSidebar(false)} />
          </View>
        </Modal>

        {/* Voice */}
        <VoiceChatModal
          visible={showVoiceModal}
          theme={theme}
          onClose={() => setShowVoiceModal(false)}
          onSend={handleVoiceSend}
        />
      </>
    );
  }
);

ChatBottomSheet.displayName = 'ChatBottomSheet';
export default ChatBottomSheet;

function createStyles(theme: Theme, insets: { top: number; bottom: number }) {
  return StyleSheet.create({
    sheetContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: SCREEN_HEIGHT,
      backgroundColor: 'transparent',
      zIndex: 100,
    },
    pullTabWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      height: PULL_TAB_HEIGHT,
      paddingTop: 6,
    },
    sheetContent: {
      flex: 1,
      overflow: 'hidden',
      backgroundColor: theme.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderTopWidth: 1.5,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: theme.accent + '25',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 20,
    },
    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    chatHeaderButton: {
      padding: 4,
    },
    chatHeaderTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.textPrimary,
      letterSpacing: 1,
    },
    messageList: {
      padding: 16,
      paddingBottom: 8,
    },
    userBubble: {
      maxWidth: '80%',
      padding: 12,
      borderRadius: 18,
      marginBottom: 12,
      backgroundColor: theme.accent,
      alignSelf: 'flex-end',
    },
    userText: {
      fontSize: 15,
      lineHeight: 20,
      color: '#ffffff',
    },
    messageImage: {
      width: 200,
      height: 150,
      borderRadius: 12,
      marginBottom: 8,
    },
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
      gap: 8,
    },
    imagePreview: {
      width: 60,
      height: 60,
      borderRadius: 8,
    },
    inputContainer: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingTop: 6,
      paddingBottom: 4,
      backgroundColor: theme.background,
      alignItems: 'flex-end',
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: 6,
    },
    iconButton: {
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
    },
    sendButton: {
      backgroundColor: theme.accent,
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sidebarOverlay: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sidebar: {
      width: SCREEN_WIDTH * 0.8,
      maxWidth: 320,
      backgroundColor: theme.background,
      paddingTop: insets.top + 16,
      paddingHorizontal: 16,
      paddingBottom: 32,
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
    conversationItem: {
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
    conversationTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.textPrimary,
      marginBottom: 4,
    },
    conversationDate: {
      fontSize: 12,
      color: theme.textSecondary,
    },
  });
}
