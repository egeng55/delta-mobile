/**
 * AvatarBody - SVG human figure
 *
 * Renders a stylized human silhouette based on body type proportions.
 * Clean, modern design that works well at various sizes.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  G,
  Path,
  Circle,
  Ellipse,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { AvatarStyle, AVATAR_TEMPLATES } from '../../types/avatar';

interface AvatarBodyProps {
  templateId: string;
  style: AvatarStyle;
  skinTone: string;
  size?: number;
  showGlow?: boolean;
}

export default function AvatarBody({
  templateId,
  style,
  skinTone,
  size = 300,
  showGlow = false,
}: AvatarBodyProps): React.ReactElement {
  const template = AVATAR_TEMPLATES.find(t => t.id === templateId) ?? AVATAR_TEMPLATES[2];
  const { proportions } = template;

  // Calculate body dimensions from proportions
  const dims = useMemo(() => {
    // Base viewBox is 100x100, body centered
    const cx = 50;

    // Head
    const headRadius = 10;
    const headY = 14;

    // Neck
    const neckWidth = 5;
    const neckTop = headY + headRadius - 1;
    const neckBottom = neckTop + 6;

    // Shoulders & torso
    const shoulderWidth = 14 + proportions.shoulderWidth * 18;
    const shoulderY = neckBottom;
    const waistWidth = 8 + proportions.hipWidth * 10;
    const waistY = shoulderY + 20 + proportions.torsoLength * 12;

    // Hips
    const hipWidth = 10 + proportions.hipWidth * 14;
    const hipY = waistY + 6;

    // Legs
    const legLength = 28 + proportions.legLength * 14;
    const legWidth = 5;
    const legGap = 3;
    const ankleY = hipY + legLength;

    // Arms
    const armLength = 22 + proportions.armLength * 12;
    const armWidth = 4;

    return {
      cx,
      headRadius,
      headY,
      neckWidth,
      neckTop,
      neckBottom,
      shoulderWidth,
      shoulderY,
      waistWidth,
      waistY,
      hipWidth,
      hipY,
      legLength,
      legWidth,
      legGap,
      ankleY,
      armLength,
      armWidth,
    };
  }, [proportions]);

  // Generate body path based on style
  const bodyPath = useMemo(() => {
    const d = dims;
    const cx = d.cx;

    if (style === 'minimal') {
      // Simple geometric silhouette
      return `
        M ${cx} ${d.neckBottom}
        L ${cx - d.shoulderWidth/2} ${d.shoulderY + 4}
        L ${cx - d.waistWidth/2} ${d.waistY}
        L ${cx - d.hipWidth/2} ${d.hipY}
        L ${cx - d.legGap - d.legWidth} ${d.ankleY}
        L ${cx - d.legGap} ${d.ankleY}
        L ${cx} ${d.hipY + 8}
        L ${cx + d.legGap} ${d.ankleY}
        L ${cx + d.legGap + d.legWidth} ${d.ankleY}
        L ${cx + d.hipWidth/2} ${d.hipY}
        L ${cx + d.waistWidth/2} ${d.waistY}
        L ${cx + d.shoulderWidth/2} ${d.shoulderY + 4}
        Z
      `;
    }

    if (style === 'geometric') {
      // Angular, faceted look
      return `
        M ${cx} ${d.neckBottom}
        L ${cx - d.shoulderWidth/2} ${d.shoulderY + 3}
        L ${cx - d.shoulderWidth/2 + 2} ${d.shoulderY + 12}
        L ${cx - d.waistWidth/2 - 1} ${d.waistY - 2}
        L ${cx - d.waistWidth/2} ${d.waistY}
        L ${cx - d.hipWidth/2} ${d.hipY}
        L ${cx - d.hipWidth/2 + 1} ${d.hipY + 8}
        L ${cx - d.legGap - d.legWidth} ${d.ankleY}
        L ${cx - d.legGap} ${d.ankleY}
        L ${cx} ${d.hipY + 10}
        L ${cx + d.legGap} ${d.ankleY}
        L ${cx + d.legGap + d.legWidth} ${d.ankleY}
        L ${cx + d.hipWidth/2 - 1} ${d.hipY + 8}
        L ${cx + d.hipWidth/2} ${d.hipY}
        L ${cx + d.waistWidth/2} ${d.waistY}
        L ${cx + d.waistWidth/2 + 1} ${d.waistY - 2}
        L ${cx + d.shoulderWidth/2 - 2} ${d.shoulderY + 12}
        L ${cx + d.shoulderWidth/2} ${d.shoulderY + 3}
        Z
      `;
    }

    // 'soft' style - smooth curves (default)
    return `
      M ${cx} ${d.neckBottom}
      Q ${cx - d.neckWidth - 2} ${d.shoulderY} ${cx - d.shoulderWidth/2} ${d.shoulderY + 4}
      Q ${cx - d.shoulderWidth/2 - 1} ${d.shoulderY + 14} ${cx - d.waistWidth/2 - 2} ${d.waistY - 4}
      Q ${cx - d.waistWidth/2 - 2} ${d.waistY + 2} ${cx - d.hipWidth/2} ${d.hipY}
      Q ${cx - d.hipWidth/2 + 1} ${d.hipY + d.legLength * 0.4} ${cx - d.legGap - d.legWidth} ${d.ankleY}
      L ${cx - d.legGap} ${d.ankleY}
      Q ${cx - d.legGap + 1} ${d.hipY + 6} ${cx} ${d.hipY + 8}
      Q ${cx + d.legGap - 1} ${d.hipY + 6} ${cx + d.legGap} ${d.ankleY}
      L ${cx + d.legGap + d.legWidth} ${d.ankleY}
      Q ${cx + d.hipWidth/2 - 1} ${d.hipY + d.legLength * 0.4} ${cx + d.hipWidth/2} ${d.hipY}
      Q ${cx + d.waistWidth/2 + 2} ${d.waistY + 2} ${cx + d.waistWidth/2 + 2} ${d.waistY - 4}
      Q ${cx + d.shoulderWidth/2 + 1} ${d.shoulderY + 14} ${cx + d.shoulderWidth/2} ${d.shoulderY + 4}
      Q ${cx + d.neckWidth + 2} ${d.shoulderY} ${cx} ${d.neckBottom}
      Z
    `;
  }, [dims, style]);

  // Generate arm paths
  const armPaths = useMemo(() => {
    const d = dims;
    const cx = d.cx;
    const armEndY = d.shoulderY + d.armLength;

    if (style === 'minimal' || style === 'geometric') {
      // Straight arms
      const leftArm = `
        M ${cx - d.shoulderWidth/2} ${d.shoulderY + 5}
        L ${cx - d.shoulderWidth/2 - 6} ${armEndY}
        L ${cx - d.shoulderWidth/2 - 6 + d.armWidth} ${armEndY + 3}
        L ${cx - d.shoulderWidth/2 + 2} ${d.shoulderY + 8}
        Z
      `;
      const rightArm = `
        M ${cx + d.shoulderWidth/2} ${d.shoulderY + 5}
        L ${cx + d.shoulderWidth/2 + 6} ${armEndY}
        L ${cx + d.shoulderWidth/2 + 6 - d.armWidth} ${armEndY + 3}
        L ${cx + d.shoulderWidth/2 - 2} ${d.shoulderY + 8}
        Z
      `;
      return { leftArm, rightArm };
    }

    // Soft curved arms
    const leftArm = `
      M ${cx - d.shoulderWidth/2} ${d.shoulderY + 5}
      Q ${cx - d.shoulderWidth/2 - 7} ${d.shoulderY + d.armLength * 0.5} ${cx - d.shoulderWidth/2 - 5} ${armEndY}
      Q ${cx - d.shoulderWidth/2 - 4} ${armEndY + 3} ${cx - d.shoulderWidth/2 - 5 + d.armWidth} ${armEndY + 2}
      Q ${cx - d.shoulderWidth/2 - 3} ${d.shoulderY + d.armLength * 0.5} ${cx - d.shoulderWidth/2 + 2} ${d.shoulderY + 8}
      Z
    `;
    const rightArm = `
      M ${cx + d.shoulderWidth/2} ${d.shoulderY + 5}
      Q ${cx + d.shoulderWidth/2 + 7} ${d.shoulderY + d.armLength * 0.5} ${cx + d.shoulderWidth/2 + 5} ${armEndY}
      Q ${cx + d.shoulderWidth/2 + 4} ${armEndY + 3} ${cx + d.shoulderWidth/2 + 5 - d.armWidth} ${armEndY + 2}
      Q ${cx + d.shoulderWidth/2 + 3} ${d.shoulderY + d.armLength * 0.5} ${cx + d.shoulderWidth/2 - 2} ${d.shoulderY + 8}
      Z
    `;
    return { leftArm, rightArm };
  }, [dims, style]);

  // Color utilities
  const darkenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max((num >> 16) - amt, 0);
    const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
    const B = Math.max((num & 0x0000FF) - amt, 0);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  };

  const shadowColor = darkenColor(skinTone, 12);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="skinGradient" x1="30%" y1="0%" x2="70%" y2="100%">
            <Stop offset="0%" stopColor={skinTone} />
            <Stop offset="100%" stopColor={shadowColor} />
          </LinearGradient>
          {showGlow && (
            <LinearGradient id="glowGradient" x1="50%" y1="0%" x2="50%" y2="100%">
              <Stop offset="0%" stopColor="#6366F1" stopOpacity="0.2" />
              <Stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
            </LinearGradient>
          )}
        </Defs>

        {/* Glow */}
        {showGlow && (
          <Ellipse cx="50" cy="50" rx="35" ry="42" fill="url(#glowGradient)" />
        )}

        <G>
          {/* Head */}
          <Circle
            cx={dims.cx}
            cy={dims.headY}
            r={dims.headRadius}
            fill="url(#skinGradient)"
          />

          {/* Neck */}
          <Ellipse
            cx={dims.cx}
            cy={(dims.neckTop + dims.neckBottom) / 2}
            rx={dims.neckWidth}
            ry={(dims.neckBottom - dims.neckTop) / 2 + 2}
            fill="url(#skinGradient)"
          />

          {/* Body */}
          <Path d={bodyPath} fill="url(#skinGradient)" />

          {/* Arms */}
          <Path d={armPaths.leftArm} fill="url(#skinGradient)" />
          <Path d={armPaths.rightArm} fill="url(#skinGradient)" />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
