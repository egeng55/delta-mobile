/**
 * ChatScreen - Main Delta AI chat interface with image support.
 *
 * Images are treated as contextual signals for meal understanding.
 * Vision extracts qualitative characteristics, not numeric values.
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInLeft, FadeInRight, FadeIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { chatApi } from '../services/api';

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
  imageUri?: string;  // For displaying images in chat
}

export default function ChatScreen({ theme }: ChatScreenProps): React.ReactNode {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const sendButtonScale = useSharedValue(1);
  const imageButtonScale = useSharedValue(1);

  const sendButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
  }));

  const imageButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: imageButtonScale.value }],
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

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: "Hi! I'm Delta. How can I help you today? You can also share food photos and I'll help you understand what you're eating.",
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
      // Request permissions
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
    } catch (error) {
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
      // Android: use Alert
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

    // Create user message with optional image
    const userMessage: Message = {
      id: Date.now().toString(),
      text: hasText ? trimmedText : '📷 Shared a photo',
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
        // Convert image to base64
        const base64Image = await FileSystem.readAsStringAsync(imageToSend, {
          encoding: 'base64',
        });

        // Get timezone info
        const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const clientLocalTime = new Date().toISOString();

        // Send with image
        const response = await chatApi.sendMessageWithImage(
          userId,
          hasText ? trimmedText : null,
          base64Image,
          clientTimezone,
          clientLocalTime
        );
        responseText = response.response;
      } else {
        // Text only
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

  const renderMessage = ({ item }: { item: Message }): React.ReactElement => {
    const entering = item.isUser === true
      ? FadeInRight.duration(300).springify()
      : FadeInLeft.duration(300).springify();

    return (
      <Animated.View
        entering={entering}
        style={[
          styles.messageBubble,
          item.isUser === true ? styles.userBubble : styles.aiBubble,
        ]}
      >
        {item.imageUri && (
          <Image
            source={{ uri: item.imageUri }}
            style={styles.messageImage}
            resizeMode="cover"
          />
        )}
        <Text
          style={[
            styles.messageText,
            item.isUser === true ? styles.userText : styles.aiText,
          ]}
        >
          {item.text}
        </Text>
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
          <ActivityIndicator size="small" color={theme.accent} />
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
      paddingHorizontal: 16,
      paddingTop: topInset + 8,
      paddingBottom: 8,
      backgroundColor: theme.background + 'F0',
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
    messageBubble: {
      maxWidth: '80%',
      padding: 12,
      borderRadius: 18,
      marginBottom: 6,
    },
    userBubble: {
      backgroundColor: theme.accent,
      alignSelf: 'flex-end',
    },
    aiBubble: {
      backgroundColor: theme.surface,
      alignSelf: 'flex-start',
    },
    messageText: {
      fontSize: 15,
      lineHeight: 20,
    },
    userText: {
      color: '#ffffff',
    },
    aiText: {
      color: theme.textPrimary,
    },
    messageImage: {
      width: 200,
      height: 150,
      borderRadius: 12,
      marginBottom: 8,
    },
    loadingContainer: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      alignItems: 'flex-start',
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
