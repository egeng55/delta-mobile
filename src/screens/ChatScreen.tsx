/**
 * ChatScreen - Main Delta AI chat interface with image support.
 *
 * Features:
 * - Markdown rendering for Delta messages (no bubbles)
 * - User messages in bubbles
 * - Delta logo in header with spin on hold
 * - Rich formatting support (bold, headers, lists, tables)
 */

import React, { useState, useRef } from 'react';
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
import * as FileSystem from 'expo-file-system';
import Markdown from 'react-native-markdown-display';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { chatApi } from '../services/api';
import { DeltaLogoSimple } from '../components/DeltaLogo';

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
  const insets = useSafeAreaInsets();
  const sendButtonScale = useSharedValue(1);
  const imageButtonScale = useSharedValue(1);
  const logoRotation = useSharedValue(0);

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
  const flatListRef = useRef<FlatList<Message>>(null);

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

  const sendMessage = async (): Promise<void> => {
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

        const response = await chatApi.sendMessageWithImage(
          userId,
          hasText ? trimmedText : null,
          base64Image,
          clientTimezone,
          clientLocalTime
        );
        responseText = response.response;
      } else {
        responseText = await chatApi.sendMessage(userId, trimmedText);
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        isUser: false,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMessage]);
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

  // Markdown styles for Delta messages
  const markdownStyles = {
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
  };

  const renderMessage = ({ item }: { item: Message }): React.ReactElement => {
    const entering = item.isUser === true
      ? FadeInRight.duration(300).springify()
      : FadeInLeft.duration(300).springify();

    if (item.isUser === true) {
      // User message with bubble
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

    // Delta message - no bubble, markdown rendered
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
  };

  const styles = createStyles(theme, insets.top);
  const canSend = inputText.trim().length > 0 || selectedImage !== null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Pressable
          onPressIn={handleLogoPressIn}
          onPressOut={handleLogoPressOut}
          style={styles.logoButton}
        >
          <Animated.View style={logoAnimatedStyle}>
            <DeltaLogoSimple size={28} color={theme.accent} />
          </Animated.View>
        </Pressable>
        <Text style={styles.headerTitle}>DELTA</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messageList}
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
          style={styles.input}
          placeholder={selectedImage ? "Add a message (optional)" : "Message"}
          placeholderTextColor={theme.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline={true}
          maxLength={500}
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
    </KeyboardAvoidingView>
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
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.textPrimary,
      letterSpacing: 1,
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
  });
}
