/**
 * AvatarScanScreen - Camera-based body scanning for avatar personalization
 *
 * Phase 2: Guided pose capture with on-device ML processing.
 *
 * PRIVACY NOTICE:
 * - All processing happens on your device
 * - No photos or videos are saved
 * - Only abstract body proportions are extracted
 * - You can delete your avatar anytime
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
// Lazy import camera to avoid crash if native module not available
let CameraView: any = null;
let useCameraPermissions: any = () => [null, () => Promise.resolve({ granted: false })];
try {
  const expoCamera = require('expo-camera');
  CameraView = expoCamera.CameraView;
  useCameraPermissions = expoCamera.useCameraPermissions;
} catch (e) {
  console.log('expo-camera not available, scan feature disabled');
}
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { Theme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { UserAvatar, DEFAULT_AVATAR } from '../types/avatar';
import { avatarService } from '../services/avatarService';
import {
  bodyScannerService,
  ScanPhase,
  ScanProgress,
  PoseKeypoints,
  ScanResult,
} from '../services/bodyScanner';
import AvatarBody from '../components/Avatar/AvatarBody';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AvatarScanScreenProps {
  theme: Theme;
  onClose: () => void;
  onComplete: (avatar: UserAvatar) => void;
  currentAvatar?: UserAvatar;
}

// Pose guide styles (defined outside component to avoid recreation)
const guideStyles = StyleSheet.create({
  poseGuide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideHead: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#fff',
    marginBottom: 10,
  },
  guideTorso: {
    width: 60,
    height: 100,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 8,
  },
  guideLegs: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },
  guideLeg: {
    width: 25,
    height: 120,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 8,
  },
  guideArmsOut: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  guideArm: {
    width: 80,
    height: 20,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 8,
  },
});

// Pose guide overlay component
function PoseGuide({ phase, theme }: { phase: ScanPhase; theme: Theme }) {
  const pulseOpacity = useSharedValue(0.3);

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  // Different guide shapes for different poses
  const renderGuide = () => {
    switch (phase) {
      case 'front':
        return (
          <Animated.View style={[guideStyles.poseGuide, animatedStyle]}>
            {/* Front pose silhouette */}
            <View style={guideStyles.guideHead} />
            <View style={guideStyles.guideTorso} />
            <View style={guideStyles.guideLegs}>
              <View style={guideStyles.guideLeg} />
              <View style={guideStyles.guideLeg} />
            </View>
          </Animated.View>
        );
      case 'side':
        return (
          <Animated.View style={[guideStyles.poseGuide, animatedStyle]}>
            {/* Side pose silhouette */}
            <View style={guideStyles.guideHead} />
            <View style={[guideStyles.guideTorso, { width: 30 }]} />
            <View style={[guideStyles.guideLegs, { width: 30 }]}>
              <View style={[guideStyles.guideLeg, { width: 15 }]} />
            </View>
          </Animated.View>
        );
      case 'tpose':
        return (
          <Animated.View style={[guideStyles.poseGuide, animatedStyle]}>
            {/* T-pose silhouette */}
            <View style={guideStyles.guideHead} />
            <View style={guideStyles.guideArmsOut}>
              <View style={guideStyles.guideArm} />
              <View style={[guideStyles.guideTorso, { height: 80 }]} />
              <View style={guideStyles.guideArm} />
            </View>
            <View style={guideStyles.guideLegs}>
              <View style={guideStyles.guideLeg} />
              <View style={guideStyles.guideLeg} />
            </View>
          </Animated.View>
        );
      default:
        return null;
    }
  };

  return renderGuide();
}

