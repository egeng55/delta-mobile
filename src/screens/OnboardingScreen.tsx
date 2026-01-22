/**
 * OnboardingScreen - First-time user experience.
 *
 * Shows feature slides explaining Delta's capabilities.
 * Displayed once on first app launch, stored in AsyncStorage.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
  ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../theme/colors';
import DeltaLogo from '../components/DeltaLogo';

const { width, height } = Dimensions.get('window');
const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

interface OnboardingScreenProps {
  theme: Theme;
  onComplete: () => void;
}

interface OnboardingSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    icon: 'triangle',
    title: 'Welcome to Delta',
    subtitle: 'Your personal health intelligence companion. Track, understand, and optimize your wellness journey.',
    color: '#6366F1',
  },
  {
    id: '2',
    icon: 'chatbubbles-outline',
    title: 'Chat Naturally',
    subtitle: 'Tell Delta about your day, meals, sleep, and workouts. Our AI understands context and remembers your history.',
    color: '#8B5CF6',
  },
  {
    id: '3',
    icon: 'analytics-outline',
    title: 'Discover Insights',
    subtitle: 'See trends, patterns, and personalized recommendations based on your health data over time.',
    color: '#06B6D4',
  },
  {
    id: '4',
    icon: 'barbell-outline',
    title: 'Smart Workouts',
    subtitle: 'Get AI-powered workout recommendations tailored to your goals, equipment, and fitness level.',
    color: '#10B981',
  },
  {
    id: '5',
    icon: 'calendar-outline',
    title: 'Track Everything',
    subtitle: 'From meals to menstrual cycles, Delta helps you log and understand all aspects of your health.',
    color: '#F59E0B',
  },
];

export default function OnboardingScreen({
  theme,
  onComplete,
}: OnboardingScreenProps): React.ReactNode {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleComplete = async (): Promise<void> => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    } catch {
      // Silent fail
    }
    onComplete();
  };

  const handleNext = (): void => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleComplete();
    }
  };

  const handleSkip = (): void => {
    handleComplete();
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }): React.ReactElement => {
    const inputRange = [
      (index - 1) * width,
      index * width,
      (index + 1) * width,
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.8, 1, 0.8],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.5, 1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <View style={[styles.slide, { width }]}>
        <Animated.View style={[styles.iconContainer, { transform: [{ scale }], opacity }]}>
          {index === 0 ? (
            <View style={[styles.logoCircle, { backgroundColor: item.color + '20' }]}>
              <DeltaLogo size={80} strokeColor={item.color} />
            </View>
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
              <Ionicons name={item.icon} size={64} color={item.color} />
            </View>
          )}
        </Animated.View>
        <Animated.View style={{ opacity }}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{item.title}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
        </Animated.View>
      </View>
    );
  };

  const renderPagination = (): React.ReactNode => {
    return (
      <View style={styles.paginationContainer}>
        {SLIDES.map((_, index) => {
          const inputRange = [
            (index - 1) * width,
            index * width,
            (index + 1) * width,
          ];

          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });

          const dotOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.4, 1, 0.4],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  opacity: dotOpacity,
                  backgroundColor: theme.accent,
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  const styles = createStyles(theme, insets.top, insets.bottom);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.background, theme.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Skip button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />

      {/* Bottom section */}
      <View style={styles.bottomSection}>
        {renderPagination()}

        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: theme.accent }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          {currentIndex < SLIDES.length - 1 && (
            <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.nextIcon} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Check if onboarding has been completed.
 */
export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Reset onboarding state (for testing).
 */
export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
  } catch {
    // Silent fail
  }
}

function createStyles(theme: Theme, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    skipButton: {
      position: 'absolute',
      top: topInset + 16,
      right: 20,
      zIndex: 10,
      padding: 8,
    },
    skipText: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    slide: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    iconContainer: {
      marginBottom: 48,
    },
    iconCircle: {
      width: 140,
      height: 140,
      borderRadius: 70,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoCircle: {
      width: 140,
      height: 140,
      borderRadius: 70,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 16,
    },
    subtitle: {
      fontSize: 17,
      textAlign: 'center',
      lineHeight: 26,
    },
    bottomSection: {
      paddingHorizontal: 24,
      paddingBottom: bottomInset + 32,
    },
    paginationContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 32,
    },
    dot: {
      height: 8,
      borderRadius: 4,
      marginHorizontal: 4,
    },
    nextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 18,
      borderRadius: 14,
    },
    nextButtonText: {
      fontSize: 17,
      fontWeight: '600',
      color: '#fff',
    },
    nextIcon: {
      marginLeft: 8,
    },
  });
}
