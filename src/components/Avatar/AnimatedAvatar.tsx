/**
 * AnimatedAvatar - Avatar with 3D spinning animation
 *
 * Continuously rotates the avatar on a vertical axis to create
 * a 3D display effect. Uses scaleX transform to simulate Y-axis rotation.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import AvatarBody from './AvatarBody';
import { AvatarStyle } from '../../types/avatar';

interface AnimatedAvatarProps {
  templateId: string;
  style: AvatarStyle;
  skinTone: string;
  size?: number;
  showGlow?: boolean;
  spinning?: boolean;
  spinDuration?: number; // ms for full rotation
}

export default function AnimatedAvatar({
  templateId,
  style,
  skinTone,
  size = 300,
  showGlow = false,
  spinning = true,
  spinDuration = 8000,
}: AnimatedAvatarProps): React.ReactElement {
  // Rotation progress 0-1 for full 360 spin
  const rotationProgress = useSharedValue(0);

  useEffect(() => {
    if (spinning) {
      rotationProgress.value = withRepeat(
        withTiming(1, {
          duration: spinDuration,
          easing: Easing.linear,
        }),
        -1, // Infinite
        false // Don't reverse
      );
    } else {
      rotationProgress.value = 0;
    }
  }, [spinning, spinDuration]);

  // Simulate 3D Y-axis rotation using scaleX
  // At 0 and 0.5 progress, avatar faces forward (scaleX = 1)
  // At 0.25 and 0.75, avatar is at side view (scaleX = 0)
  const animatedStyle = useAnimatedStyle(() => {
    // Map progress to scaleX for 3D effect
    // 0 -> 1, 0.25 -> 0, 0.5 -> -1 (flipped), 0.75 -> 0, 1 -> 1
    const scaleX = Math.cos(rotationProgress.value * Math.PI * 2);

    // Subtle perspective shift
    const translateX = Math.sin(rotationProgress.value * Math.PI * 2) * 5;

    // Very slight scale change for depth perception
    const depthScale = 1 + Math.sin(rotationProgress.value * Math.PI * 2) * 0.02;

    return {
      transform: [
        { translateX },
        { scaleX: Math.abs(scaleX) > 0.1 ? scaleX : 0.1 * Math.sign(scaleX || 1) },
        { scale: depthScale },
      ],
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Shadow/platform beneath avatar */}
      <View
        style={[
          styles.shadow,
          {
            width: size * 0.4,
            height: size * 0.08,
            bottom: size * 0.05,
          },
        ]}
      />

      <Animated.View style={animatedStyle}>
        <AvatarBody
          templateId={templateId}
          style={style}
          skinTone={skinTone}
          size={size}
          showGlow={showGlow}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 100,
  },
});
