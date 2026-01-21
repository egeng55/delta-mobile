/**
 * Delta Logo Component
 *
 * SVG logo for use in splash screen, headers, and branding.
 * Based on delta.svg - triangular layered design.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, G, Rect, Filter } from 'react-native-svg';

interface DeltaLogoProps {
  size?: number;
  color?: string;
  showBackground?: boolean;
}

export default function DeltaLogo({
  size = 100,
  color = '#ffffff',
  showBackground = false,
}: DeltaLogoProps): React.ReactNode {
  const scale = size / 571;
  const height = 503 * scale;

  return (
    <View style={[styles.container, { width: size, height }]}>
      <Svg width={size} height={height} viewBox="0 0 571 503" fill="none">
        {showBackground && (
          <Rect width="571" height="503" fill="#1E1E1E" />
        )}
        <Defs>
          <LinearGradient id="gradient0" x1="284.693" y1="128.486" x2="284.693" y2="436.5" gradientUnits="userSpaceOnUse">
            <Stop stopColor="#6366F1" />
            <Stop offset="1" stopColor="#4F46E5" />
          </LinearGradient>
          <LinearGradient id="gradient1" x1="284.692" y1="216.309" x2="284.692" y2="390.75" gradientUnits="userSpaceOnUse">
            <Stop stopColor="#818CF8" />
            <Stop offset="1" stopColor="#6366F1" />
          </LinearGradient>
        </Defs>

        {/* Outer triangle */}
        <G opacity="0.9">
          <Path
            d="M259.211 15C270.758 -5.00003 299.626 -4.99997 311.173 15L562.32 450C573.867 470 559.434 495 536.339 495H34.0447C10.9507 495 -3.483 470 8.06401 450L259.211 15Z"
            fill="#0E0B2B"
          />
          <Path
            d="M261.809 16.5C272.202 -1.49996 298.183 -1.49998 308.575 16.5L559.722 451.5C570.115 469.5 557.124 492 536.34 492H34.0447C13.2601 492 0.269654 469.5 10.6619 451.5L261.809 16.5Z"
            stroke={color}
            strokeWidth="6"
          />
        </G>

        {/* Middle triangle with gradient */}
        <G opacity="0.7">
          <Path
            d="M259.147 128.486C270.863 109.459 298.522 109.459 310.238 128.486L471.741 390.77C484.049 410.758 469.669 436.5 446.195 436.5H123.189C99.7155 436.5 85.3356 410.758 97.6433 390.77L259.147 128.486Z"
            fill="url(#gradient0)"
          />
        </G>

        {/* Inner triangle with gradient */}
        <G opacity="0.8">
          <Path
            d="M259.449 216.309C271.256 197.923 298.128 197.923 309.935 216.309L392.282 344.539C405.104 364.505 390.767 390.75 367.039 390.75H202.346C178.617 390.75 164.281 364.506 177.102 344.539L259.449 216.309Z"
            fill="url(#gradient1)"
          />
        </G>
      </Svg>
    </View>
  );
}

// Simplified version for smaller sizes (icons, badges)
export function DeltaLogoSimple({
  size = 24,
  color = '#6366F1',
}: {
  size?: number;
  color?: string;
}): React.ReactNode {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L22 20H2L12 2Z"
        fill={color}
        opacity="0.3"
      />
      <Path
        d="M12 6L18 18H6L12 6Z"
        fill={color}
        opacity="0.6"
      />
      <Path
        d="M12 10L15 16H9L12 10Z"
        fill={color}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
