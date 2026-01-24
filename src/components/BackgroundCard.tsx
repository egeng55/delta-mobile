import React from 'react';
import {
  View,
  ImageBackground,
  StyleSheet,
  ViewStyle,
  ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Background image assets
export const BackgroundImages = {
  aerialIce: require('../../assets/backgrounds/aerial-ice.jpg'),
  coastalWildflowers: require('../../assets/backgrounds/coastal-wildflowers.jpg'),
  waterfallStones: require('../../assets/backgrounds/waterfall-stones.jpg'),
  sunsetShore: require('../../assets/backgrounds/sunset-shore.jpg'),
  riverBlooms: require('../../assets/backgrounds/river-blooms.jpg'),
} as const;

export type BackgroundImageKey = keyof typeof BackgroundImages;

// Gradient color tuple type for LinearGradient
type GradientColors = readonly [string, string];

// Preset tint colors (Oura-inspired)
export const TintPresets: Record<string, { colors: GradientColors; image: BackgroundImageKey }> = {
  // Sleep/Rest - deep blue/purple
  sleep: {
    colors: ['rgba(30, 41, 82, 0.85)', 'rgba(45, 55, 110, 0.75)'],
    image: 'aerialIce',
  },
  // Activity/Energy - teal/green
  activity: {
    colors: ['rgba(20, 80, 80, 0.8)', 'rgba(30, 100, 90, 0.7)'],
    image: 'coastalWildflowers',
  },
  // Recovery/Wellness - calm blue
  recovery: {
    colors: ['rgba(40, 70, 100, 0.8)', 'rgba(50, 90, 120, 0.7)'],
    image: 'waterfallStones',
  },
  // Readiness - warm purple
  readiness: {
    colors: ['rgba(60, 40, 80, 0.8)', 'rgba(80, 50, 100, 0.7)'],
    image: 'sunsetShore',
  },
  // General/Insights - soft green
  insights: {
    colors: ['rgba(40, 70, 60, 0.8)', 'rgba(50, 90, 80, 0.7)'],
    image: 'riverBlooms',
  },
};

export type TintPresetKey = 'sleep' | 'activity' | 'recovery' | 'readiness' | 'insights';

interface BackgroundCardProps {
  children: React.ReactNode;
  // Use a preset
  preset?: TintPresetKey;
  // Or customize manually
  backgroundImage?: BackgroundImageKey | ImageSourcePropType;
  tintColors?: string[];
  tintOpacity?: number;
  // Styling
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  borderRadius?: number;
  // Gradient direction
  gradientStart?: { x: number; y: number };
  gradientEnd?: { x: number; y: number };
}

export function BackgroundCard({
  children,
  preset,
  backgroundImage,
  tintColors,
  tintOpacity = 0.8,
  style,
  contentStyle,
  borderRadius = 16,
  gradientStart = { x: 0, y: 0 },
  gradientEnd = { x: 1, y: 1 },
}: BackgroundCardProps) {
  // Determine image source and tint colors
  let imageSource: ImageSourcePropType;
  let colors: readonly [string, string];

  if (preset) {
    const presetConfig = TintPresets[preset];
    imageSource = BackgroundImages[presetConfig.image];
    colors = presetConfig.colors;
  } else {
    // Custom configuration
    if (typeof backgroundImage === 'string') {
      imageSource = BackgroundImages[backgroundImage as BackgroundImageKey];
    } else if (backgroundImage) {
      imageSource = backgroundImage;
    } else {
      imageSource = BackgroundImages.aerialIce;
    }

    colors = tintColors && tintColors.length >= 2
      ? [tintColors[0], tintColors[1]]
      : [
          `rgba(30, 50, 80, ${tintOpacity})`,
          `rgba(40, 60, 90, ${tintOpacity * 0.9})`,
        ];
  }

  return (
    <View style={[styles.container, { borderRadius }, style]}>
      <ImageBackground
        source={imageSource}
        style={styles.imageBackground}
        imageStyle={{ borderRadius }}
        resizeMode="cover"
      >
        <LinearGradient
          colors={colors}
          start={gradientStart}
          end={gradientEnd}
          style={[styles.gradient, { borderRadius }]}
        >
          <View style={[styles.content, contentStyle]}>{children}</View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

// Simpler version without gradient - just solid tint
interface SimpleBackgroundCardProps {
  children: React.ReactNode;
  backgroundImage?: BackgroundImageKey | ImageSourcePropType;
  tintColor?: string;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  borderRadius?: number;
}

export function SimpleBackgroundCard({
  children,
  backgroundImage = 'aerialIce',
  tintColor = 'rgba(30, 50, 80, 0.75)',
  style,
  contentStyle,
  borderRadius = 16,
}: SimpleBackgroundCardProps) {
  const imageSource =
    typeof backgroundImage === 'string'
      ? BackgroundImages[backgroundImage as BackgroundImageKey]
      : backgroundImage;

  return (
    <View style={[styles.container, { borderRadius }, style]}>
      <ImageBackground
        source={imageSource}
        style={styles.imageBackground}
        imageStyle={{ borderRadius }}
        resizeMode="cover"
      >
        <View
          style={[
            styles.solidTint,
            { backgroundColor: tintColor, borderRadius },
          ]}
        >
          <View style={[styles.content, contentStyle]}>{children}</View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  imageBackground: {
    width: '100%',
    minHeight: 120,
  },
  gradient: {
    flex: 1,
    width: '100%',
  },
  solidTint: {
    flex: 1,
    width: '100%',
  },
  content: {
    flex: 1,
    padding: 16,
  },
});

export default BackgroundCard;
