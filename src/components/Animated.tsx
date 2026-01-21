/**
 * Animated Components - Smooth animations for Delta app.
 *
 * Uses react-native-reanimated for performant animations.
 */

import React, { useEffect } from 'react';
import { ViewStyle, Pressable, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  interpolate,
  Extrapolate,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideInUp,
  SlideOutDown,
  ZoomIn,
  runOnJS,
} from 'react-native-reanimated';

// Spring config for snappy animations
const springConfig = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

// Timing config for smooth transitions
const timingConfig = {
  duration: 200,
};

/**
 * Animated card that scales on press
 */
interface AnimatedCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  delay?: number;
}

export function AnimatedCard({ children, style, onPress, delay = 0 }: AnimatedCardProps): React.ReactNode {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    translateY.value = withDelay(delay, withSpring(0, springConfig));
  }, [delay, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, springConfig);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  if (onPress) {
    return (
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View style={[style, animatedStyle]}>
          {children}
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

/**
 * Animated button with scale feedback
 */
interface AnimatedButtonProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
  disabled?: boolean;
}

export function AnimatedButton({ children, style, onPress, disabled }: AnimatedButtonProps): React.ReactNode {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.95, springConfig);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, animatedStyle, disabled && { opacity: 0.6 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Animated list item that slides in
 */
interface AnimatedListItemProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  index: number;
  onPress?: () => void;
}

export function AnimatedListItem({ children, style, index, onPress }: AnimatedListItemProps): React.ReactNode {
  const translateX = useSharedValue(50);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const delay = index * 50;
    translateX.value = withDelay(delay, withSpring(0, springConfig));
    opacity.value = withDelay(delay, withTiming(1, { duration: 250 }));
  }, [index, translateX, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.98, springConfig);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  if (onPress) {
    return (
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View style={[style, animatedStyle]}>
          {children}
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

/**
 * Fade in wrapper
 */
interface FadeInViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
}

export function FadeInView({ children, style, delay = 0, duration = 300 }: FadeInViewProps): React.ReactNode {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration }));
  }, [delay, duration, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

/**
 * Progress bar with animation
 */
interface AnimatedProgressProps {
  progress: number; // 0-100
  height?: number;
  backgroundColor?: string;
  fillColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedProgress({
  progress,
  height = 8,
  backgroundColor = '#1e293b',
  fillColor = '#4ade80',
  style,
}: AnimatedProgressProps): React.ReactNode {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withSpring(progress, { ...springConfig, damping: 20 });
  }, [progress, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <Animated.View
      style={[
        { height, backgroundColor, borderRadius: height / 2, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View
        style={[
          { height: '100%', backgroundColor: fillColor, borderRadius: height / 2 },
          animatedStyle,
        ]}
      />
    </Animated.View>
  );
}

/**
 * Animated number counter
 */
interface AnimatedNumberProps {
  value: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: object;
  prefix?: string;
  suffix?: string;
  duration?: number;
}

export function AnimatedNumber({
  value,
  style,
  textStyle,
  prefix = '',
  suffix = '',
  duration = 500,
}: AnimatedNumberProps): React.ReactNode {
  const animatedValue = useSharedValue(0);
  const [displayValue, setDisplayValue] = React.useState(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, { duration }, () => {
      runOnJS(setDisplayValue)(value);
    });
  }, [value, duration, animatedValue]);

  const animatedStyle = useAnimatedStyle(() => {
    const currentValue = Math.round(animatedValue.value);
    runOnJS(setDisplayValue)(currentValue);
    return {};
  });

  return (
    <Animated.View style={[style, animatedStyle]}>
      <Animated.Text style={textStyle}>
        {prefix}{displayValue}{suffix}
      </Animated.Text>
    </Animated.View>
  );
}

/**
 * Animated tab indicator
 */
interface AnimatedTabIndicatorProps {
  activeIndex: number;
  tabCount: number;
  tabWidth: number;
  height?: number;
  color?: string;
}

export function AnimatedTabIndicator({
  activeIndex,
  tabCount,
  tabWidth,
  height = 3,
  color = '#818cf8',
}: AnimatedTabIndicatorProps): React.ReactNode {
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withSpring(activeIndex * tabWidth, springConfig);
  }, [activeIndex, tabWidth, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: tabWidth,
          height,
          backgroundColor: color,
          borderRadius: height / 2,
        },
        animatedStyle,
      ]}
    />
  );
}

/**
 * Animated checkbox
 */
interface AnimatedCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  size?: number;
  color?: string;
  uncheckedColor?: string;
}

export function AnimatedCheckbox({
  checked,
  onToggle,
  size = 24,
  color = '#4ade80',
  uncheckedColor = '#64748b',
}: AnimatedCheckboxProps): React.ReactNode {
  const scale = useSharedValue(1);
  const checkScale = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    checkScale.value = withSpring(checked ? 1 : 0, springConfig);
  }, [checked, checkScale]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  const handlePress = () => {
    scale.value = withSpring(0.9, springConfig, () => {
      scale.value = withSpring(1, springConfig);
    });
    onToggle();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: checked ? color : uncheckedColor,
            backgroundColor: checked ? color : 'transparent',
            justifyContent: 'center',
            alignItems: 'center',
          },
          containerStyle,
        ]}
      >
        <Animated.View style={checkStyle}>
          <Animated.Text style={{ color: '#fff', fontSize: size * 0.6, fontWeight: '600' }}>
            ✓
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

// Re-export entering/exiting animations
export {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideInUp,
  SlideOutDown,
  ZoomIn,
};
