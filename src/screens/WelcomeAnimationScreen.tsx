/**
 * WelcomeAnimationScreen - Shows once after login with spinning logo and sliding background.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DeltaLogo from '../components/DeltaLogo';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { prefetchAppData } from '../services/prefetch';

const { width, height } = Dimensions.get('window');

interface WelcomeAnimationScreenProps {
  theme: Theme;
  onComplete: () => void;
}

export default function WelcomeAnimationScreen({
  theme,
  onComplete,
}: WelcomeAnimationScreenProps): React.ReactNode {
  const { user } = useAuth();
  const spinValue = useRef(new Animated.Value(0)).current;
  const slideValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;

  // Start prefetching data immediately while animation plays
  useEffect(() => {
    if (user?.id) {
      prefetchAppData(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    // Start animations
    Animated.parallel([
      // Logo spin animation (2 full rotations)
      Animated.timing(spinValue, {
        toValue: 2,
        duration: 2000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Logo scale up
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      // Background slide
      Animated.timing(slideValue, {
        toValue: 1,
        duration: 2500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // Fade out and complete after animation
    const timer = setTimeout(() => {
      Animated.timing(fadeValue, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        onComplete();
      });
    }, 2200);

    return () => clearTimeout(timer);
  }, [spinValue, slideValue, fadeValue, logoScale, onComplete]);

  const spin = spinValue.interpolate({
    inputRange: [0, 2],
    outputRange: ['0deg', '720deg'],
  });

  const backgroundTranslate = slideValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, 0],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeValue }]}>
      {/* Sliding gradient background */}
      <Animated.View
        style={[
          styles.backgroundSlide,
          { transform: [{ translateX: backgroundTranslate }] },
        ]}
      >
        <LinearGradient
          colors={[theme.accent, '#4F46E5', '#7C3AED', theme.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
      </Animated.View>

      {/* Base background */}
      <View style={[styles.baseBackground, { backgroundColor: theme.background }]} />

      {/* Spinning logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [
              { rotate: spin },
              { scale: logoScale },
            ],
          },
        ]}
      >
        <DeltaLogo size={180} strokeColor="#ffffff" />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  baseBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundSlide: {
    ...StyleSheet.absoluteFillObject,
    width: width * 2,
    zIndex: 1,
  },
  gradient: {
    flex: 1,
  },
  logoContainer: {
    zIndex: 2,
  },
});
