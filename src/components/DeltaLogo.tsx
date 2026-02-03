/**
 * Delta Logo Component
 *
 * SVG logo for use in splash screen, headers, and branding.
 * Based on delta.svg - triangular layered design with transparent background.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, G } from 'react-native-svg';

interface DeltaLogoProps {
  size?: number;
  strokeColor?: string;
}

export default function DeltaLogo({
  size = 100,
  strokeColor = '#ffffff',
}: DeltaLogoProps): React.ReactNode {
  const scale = size / 571;
  const height = 503 * scale;

  return (
    <View style={[styles.container, { width: size, height }]}>
      <Svg width={size} height={height} viewBox="0 0 571 503" fill="none">
        <Defs>
          <LinearGradient id="paint0_linear" x1="284.692" y1="87" x2="284.692" y2="553" gradientUnits="userSpaceOnUse">
            <Stop stopColor="#0E0B2B" />
            <Stop offset="1" stopColor="#2D2491" />
          </LinearGradient>
          <LinearGradient id="paint1_linear" x1="284.692" y1="177" x2="284.692" y2="462" gradientUnits="userSpaceOnUse">
            <Stop offset="0.139423" stopColor="#0E0B2B" />
            <Stop offset="0.4375" stopColor="#2D2491" />
          </LinearGradient>
        </Defs>

        {/* Outer triangle with stroke */}
        <G>
          <Path
            d="M259.211 15C270.758 -5.00003 299.626 -4.99997 311.173 15L562.32 450C573.867 470 559.434 495 536.339 495H34.0447C10.9507 495 -3.483 470 8.064 450L259.211 15Z"
            fill="#0E0B2B"
          />
          <Path
            d="M261.809 16.5C272.12 -1.3593 297.778 -1.49917 308.329 16.0811L308.575 16.5L559.722 451.5C570.115 469.5 557.124 492 536.34 492H34.0447C13.4225 492 0.473253 469.85 10.4226 451.923L10.6619 451.5L261.809 16.5Z"
            stroke={strokeColor}
            strokeWidth="6"
          />
        </G>

        {/* Middle triangle with gradient */}
        <G>
          <Path
            d="M259.147 128.486C270.863 109.459 298.522 109.459 310.238 128.486L471.741 390.77C484.049 410.758 469.669 436.5 446.195 436.5H123.189C99.7155 436.5 85.3356 410.758 97.6433 390.77L259.147 128.486Z"
            fill="url(#paint0_linear)"
          />
        </G>

        {/* Inner triangle with gradient */}
        <G>
          <Path
            d="M259.449 216.309C271.256 197.923 298.128 197.923 309.935 216.309L392.282 344.539C405.104 364.505 390.767 390.75 367.039 390.75H202.346C178.617 390.75 164.281 364.506 177.102 344.539L259.449 216.309Z"
            fill="url(#paint1_linear)"
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
  const height = size * (18 / 24); // triangle spans y=2..20 (18 units of 24)
  return (
    <Svg width={size} height={height} viewBox="0 2 24 18" fill="none">
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

// Pull tab handle - solid, shorter, wider triangle pointing down
export function PullTabHandle({
  width = 44,
  height = 16,
  color = '#6366F1',
}: {
  width?: number;
  height?: number;
  color?: string;
}): React.ReactNode {
  // Triangle pointing down: wider base at top, point at bottom
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <Path
        d={`M0 0L${width} 0L${width / 2} ${height}Z`}
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
