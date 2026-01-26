/**
 * AvatarScanScreen - Camera-based body scanning for avatar personalization
 *
 * Phase 2: Guided pose capture with on-device ML processing.
 * Phase 4: Real 3D body scanning with LiDAR (iPhone Pro) or photogrammetry.
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
  Platform,
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

// Lazy import 3D body scanner module
let BodyScanner3DView: any = null;
let Model3DViewer: any = null;
let useBodyScanner: any = null;
let getCapabilities: any = null;
try {
  const bodyScanner = require('delta-body-scanner');
  console.log('[AvatarScanScreen] delta-body-scanner loaded:', Object.keys(bodyScanner));
  BodyScanner3DView = bodyScanner.BodyScanner3DView;
  Model3DViewer = bodyScanner.Model3DViewer;
  useBodyScanner = bodyScanner.useBodyScanner;
  getCapabilities = bodyScanner.getCapabilities;
  console.log('[AvatarScanScreen] getCapabilities function:', typeof getCapabilities);
} catch (e) {
  console.log('[AvatarScanScreen] delta-body-scanner not available:', e);
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
import ReadyPlayerMeCreator from '../components/Avatar/ReadyPlayerMeCreator';
import Avatar3DViewer from '../components/Avatar/Avatar3DViewer';
import { RPMAvatarResult } from '../services/readyPlayerMe';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Scan method options
type ScanMethodOption = '3d-lidar' | '3d-photogrammetry' | '2d-pose' | 'template' | 'rpm';

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

// Scan method selection component
function ScanMethodSelection({
  theme,
  onSelect,
  onClose,
  insets,
}: {
  theme: Theme;
  onSelect: (method: ScanMethodOption) => void;
  onClose: () => void;
  insets: { top: number; bottom: number };
}) {
  const [capabilities, setCapabilities] = useState<{
    hasLiDAR: boolean;
    supportsPhotogrammetry: boolean;
  }>({ hasLiDAR: false, supportsPhotogrammetry: false });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch capabilities asynchronously
  useEffect(() => {
    const loadCapabilities = async () => {
      if (getCapabilities && Platform.OS === 'ios') {
        try {
          const caps = await getCapabilities();
          console.log('Device capabilities:', caps);
          setCapabilities({
            hasLiDAR: caps.hasLiDAR || false,
            supportsPhotogrammetry: caps.supportsPhotogrammetry || false,
          });
        } catch (e) {
          console.log('Failed to get capabilities:', e);
        }
      }
      setIsLoading(false);
    };
    loadCapabilities();
  }, []);

  // Check if running iOS beta (26.x) which has LiDAR mesh bug
  const isIOSBeta = Platform.OS === 'ios' && parseInt(Platform.Version as string, 10) >= 26;

  const methods: { id: ScanMethodOption; title: string; description: string; icon: string; available: boolean; badge?: string; recommended?: boolean }[] = [
    {
      id: 'rpm',
      title: '3D Avatar from Selfie',
      description: 'Take a selfie to create a stylized 3D avatar that looks like you. Spins!',
      icon: 'person-circle-outline',
      available: true,
      badge: 'Recommended',
      recommended: true,
    },
    {
      id: '3d-lidar',
      title: '3D LiDAR Scan',
      description: isIOSBeta
        ? 'Not working on iOS beta.'
        : 'Real-time 3D body capture using LiDAR sensor.',
      icon: 'cube-outline',
      available: capabilities.hasLiDAR && Platform.OS === 'ios' && !isIOSBeta,
      badge: isIOSBeta ? 'iOS Bug' : 'Pro',
    },
    {
      id: '3d-photogrammetry',
      title: '3D Photo Scan',
      description: isIOSBeta
        ? 'Not working on iOS beta.'
        : 'Create 3D model from multiple photos.',
      icon: 'images-outline',
      available: capabilities.supportsPhotogrammetry && Platform.OS === 'ios' && !isIOSBeta,
    },
    {
      id: 'template',
      title: 'Choose Template',
      description: 'Select from pre-made body types manually.',
      icon: 'grid-outline',
      available: true,
    },
  ];

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={{ color: theme.textSecondary, marginTop: 16 }}>Detecting device capabilities...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 8,
      }}>
        <TouchableOpacity onPress={onClose} style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.surface,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Ionicons name="close" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '600', color: theme.textPrimary }}>
          Create Avatar
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ padding: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 }}>
          Choose Scan Method
        </Text>
        <Text style={{ fontSize: 15, color: theme.textSecondary, marginBottom: 24 }}>
          Select how you'd like to create your personalized avatar
        </Text>

        {methods.map((method) => (
          <TouchableOpacity
            key={method.id}
            onPress={() => method.available && onSelect(method.id)}
            disabled={!method.available}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: method.available ? theme.surface : theme.surface + '60',
              borderRadius: 16,
              padding: 16,
              marginBottom: 12,
              borderWidth: method.recommended && method.available ? 2 : 0,
              borderColor: theme.accent,
            }}
          >
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: method.available ? theme.accentLight : theme.surface,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 16,
            }}>
              <Ionicons
                name={method.icon as any}
                size={24}
                color={method.available ? theme.accent : theme.textSecondary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: method.available ? theme.textPrimary : theme.textSecondary,
                }}>
                  {method.title}
                </Text>
                {method.badge && (
                  <View style={{
                    backgroundColor: method.available ? theme.accent : theme.textSecondary,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#fff' }}>
                      {method.badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{
                fontSize: 13,
                color: theme.textSecondary,
                marginTop: 4,
              }}>
                {method.description}
              </Text>
              {!method.available && (
                <Text style={{ fontSize: 11, color: theme.accent, marginTop: 4 }}>
                  Not available on this device
                </Text>
              )}
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={method.available ? theme.textSecondary : theme.textSecondary + '40'}
            />
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ padding: 24, paddingBottom: insets.bottom + 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="shield-checkmark" size={16} color={theme.textSecondary} />
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>
            All processing happens on your device. No images are uploaded.
          </Text>
        </View>
      </View>
    </View>
  );
}

// 3D Scan Screen component
function Scan3DScreen({
  theme,
  method,
  onClose,
  onComplete,
  currentAvatar,
  insets,
}: {
  theme: Theme;
  method: '3d-lidar' | '3d-photogrammetry';
  onClose: () => void;
  onComplete: (avatar: UserAvatar) => void;
  currentAvatar: UserAvatar;
  insets: { top: number; bottom: number };
}) {
  const scannerRef = useRef<any>(null);
  // Start as 'scanning' since native auto-starts
  const [scanState, setScanState] = useState<'ready' | 'scanning' | 'processing' | 'complete' | 'error'>('scanning');
  const [progress, setProgress] = useState({
    coverage: 0,
    guidanceMessage: 'Position yourself in frame',
    meshVertexCount: 0,
    state: 'initializing',
  });
  const [scanResult, setScanResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScanProgress = useCallback((event: any) => {
    const progressData = event.nativeEvent?.progress;
    console.log('[Scan3D] Progress event:', progressData);
    if (progressData) {
      setProgress({
        coverage: progressData.coverage || 0,
        guidanceMessage: progressData.guidanceMessage || 'Scanning...',
        meshVertexCount: progressData.meshVertexCount || 0,
        state: progressData.state || 'scanning',
      });
      if (progressData.state === 'scanning' || progressData.state === 'initializing') {
        setScanState('scanning');
      } else if (progressData.state === 'processing') {
        setScanState('processing');
      }
    }
  }, []);

  const handleScanComplete = useCallback((event: any) => {
    const result = event.nativeEvent?.result;
    if (result) {
      setScanResult(result);
      setScanState(result.success ? 'complete' : 'error');
      if (!result.success) {
        setError(result.error || 'Scan failed');
      }
    }
  }, []);

  const handleScanError = useCallback((event: any) => {
    setError(event.nativeEvent?.error || 'An error occurred');
    setScanState('error');
  }, []);

  const startScan = useCallback(() => {
    setScanState('scanning');
    setError(null);
    scannerRef.current?.startScan?.();
  }, []);

  const stopScan = useCallback(() => {
    scannerRef.current?.stopScan?.();
  }, []);

  const handleSave = useCallback(async () => {
    if (!scanResult?.success) return;

    const updatedAvatar: UserAvatar = {
      ...currentAvatar,
      meshFileUri: scanResult.meshFileUri,
      meshFormat: 'usdz',
      scanMethod: method === '3d-lidar' ? 'lidar' : 'photogrammetry',
      scanDate: scanResult.scanDate,
      meshThumbnailUri: scanResult.thumbnailUri,
      updatedAt: new Date().toISOString(),
    };

    onComplete(updatedAvatar);
  }, [scanResult, currentAvatar, method, onComplete]);

  const handleRetry = useCallback(() => {
    setScanState('ready');
    setScanResult(null);
    setError(null);
    setProgress({ coverage: 0, guidanceMessage: 'Position yourself in frame' });
  }, []);

  // Complete state - show result
  if (scanState === 'complete' && scanResult) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 8,
        }}>
          <TouchableOpacity onPress={onClose} style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.surface,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Ionicons name="close" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '600', color: theme.textPrimary }}>
            Scan Complete
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {scanResult.meshFileUri && Model3DViewer ? (
            <View style={{ width: 280, height: 280, borderRadius: 20, overflow: 'hidden', marginBottom: 32 }}>
              <Model3DViewer
                modelUri={scanResult.meshFileUri}
                autoRotate={true}
                allowUserInteraction={true}
                backgroundColor={theme.surface}
                style={{ flex: 1 }}
              />
            </View>
          ) : (
            <View style={{
              width: 280,
              height: 280,
              borderRadius: 20,
              backgroundColor: theme.surface,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 32,
            }}>
              <Ionicons name="cube" size={80} color={theme.accent} />
            </View>
          )}

          <Text style={{ fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 }}>
            3D Avatar Created!
          </Text>
          <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 32 }}>
            Your personalized 3D body model is ready.
          </Text>

          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity
              onPress={handleRetry}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 20,
                paddingVertical: 14,
                borderRadius: 25,
                backgroundColor: theme.surface,
              }}
            >
              <Ionicons name="refresh" size={20} color={theme.textSecondary} />
              <Text style={{ fontSize: 14, color: theme.textSecondary }}>Retry</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              style={{
                paddingHorizontal: 32,
                paddingVertical: 14,
                borderRadius: 25,
                backgroundColor: theme.accent,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Use This Avatar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Error state
  if (scanState === 'error') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: '#FF4444' + '20',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 24,
        }}>
          <Ionicons name="alert-circle" size={48} color="#FF4444" />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 }}>
          Scan Failed
        </Text>
        <Text style={{ fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 32 }}>
          {error || 'An error occurred during scanning.'}
        </Text>
        <TouchableOpacity
          onPress={handleRetry}
          style={{
            paddingHorizontal: 32,
            paddingVertical: 14,
            borderRadius: 25,
            backgroundColor: theme.accent,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Scanning/Ready state
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {BodyScanner3DView ? (
        <BodyScanner3DView
          ref={scannerRef}
          scanMethod={method === '3d-lidar' ? 'lidar' : 'photogrammetry'}
          autoStart={false}
          showGuides={true}
          showMeshPreview={true}
          onScanProgress={handleScanProgress}
          onScanComplete={handleScanComplete}
          onScanError={handleScanError}
          style={{ flex: 1 }}
        />
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff' }}>3D Scanner not available</Text>
        </View>
      )}

      {/* Overlay UI */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'box-none',
      }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 8,
        }}>
          <TouchableOpacity onPress={onClose} style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '600', color: '#fff' }}>
            {method === '3d-lidar' ? 'LiDAR Scan' : 'Photo Scan'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Bottom controls */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
          alignItems: 'center',
        }}>
          {/* Progress indicator */}
          {scanState === 'scanning' && (
            <View style={{
              marginBottom: 20,
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: 16,
              padding: 20,
              width: '100%',
            }}>
              {/* Coverage percentage */}
              <Text style={{ color: '#fff', fontSize: 48, fontWeight: '700', marginBottom: 4 }}>
                {Math.round(progress.coverage)}%
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 16 }}>
                Coverage
              </Text>

              {/* Progress bar */}
              <View style={{
                width: '100%',
                height: 8,
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: 4,
                marginBottom: 16,
              }}>
                <View style={{
                  width: `${Math.min(progress.coverage, 100)}%`,
                  height: '100%',
                  backgroundColor: progress.coverage >= 80 ? '#4CAF50' : theme.accent,
                  borderRadius: 4,
                }} />
              </View>

              {/* Stats row */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 12 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
                    {progress.meshVertexCount > 1000
                      ? `${(progress.meshVertexCount / 1000).toFixed(1)}K`
                      : progress.meshVertexCount}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Vertices</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
                    {progress.state === 'initializing' ? 'Starting...' : 'Active'}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Status</Text>
                </View>
              </View>

              {/* Guidance message */}
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 10,
                width: '100%',
              }}>
                <Text style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>
                  {progress.guidanceMessage}
                </Text>
              </View>
            </View>
          )}

          {scanState === 'processing' && (
            <View style={{
              marginBottom: 20,
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: 16,
              padding: 24,
            }}>
              <ActivityIndicator size="large" color={theme.accent} />
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 16 }}>
                Processing your scan...
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 }}>
                Creating 3D model
              </Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {scanState === 'scanning' && progress.coverage >= 30 && (
              <TouchableOpacity
                onPress={stopScan}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: progress.coverage >= 80 ? '#4CAF50' : theme.accent,
                  paddingHorizontal: 28,
                  paddingVertical: 16,
                  borderRadius: 30,
                }}
              >
                <Ionicons name={progress.coverage >= 80 ? "checkmark-circle" : "save"} size={24} color="#fff" />
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>
                  {progress.coverage >= 80 ? 'Complete Scan' : 'Save Now'}
                </Text>
              </TouchableOpacity>
            )}

            {scanState === 'scanning' && (
              <TouchableOpacity
                onPress={onClose}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderRadius: 30,
                }}
              >
                <Ionicons name="close" size={20} color="#fff" />
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#fff' }}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Hint text */}
          {scanState === 'scanning' && progress.coverage < 30 && (
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
              Move slowly around yourself to capture all angles
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// 2D Pose Scan Screen - extracted as separate component to fix hooks order
function Scan2DPoseScreen({
  theme,
  onClose,
  onComplete,
  currentAvatar,
  insets,
}: {
  theme: Theme;
  onClose: () => void;
  onComplete: (avatar: UserAvatar) => void;
  currentAvatar: UserAvatar;
  insets: { top: number; bottom: number };
}): React.ReactElement {
  const { user } = useAuth();
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<ScanPhase>('front');
  const [progress, setProgress] = useState<ScanProgress>(bodyScannerService.getProgress('front'));
  const [isCapturing, setIsCapturing] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    bodyScannerService.resetScan();
    return () => {
      bodyScannerService.resetScan();
    };
  }, []);

  useEffect(() => {
    setProgress(bodyScannerService.getProgress(phase));
  }, [phase]);

  const captureFrame = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const simulatedPose = generateSimulatedPose(phase);
      const added = bodyScannerService.addPose(phase, simulatedPose);
      if (added) {
        setProgress(bodyScannerService.getProgress(phase));
      }
      if (bodyScannerService.isPhaseComplete(phase)) {
        await advancePhase();
      }
    } catch (error) {
      console.log('Capture error:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [phase, isCapturing]);

  const startCapture = useCallback(async () => {
    setCountdown(3);
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setCountdown(null);
    for (let i = 0; i < 5; i++) {
      await captureFrame();
      await new Promise(resolve => setTimeout(resolve, 500));
      if (bodyScannerService.isPhaseComplete(phase)) {
        break;
      }
    }
  }, [phase, captureFrame]);

  const advancePhase = async () => {
    const phases: ScanPhase[] = ['front', 'side', 'tpose', 'processing', 'complete'];
    const currentIndex = phases.indexOf(phase);
    if (currentIndex < phases.length - 1) {
      const nextPhase = phases[currentIndex + 1];
      if (nextPhase === 'processing') {
        setPhase('processing');
        await new Promise(resolve => setTimeout(resolve, 1500));
        const result = bodyScannerService.processScan();
        setScanResult(result);
        setPhase('complete');
      } else {
        setPhase(nextPhase);
      }
    }
  };

  const skipPhase = () => advancePhase();

  const handleSave = async () => {
    if (!scanResult || !user?.id) return;
    const newAvatar = bodyScannerService.createAvatarFromScan(scanResult, currentAvatar);
    await avatarService.saveAvatar(user.id, newAvatar);
    onComplete(newAvatar);
  };

  const handleRetry = () => {
    bodyScannerService.resetScan();
    setScanResult(null);
    setPhase('front');
  };

  const handleRequestPermission = async () => {
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert(
        'Camera Access Required',
        'Delta needs camera access to create your personalized avatar.',
        [
          { text: 'Cancel', style: 'cancel', onPress: onClose },
          { text: 'Open Settings', onPress: () => {} },
        ]
      );
    }
  };

  const styles = createStyles(theme, insets);

  // Camera not available
  if (!CameraView) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quick Scan</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.permissionContainer}>
          <Animated.View entering={FadeInDown}>
            <View style={[styles.permissionIcon, { backgroundColor: theme.textSecondary + '20' }]}>
              <Ionicons name="camera-outline" size={40} color={theme.textSecondary} />
            </View>
            <Text style={styles.permissionTitle}>Camera Not Available</Text>
            <Text style={styles.permissionText}>
              Rebuild with: npx expo run:ios
            </Text>
            <TouchableOpacity style={styles.skipButton} onPress={onClose}>
              <Text style={styles.skipButtonText}>Go Back</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

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
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={handleRequestPermission}>
            <Text style={styles.permissionButtonText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={onClose}>
            <Text style={styles.skipButtonText}>Go Back</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  if (phase === 'processing') {
    return (
      <View style={styles.container}>
        <Animated.View entering={FadeIn} style={styles.processingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.processingText}>Creating your avatar...</Text>
        </Animated.View>
      </View>
    );
  }

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
          </View>
          <View style={styles.resultActions}>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Ionicons name="refresh" size={20} color={theme.textSecondary} />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Use This Avatar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="front">
        <View style={styles.overlay}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitleLight}>Quick Scan</Text>
            <TouchableOpacity onPress={skipPhase} style={styles.skipPhaseButton}>
              <Text style={styles.skipPhaseText}>Skip</Text>
            </TouchableOpacity>
          </View>
          <PoseGuide phase={phase} theme={theme} />
          {countdown !== null && (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </Animated.View>
          )}
          <View style={styles.instructionContainer}>
            <Text style={styles.phaseLabel}>
              Step {phase === 'front' ? 1 : phase === 'side' ? 2 : 3} of 3
            </Text>
            <Text style={styles.instruction}>{progress.instruction}</Text>
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

