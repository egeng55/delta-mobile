/**
 * PullDownDashboard - Premium health dashboard (Oura-inspired)
 *
 * Full-screen solid design with contextual health intelligence.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureUpdateEvent, PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../../theme/colors';
import { WeatherData } from '../../services/weather';
import AnimatedAvatar from '../Avatar/AnimatedAvatar';
import { UserAvatar, DEFAULT_AVATAR } from '../../types/avatar';
import DeltaLogo from '../DeltaLogo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import Avatar3DViewer from '../Avatar/Avatar3DViewer';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 85; // Bottom tab bar height including safe area
const DRAG_THRESHOLD = 120; // Less sensitive swipe

interface PullDownDashboardProps {
  theme: Theme;
  weatherData: WeatherData | null;
  isVisible: boolean;
  onClose: () => void;
  onVoiceChat?: () => void;
}

// Generate contextual health insight based on weather and time
function generateSmartInsight(weather: WeatherData | null): {
  message: string;
  gradient: [string, string];
} {
  const hour = new Date().getHours();

  if (weather) {
    if (weather.uvIndex >= 6) {
      return {
        message: `UV index is ${weather.uvIndex}. Apply SPF 30+ before heading outside today.`,
        gradient: ['#F59E0B', '#DC2626'],
      };
    }

    if (weather.temperature >= 85) {
      return {
        message: `It's ${weather.temperature}°F outside. Increase water intake by 25% and avoid midday exercise.`,
        gradient: ['#EF4444', '#F97316'],
      };
    }

    if (weather.temperature <= 40) {
      return {
        message: `Cold at ${weather.temperature}°F. Layer up and extend your warm-up before any outdoor activity.`,
        gradient: ['#3B82F6', '#06B6D4'],
      };
    }

    if (weather.humidity >= 80) {
      return {
        message: `High humidity at ${weather.humidity}%. Reduce workout intensity and hydrate frequently.`,
        gradient: ['#06B6D4', '#3B82F6'],
      };
    }

    if (weather.airQuality && weather.airQuality.aqi >= 4) {
      return {
        message: `Air quality is poor. Consider indoor exercise today to protect your respiratory health.`,
        gradient: ['#6B7280', '#374151'],
      };
    }

    if (weather.description.includes('rain')) {
      return {
        message: `Rain expected. Great day for indoor training or recovery stretching.`,
        gradient: ['#6366F1', '#8B5CF6'],
      };
    }

    if (weather.description.includes('clear') || weather.description.includes('sunny')) {
      return {
        message: `Clear skies and ${weather.temperature}°F. Ideal conditions for outdoor activity.`,
        gradient: ['#22C55E', '#10B981'],
      };
    }

    return {
      message: `${weather.temperature}°F and ${weather.description}. Stay hydrated and listen to your body.`,
      gradient: ['#6366F1', '#8B5CF6'],
    };
  }

  // Time-based fallbacks
  if (hour >= 5 && hour < 9) {
    return {
      message: `Morning cortisol peaks now. Ideal window for high-intensity training.`,
      gradient: ['#F59E0B', '#FBBF24'],
    };
  }

  if (hour >= 12 && hour < 14) {
    return {
      message: `Post-meal dip incoming. A 10-min walk aids digestion and maintains energy.`,
      gradient: ['#10B981', '#22C55E'],
    };
  }

  if (hour >= 21 || hour < 5) {
    return {
      message: `Wind down for sleep. Dim lights and avoid screens for optimal melatonin release.`,
      gradient: ['#6366F1', '#8B5CF6'],
    };
  }

  return {
    message: `Your body is ready. Make today count.`,
    gradient: ['#6366F1', '#8B5CF6'],
  };
}

// Compact live clock (left side)
function LiveClock({ theme }: { theme: Theme }): React.ReactElement {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  const formattedDate = time.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={staticStyles.clockContainer}>
      <Text style={[staticStyles.timeCompact, { color: theme.textPrimary }]}>
        {displayHours}:{minutes} <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{period}</Text>
      </Text>
      <Text style={[staticStyles.dateCompact, { color: theme.textSecondary }]}>
        {formattedDate}
      </Text>
    </View>
  );
}

// Compact weather (right side)
function WeatherCompact({
  weather,
  theme,
}: {
  weather: WeatherData | null;
  theme: Theme;
}): React.ReactElement | null {
  if (!weather) return null;

  const getWeatherIcon = (iconCode: string): string => {
    const iconMap: Record<string, string> = {
      '01d': 'sunny', '01n': 'moon',
      '02d': 'partly-sunny', '02n': 'cloudy-night',
      '03d': 'cloud', '03n': 'cloud',
      '04d': 'cloudy', '04n': 'cloudy',
      '09d': 'rainy', '09n': 'rainy',
      '10d': 'rainy', '10n': 'rainy',
      '11d': 'thunderstorm', '11n': 'thunderstorm',
      '13d': 'snow', '13n': 'snow',
      '50d': 'water', '50n': 'water',
    };
    return iconMap[iconCode] || 'cloud';
  };

  return (
    <View style={staticStyles.weatherCompact}>
      <View style={staticStyles.weatherRow}>
        <Ionicons
          name={getWeatherIcon(weather.icon) as any}
          size={16}
          color={theme.accent}
        />
        <Text style={[staticStyles.weatherTempCompact, { color: theme.textPrimary }]}>
          {weather.temperature}°
        </Text>
      </View>
      <Text style={[staticStyles.weatherDetailCompact, { color: theme.textSecondary }]}>
        {weather.humidity}% · UV {weather.uvIndex}
      </Text>
    </View>
  );
}

// Smart insight row: Delta icon | Message | Voice button
function InsightRow({
  weather,
  theme,
  onVoiceChat,
}: {
  weather: WeatherData | null;
  theme: Theme;
  onVoiceChat?: () => void;
}): React.ReactElement {
  const insight = generateSmartInsight(weather);

  return (
    <View style={staticStyles.insightRow}>
      {/* Delta logo - plain triangle, no background */}
      <DeltaLogo size={36} strokeColor={theme.textPrimary} />

      {/* Message in the middle */}
      <View style={[staticStyles.insightBubble, { backgroundColor: theme.surface }]}>
        <Text style={[staticStyles.insightMessage, { color: theme.textPrimary }]}>
          {insight.message}
        </Text>
      </View>

      {/* Voice button on the right */}
      <Pressable
        onPress={onVoiceChat}
        style={({ pressed }) => [
          staticStyles.voiceButton,
          { backgroundColor: theme.accent },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Ionicons name="mic" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

export default function PullDownDashboard({
  theme,
  weatherData,
  isVisible,
  onClose,
  onVoiceChat,
}: PullDownDashboardProps): React.ReactElement | null {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [avatar, setAvatar] = useState<UserAvatar>(DEFAULT_AVATAR);
  const dashboardHeight = SCREEN_HEIGHT - TAB_BAR_HEIGHT;
  const translateY = useSharedValue(-dashboardHeight);

  // Reload avatar when dashboard becomes visible or user changes
  useEffect(() => {
    const loadAvatar = async (): Promise<void> => {
      try {
        const saved = await AsyncStorage.getItem(`@delta_avatar_${user?.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log('[Dashboard] Loaded avatar:', {
            hasRpmUrl: !!parsed.rpmAvatarUrl,
            hasMeshUri: !!parsed.meshFileUri,
            scanMethod: parsed.scanMethod,
          });
          setAvatar(parsed);
        }
      } catch { /* Use default */ }
    };
    if (isVisible && user?.id) {
      loadAvatar();
    }
  }, [user?.id, isVisible]);

  useEffect(() => {
    translateY.value = withTiming(isVisible ? 0 : -dashboardHeight, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [isVisible, dashboardHeight]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleClose = (): void => {
    onClose();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      if (event.translationY < 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event: { translationY: number; velocityY: number }) => {
      if (event.translationY < -DRAG_THRESHOLD || event.velocityY < -800) {
        translateY.value = withTiming(-dashboardHeight, {
          duration: 250,
          easing: Easing.in(Easing.cubic),
        });
        runOnJS(handleClose)();
      } else {
        translateY.value = withTiming(0, {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        });
      }
    });

  const dynamicStyles = useMemo(() => createStyles(theme, insets, dashboardHeight), [theme, insets, dashboardHeight]);

  if (!isVisible && translateY.value <= -dashboardHeight + 10) {
    return null;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[dynamicStyles.container, animatedStyle]}>
        {/* Solid background */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]} />

        {/* Drag handle */}
        <View style={staticStyles.handleContainer}>
          <View style={[staticStyles.handle, { backgroundColor: theme.border }]} />
        </View>

        {/* Content - no scroll */}
        <View style={staticStyles.content}>
          {/* Top row: Clock left, Weather right */}
          <View style={staticStyles.topRow}>
            <LiveClock theme={theme} />
            <WeatherCompact weather={weatherData} theme={theme} />
          </View>

          {/* Avatar - main focus */}
          <View style={staticStyles.avatarContainer}>
            <View style={staticStyles.avatarGlow}>
              <LinearGradient
                colors={[theme.accent + '25', 'transparent']}
                style={staticStyles.avatarGlowGradient}
              />
            </View>
            {/* Show 3D model if available (RPM or LiDAR), otherwise show 2D animated avatar */}
            {avatar.rpmAvatarUrl ? (
              <Avatar3DViewer
                modelUrl={avatar.rpmAvatarUrl}
                theme={theme}
                size={280}
                autoRotate={true}
                backgroundColor="transparent"
              />
            ) : avatar.meshFileUri ? (
              <Avatar3DViewer
                modelUrl={avatar.meshFileUri}
                theme={theme}
                size={280}
                autoRotate={true}
                backgroundColor="transparent"
              />
            ) : (
              <AnimatedAvatar
                templateId={avatar.templateId}
                style={avatar.style}
                skinTone={avatar.skinTone}
                size={280}
                showGlow
                spinning
                spinDuration={10000}
              />
            )}
          </View>
        </View>

        {/* Bottom section - Delta icon, message, voice button in one row */}
        <View style={[staticStyles.bottomSection, { paddingBottom: 16 }]}>
          <InsightRow weather={weatherData} theme={theme} onVoiceChat={onVoiceChat} />

          {/* Swipe hint */}
          <View style={staticStyles.hintContainer}>
            <Ionicons name="chevron-up" size={18} color={theme.textSecondary + '40'} />
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function createStyles(theme: Theme, insets: { top: number; bottom: number }, dashboardHeight: number) {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: dashboardHeight,
      paddingTop: insets.top,
      zIndex: 100,
    },
  });
}

const staticStyles = StyleSheet.create({
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  clockContainer: {
    alignItems: 'flex-start',
  },
  timeCompact: {
    fontSize: 24,
    fontWeight: '300',
  },
  dateCompact: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  weatherCompact: {
    alignItems: 'flex-end',
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weatherTempCompact: {
    fontSize: 20,
    fontWeight: '300',
  },
  weatherDetailCompact: {
    fontSize: 11,
    marginTop: 2,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 280,
  },
  avatarGlow: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    overflow: 'hidden',
  },
  avatarGlowGradient: {
    flex: 1,
    borderRadius: 170,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  insightIconWrapper: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightGlow: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  insightGlowGradient: {
    flex: 1,
  },
  insightBubble: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
  },
  insightMessage: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  bottomSection: {
    paddingHorizontal: 24,
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
