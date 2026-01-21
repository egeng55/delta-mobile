/**
 * ChatScreen - Main Delta AI chat interface.
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInLeft, FadeInRight, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
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
}

export default function ChatScreen({ theme }: ChatScreenProps): React.ReactNode {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const sendButtonScale = useSharedValue(1);

  const sendButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
  }));

  const handleSendPressIn = (): void => {
    sendButtonScale.value = withSpring(0.9, springConfig);
  };

  const handleSendPressOut = (): void => {
    sendButtonScale.value = withSpring(1, springConfig);
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: "Hi! I'm Delta. How can I help you today?",
      isUser: false,
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const flatListRef = useRef<FlatList<Message>>(null);

  const sendMessage = async (): Promise<void> => {
    const trimmedText = inputText.trim();
    if (trimmedText.length === 0 || isLoading === true) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: trimmedText,
      isUser: true,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const userId = user?.id ?? 'anonymous';
      const response = await chatApi.sendMessage(userId, trimmedText);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
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

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Message"
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
          disabled={inputText.trim().length === 0 || isLoading === true}
        >
          <Animated.View
            style={[
              styles.sendButton,
              sendButtonAnimatedStyle,
              (inputText.trim().length === 0 || isLoading === true) && styles.sendButtonDisabled,
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
    loadingContainer: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      alignItems: 'flex-start',
    },
    inputContainer: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.background,
      alignItems: 'flex-end',
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
    sendButtonDisabled: {
      opacity: 0.4,
    },
  });
}