// RPM Avatar Complete Screen - shows the 3D avatar spinning after creation
function RPMCompleteScreen({
  theme,
  avatarResult,
  onSave,
  onRetry,
  onClose,
  insets,
}: {
  theme: Theme;
  avatarResult: RPMAvatarResult;
  onSave: () => void;
  onRetry: () => void;
  onClose: () => void;
  insets: { top: number; bottom: number };
}): React.ReactElement {
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 8,
      }}>
        <TouchableOpacity onPress={onClose} style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.surface,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Ionicons name="close" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '600', color: theme.textPrimary }}>
          Your 3D Avatar
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {/* 3D Avatar Viewer */}
        <Avatar3DViewer
          modelUrl={avatarResult.avatarUrl}
          theme={theme}
          size={280}
          autoRotate={true}
          rotationSpeed={0.008}
        />

        <Text style={{
          fontSize: 24,
          fontWeight: '700',
          color: theme.textPrimary,
          marginTop: 32,
          marginBottom: 8,
        }}>
          Avatar Created!
        </Text>
        <Text style={{
          fontSize: 14,
          color: theme.textSecondary,
          textAlign: 'center',
          marginBottom: 32,
        }}>
          Your personalized 3D avatar is ready.{'\n'}Drag to rotate manually.
        </Text>

        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity
            onPress={onRetry}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderRadius: 25,
              backgroundColor: theme.surface,
            }}
          >
            <Ionicons name="refresh" size={20} color={theme.textSecondary} />
            <Text style={{ fontSize: 14, color: theme.textSecondary }}>Redo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onSave}
            style={{
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 25,
              backgroundColor: theme.accent,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Use This Avatar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function AvatarScanScreen({
  theme,
  onClose,
  onComplete,
  currentAvatar = DEFAULT_AVATAR,
}: AvatarScanScreenProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<ScanMethodOption | null>(null);
  const [rpmResult, setRpmResult] = useState<RPMAvatarResult | null>(null);

  const handleMethodSelect = (method: ScanMethodOption) => {
    if (method === 'template') {
      onClose();
      return;
    }
    setSelectedMethod(method);
  };

  const handleRPMComplete = (result: RPMAvatarResult) => {
    console.log('[RPM] Avatar created:', result);
    setRpmResult(result);
  };

  const handleRPMSave = async () => {
    if (!rpmResult || !user?.id) return;

    const updatedAvatar: UserAvatar = {
      ...currentAvatar,
      rpmAvatarUrl: rpmResult.avatarUrl,
      rpmAvatarId: rpmResult.avatarId,
      rpmImageUrl: rpmResult.imageUrl,
      scanMethod: 'readyplayerme',
      scanDate: rpmResult.createdAt,
      updatedAt: new Date().toISOString(),
    };

    // Save to local storage AND sync to cloud
    await avatarService.saveAvatar(user.id, updatedAvatar);
    console.log('[RPM] Avatar saved:', updatedAvatar.rpmAvatarUrl);
    onComplete(updatedAvatar);
  };

  const handleRPMRetry = () => {
    setRpmResult(null);
  };

  if (!selectedMethod) {
    return (
      <ScanMethodSelection
        theme={theme}
        onSelect={handleMethodSelect}
        onClose={onClose}
        insets={{ top: insets.top, bottom: insets.bottom }}
      />
    );
  }

  // Ready Player Me flow
  if (selectedMethod === 'rpm') {
    if (rpmResult) {
      return (
        <RPMCompleteScreen
          theme={theme}
          avatarResult={rpmResult}
          onSave={handleRPMSave}
          onRetry={handleRPMRetry}
          onClose={() => setSelectedMethod(null)}
          insets={{ top: insets.top, bottom: insets.bottom }}
        />
      );
    }

    return (
      <ReadyPlayerMeCreator
        theme={theme}
        onComplete={handleRPMComplete}
        onClose={() => setSelectedMethod(null)}
      />
    );
  }

  if (selectedMethod === '3d-lidar' || selectedMethod === '3d-photogrammetry') {
    return (
      <Scan3DScreen
        theme={theme}
        method={selectedMethod}
        onClose={() => setSelectedMethod(null)}
        onComplete={onComplete}
        currentAvatar={currentAvatar}
        insets={{ top: insets.top, bottom: insets.bottom }}
      />
    );
  }

  // 2D pose scan
  return (
    <Scan2DPoseScreen
      theme={theme}
      onClose={() => setSelectedMethod(null)}
      onComplete={onComplete}
      currentAvatar={currentAvatar}
      insets={{ top: insets.top, bottom: insets.bottom }}
    />
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