export default function AvatarScanScreen({
  theme,
  onClose,
  onComplete,
  currentAvatar = DEFAULT_AVATAR,
}: AvatarScanScreenProps): React.ReactElement {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<any>(null);

  const [permission, requestPermission] = useCameraPermissions();

  // If camera module isn't available, show unavailable screen
  if (!CameraView) {
    const styles = createStyles(theme, { top: insets.top, bottom: insets.bottom });
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Body Scan</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.permissionContainer}>
          <Animated.View entering={FadeInDown}>
            <View style={[styles.permissionIcon, { backgroundColor: theme.textSecondary + '20' }]}>
              <Ionicons name="camera-outline" size={40} color={theme.textSecondary} />
            </View>
            <Text style={styles.permissionTitle}>Camera Not Available</Text>
            <Text style={styles.permissionText}>
              The camera scanning feature requires a native app rebuild.
              {'\n\n'}
              Please rebuild your app with:{'\n'}
              npx expo run:ios
            </Text>
            <TouchableOpacity style={styles.skipButton} onPress={onClose}>
              <Text style={styles.skipButtonText}>Use Template Instead</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }
  const [phase, setPhase] = useState<ScanPhase>('front');
  const [progress, setProgress] = useState<ScanProgress>(bodyScannerService.getProgress('front'));
  const [isCapturing, setIsCapturing] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Initialize scanner on mount
  useEffect(() => {
    bodyScannerService.resetScan();
    return () => {
      bodyScannerService.resetScan();
    };
  }, []);

  // Update progress when phase changes
  useEffect(() => {
    setProgress(bodyScannerService.getProgress(phase));
  }, [phase]);

  // Request camera permission
  const handleRequestPermission = async () => {
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert(
        'Camera Access Required',
        'Delta needs camera access to create your personalized avatar. No photos are saved.',
        [
          { text: 'Cancel', style: 'cancel', onPress: onClose },
          { text: 'Open Settings', onPress: () => {} }, // Would open settings
        ]
      );
    }
  };

  // Simulate pose detection (in production, this would use Vision framework)
  // For now, we'll use a simplified capture approach
  const captureFrame = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);

    try {
      // In production: Use native module to run VNDetectHumanBodyPoseRequest
      // For MVP: Simulate pose detection with random valid poses
      const simulatedPose = generateSimulatedPose(phase);

      const added = bodyScannerService.addPose(phase, simulatedPose);
      if (added) {
        setProgress(bodyScannerService.getProgress(phase));
      }

      // Check if phase is complete
      if (bodyScannerService.isPhaseComplete(phase)) {
        await advancePhase();
      }
    } catch (error) {
      console.log('Capture error:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [phase, isCapturing]);

  // Start auto-capture with countdown
  const startCapture = useCallback(async () => {
    setCountdown(3);

    // Countdown
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setCountdown(null);

    // Capture frames
    for (let i = 0; i < 5; i++) {
      await captureFrame();
      await new Promise(resolve => setTimeout(resolve, 500));

      if (bodyScannerService.isPhaseComplete(phase)) {
        break;
      }
    }
  }, [phase, captureFrame]);

  // Advance to next phase
  const advancePhase = async () => {
    const phases: ScanPhase[] = ['front', 'side', 'tpose', 'processing', 'complete'];
    const currentIndex = phases.indexOf(phase);

    if (currentIndex < phases.length - 1) {
      const nextPhase = phases[currentIndex + 1];

      if (nextPhase === 'processing') {
        setPhase('processing');

        // Process the scan
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulated processing time
        const result = bodyScannerService.processScan();
        setScanResult(result);

        setPhase('complete');
      } else {
        setPhase(nextPhase);
      }
    }
  };

  // Skip current phase (use fewer frames)
  const skipPhase = () => {
    advancePhase();
  };

  // Save the result
  const handleSave = async () => {
    if (!scanResult || !user?.id) return;

    const newAvatar = bodyScannerService.createAvatarFromScan(scanResult, currentAvatar);
    await avatarService.saveAvatar(user.id, newAvatar);
    onComplete(newAvatar);
  };

  // Retry scan
  const handleRetry = () => {
    bodyScannerService.resetScan();
    setScanResult(null);
    setPhase('front');
  };

  const styles = createStyles(theme, insets);

  // Permission not determined yet
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Animated.View entering={FadeIn} style={styles.permissionContainer}>
          <View style={styles.permissionIcon}>
            <Ionicons name="camera" size={48} color={theme.accent} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionText}>
            Delta needs camera access to create your personalized avatar.
            {'\n\n'}
            • No photos are saved{'\n'}
            • Processing happens on your device{'\n'}
            • Only body proportions are extracted
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={handleRequestPermission}>
            <Text style={styles.permissionButtonText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={onClose}>
            <Text style={styles.skipButtonText}>Use Default Avatar</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // Processing state
  if (phase === 'processing') {
    return (
      <View style={styles.container}>
        <Animated.View entering={FadeIn} style={styles.processingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.processingText}>Creating your avatar...</Text>
          <Text style={styles.processingSubtext}>
            Processing happens on your device.{'\n'}No data is uploaded.
          </Text>
        </Animated.View>
      </View>
    );
  }

  // Complete state
  if (phase === 'complete' && scanResult) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Avatar</Text>
          <View style={{ width: 40 }} />
        </View>

        <Animated.View entering={FadeInDown} style={styles.resultContainer}>
          <View style={styles.avatarPreview}>
            <AvatarBody
              templateId={scanResult.matchedTemplateId}
              style={currentAvatar.style}
              skinTone={currentAvatar.skinTone}
              size={220}
              showGlow
            />
          </View>

          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>
              {scanResult.success ? 'Avatar Created!' : 'Scan Incomplete'}
            </Text>
            <Text style={styles.resultSubtitle}>
              {scanResult.success
                ? `Matched to ${scanResult.matchedTemplateId} body type (${Math.round(scanResult.confidence * 100)}% confidence)`
                : scanResult.error}
            </Text>
          </View>

          <View style={styles.resultActions}>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Ionicons name="refresh" size={20} color={theme.textSecondary} />
              <Text style={styles.retryButtonText}>Retry Scan</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Use This Avatar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Text style={styles.privacyNote}>
          No photos were saved. Only abstract proportions are stored.
        </Text>
      </View>
    );
  }

  // Camera capture state
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="front"
      >
        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitleLight}>Body Scan</Text>
            <TouchableOpacity onPress={skipPhase} style={styles.skipPhaseButton}>
              <Text style={styles.skipPhaseText}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Pose Guide */}
          <PoseGuide phase={phase} theme={theme} />

          {/* Countdown */}
          {countdown !== null && (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </Animated.View>
          )}

          {/* Instructions */}
          <View style={styles.instructionContainer}>
            <Text style={styles.phaseLabel}>
              Step {phase === 'front' ? 1 : phase === 'side' ? 2 : 3} of 3
            </Text>
            <Text style={styles.instruction}>{progress.instruction}</Text>

            {/* Progress dots */}
            <View style={styles.progressDots}>
              {[...Array(5)].map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i < progress.framesCaptured && styles.progressDotFilled,
                  ]}
                />
              ))}
            </View>

            {/* Capture button */}
            <TouchableOpacity
              style={styles.captureButton}
              onPress={startCapture}
              disabled={isCapturing || countdown !== null}
            >
              {isCapturing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="scan" size={24} color="#fff" />
                  <Text style={styles.captureButtonText}>Capture Pose</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

// Simulated pose generation for MVP (replace with actual Vision framework integration)
function generateSimulatedPose(phase: ScanPhase): PoseKeypoints {
  const randomOffset = () => (Math.random() - 0.5) * 0.05;

  const basePose: PoseKeypoints = {
    nose: { x: 0.5 + randomOffset(), y: 0.15 + randomOffset(), confidence: 0.9 },
    neck: { x: 0.5 + randomOffset(), y: 0.22 + randomOffset(), confidence: 0.9 },
    rightShoulder: { x: 0.35 + randomOffset(), y: 0.25 + randomOffset(), confidence: 0.85 },
    leftShoulder: { x: 0.65 + randomOffset(), y: 0.25 + randomOffset(), confidence: 0.85 },
    rightElbow: { x: 0.28 + randomOffset(), y: 0.38 + randomOffset(), confidence: 0.8 },
    leftElbow: { x: 0.72 + randomOffset(), y: 0.38 + randomOffset(), confidence: 0.8 },
    rightWrist: { x: 0.25 + randomOffset(), y: 0.52 + randomOffset(), confidence: 0.75 },
    leftWrist: { x: 0.75 + randomOffset(), y: 0.52 + randomOffset(), confidence: 0.75 },
    rightHip: { x: 0.42 + randomOffset(), y: 0.52 + randomOffset(), confidence: 0.85 },
    leftHip: { x: 0.58 + randomOffset(), y: 0.52 + randomOffset(), confidence: 0.85 },
    rightKnee: { x: 0.40 + randomOffset(), y: 0.72 + randomOffset(), confidence: 0.8 },
    leftKnee: { x: 0.60 + randomOffset(), y: 0.72 + randomOffset(), confidence: 0.8 },
    rightAnkle: { x: 0.38 + randomOffset(), y: 0.92 + randomOffset(), confidence: 0.75 },
    leftAnkle: { x: 0.62 + randomOffset(), y: 0.92 + randomOffset(), confidence: 0.75 },
  };

  // Adjust for T-pose
  if (phase === 'tpose') {
    basePose.rightWrist = { x: 0.1 + randomOffset(), y: 0.28 + randomOffset(), confidence: 0.8 };
    basePose.leftWrist = { x: 0.9 + randomOffset(), y: 0.28 + randomOffset(), confidence: 0.8 };
    basePose.rightElbow = { x: 0.22 + randomOffset(), y: 0.27 + randomOffset(), confidence: 0.8 };
    basePose.leftElbow = { x: 0.78 + randomOffset(), y: 0.27 + randomOffset(), confidence: 0.8 };
  }

  return basePose;
}

function createStyles(theme: Theme, insets: { top: number; bottom: number }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    camera: {
      flex: 1,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: insets.top + 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    headerTitleLight: {
      fontSize: 17,
      fontWeight: '600',
      color: '#fff',
    },
    skipPhaseButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    skipPhaseText: {
      fontSize: 14,
      color: '#fff',
      opacity: 0.8,
    },
    poseGuide: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    guideHead: {
      width: 50,
      height: 50,
      borderRadius: 25,
      borderWidth: 3,
      borderColor: '#fff',
      marginBottom: 10,
    },
    guideTorso: {
      width: 60,
      height: 100,
      borderWidth: 3,
      borderColor: '#fff',
      borderRadius: 8,
    },
    guideLegs: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 5,
    },
    guideLeg: {
      width: 25,
      height: 120,
      borderWidth: 3,
      borderColor: '#fff',
      borderRadius: 8,
    },
    guideArmsOut: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    guideArm: {
      width: 80,
      height: 20,
      borderWidth: 3,
      borderColor: '#fff',
      borderRadius: 8,
    },
    countdownContainer: {
      position: 'absolute',
      top: '40%',
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    countdownText: {
      fontSize: 80,
      fontWeight: '700',
      color: '#fff',
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 10,
    },
    instructionContainer: {
      paddingHorizontal: 24,
      paddingBottom: insets.bottom + 24,
      alignItems: 'center',
    },
    phaseLabel: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.7)',
      marginBottom: 4,
    },
    instruction: {
      fontSize: 18,
      fontWeight: '600',
      color: '#fff',
      textAlign: 'center',
      marginBottom: 16,
    },
    progressDots: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 20,
    },
    progressDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: 'rgba(255,255,255,0.3)',
    },
    progressDotFilled: {
      backgroundColor: theme.accent,
    },
    captureButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.accent,
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 30,
    },
    captureButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    // Permission screen
    permissionContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    permissionIcon: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    permissionTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 12,
    },
    permissionText: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 32,
    },
    permissionButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 25,
      marginBottom: 16,
    },
    permissionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    skipButton: {
      paddingVertical: 12,
    },
    skipButtonText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    // Processing screen
    processingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    processingText: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.textPrimary,
      marginTop: 24,
    },
    processingSubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    // Result screen
    resultContainer: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 40,
    },
    avatarPreview: {
      marginBottom: 32,
    },
    resultInfo: {
      alignItems: 'center',
      paddingHorizontal: 32,
      marginBottom: 40,
    },
    resultTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 8,
    },
    resultSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    resultActions: {
      flexDirection: 'row',
      gap: 16,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 25,
      backgroundColor: theme.surface,
    },
    retryButtonText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    saveButton: {
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 25,
      backgroundColor: theme.accent,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    privacyNote: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 32,
      paddingBottom: insets.bottom + 16,
    },
  });
}
