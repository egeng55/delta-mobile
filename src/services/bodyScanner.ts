/**
 * Body Scanner Service - Phase 2
 *
 * Extracts body proportions from camera frames using on-device ML.
 * Uses Apple Vision framework for pose detection.
 *
 * PRIVACY: All processing happens on-device. No images are stored or transmitted.
 * Only abstract proportion ratios (floats) are extracted and saved.
 */

import { Platform } from 'react-native';
import { AvatarTemplate, AVATAR_TEMPLATES, UserAvatar, DEFAULT_AVATAR } from '../types/avatar';

// Pose keypoint indices (Apple Vision framework naming)
export interface PoseKeypoints {
  nose: Point | null;
  neck: Point | null;
  rightShoulder: Point | null;
  leftShoulder: Point | null;
  rightElbow: Point | null;
  leftElbow: Point | null;
  rightWrist: Point | null;
  leftWrist: Point | null;
  rightHip: Point | null;
  leftHip: Point | null;
  rightKnee: Point | null;
  leftKnee: Point | null;
  rightAnkle: Point | null;
  leftAnkle: Point | null;
}

export interface Point {
  x: number;
  y: number;
  confidence: number;
}

export interface BodyProportions {
  shoulderWidth: number;      // 0.0 - 1.0 normalized
  torsoLength: number;        // 0.0 - 1.0 normalized
  hipWidth: number;           // 0.0 - 1.0 normalized
  legLength: number;          // 0.0 - 1.0 normalized
  armLength: number;          // 0.0 - 1.0 normalized
}

export interface ScanResult {
  success: boolean;
  proportions: BodyProportions | null;
  matchedTemplateId: string;
  confidence: number;
  error?: string;
}

export type ScanPhase = 'front' | 'side' | 'tpose' | 'processing' | 'complete';

export interface ScanProgress {
  phase: ScanPhase;
  framesCaptured: number;
  framesNeeded: number;
  poseDetected: boolean;
  instruction: string;
}

// Minimum confidence threshold for pose keypoints
const MIN_CONFIDENCE = 0.5;

// Number of frames to capture per pose
const FRAMES_PER_POSE = 5;

class BodyScannerService {
  private frontPoses: PoseKeypoints[] = [];
  private sidePoses: PoseKeypoints[] = [];
  private tPoses: PoseKeypoints[] = [];

  private _cameraAvailable: boolean | null = null;

  /**
   * Check if body scanning is available on this device
   */
  isAvailable(): boolean {
    // Only available on iOS for now (uses Vision framework)
    if (Platform.OS !== 'ios') return false;

    // Cache the result to avoid repeated require() calls
    if (this._cameraAvailable !== null) return this._cameraAvailable;

    // Check if expo-camera native module is available
    // This is a simple check - if the package exists in node_modules
    try {
      // Check if native module exists without triggering full load
      const { NativeModules } = require('react-native');
      this._cameraAvailable = !!NativeModules.ExpoCamera;
      return this._cameraAvailable;
    } catch {
      this._cameraAvailable = false;
      return false;
    }
  }

  /**
   * Reset scan state for a new scan
   */
  resetScan(): void {
    this.frontPoses = [];
    this.sidePoses = [];
    this.tPoses = [];
  }

  /**
   * Get current scan progress
   */
  getProgress(phase: ScanPhase): ScanProgress {
    const instructions: Record<ScanPhase, string> = {
      front: 'Stand facing the camera with arms relaxed at your sides',
      side: 'Turn to show your side profile',
      tpose: 'Extend your arms out to the sides',
      processing: 'Processing your scan...',
      complete: 'Scan complete!',
    };

    const framesForPhase = {
      front: this.frontPoses.length,
      side: this.sidePoses.length,
      tpose: this.tPoses.length,
      processing: FRAMES_PER_POSE,
      complete: FRAMES_PER_POSE,
    };

    return {
      phase,
      framesCaptured: framesForPhase[phase],
      framesNeeded: FRAMES_PER_POSE,
      poseDetected: framesForPhase[phase] > 0,
      instruction: instructions[phase],
    };
  }

  /**
   * Add a captured pose for the current phase
   */
  addPose(phase: ScanPhase, pose: PoseKeypoints): boolean {
    // Validate pose has required keypoints
    if (!this.isValidPose(pose, phase)) {
      return false;
    }

    switch (phase) {
      case 'front':
        if (this.frontPoses.length < FRAMES_PER_POSE) {
          this.frontPoses.push(pose);
          return true;
        }
        break;
      case 'side':
        if (this.sidePoses.length < FRAMES_PER_POSE) {
          this.sidePoses.push(pose);
          return true;
        }
        break;
      case 'tpose':
        if (this.tPoses.length < FRAMES_PER_POSE) {
          this.tPoses.push(pose);
          return true;
        }
        break;
    }
    return false;
  }

  /**
   * Check if we have enough frames for a phase
   */
  isPhaseComplete(phase: ScanPhase): boolean {
    switch (phase) {
      case 'front':
        return this.frontPoses.length >= FRAMES_PER_POSE;
      case 'side':
        return this.sidePoses.length >= FRAMES_PER_POSE;
      case 'tpose':
        return this.tPoses.length >= FRAMES_PER_POSE;
      default:
        return false;
    }
  }

  /**
   * Process all captured poses and extract body proportions
   */
  processScan(): ScanResult {
    try {
      // Need at least front poses for basic scan
      if (this.frontPoses.length < 3) {
        return {
          success: false,
          proportions: null,
          matchedTemplateId: DEFAULT_AVATAR.templateId,
          confidence: 0,
          error: 'Not enough pose data captured',
        };
      }

      // Average the poses for each phase
      const avgFront = this.averagePoses(this.frontPoses);
      const avgTPose = this.tPoses.length >= 3 ? this.averagePoses(this.tPoses) : null;

      // Extract proportions
      const proportions = this.extractProportions(avgFront, avgTPose);

      // Find best matching template
      const { templateId, confidence } = this.findBestTemplate(proportions);

      return {
        success: true,
        proportions,
        matchedTemplateId: templateId,
        confidence,
      };
    } catch (error) {
      return {
        success: false,
        proportions: null,
        matchedTemplateId: DEFAULT_AVATAR.templateId,
        confidence: 0,
        error: 'Failed to process scan',
      };
    }
  }

  /**
   * Validate that a pose has the required keypoints for a phase
   */
  private isValidPose(pose: PoseKeypoints, phase: ScanPhase): boolean {
    const requiredKeypoints: (keyof PoseKeypoints)[] =
      phase === 'tpose'
        ? ['leftShoulder', 'rightShoulder', 'leftWrist', 'rightWrist', 'leftHip', 'rightHip']
        : ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip', 'leftAnkle', 'rightAnkle'];

    return requiredKeypoints.every(key => {
      const point = pose[key];
      return point !== null && point.confidence >= MIN_CONFIDENCE;
    });
  }

  /**
   * Average multiple pose captures to reduce noise
   */
  private averagePoses(poses: PoseKeypoints[]): PoseKeypoints {
    const result: PoseKeypoints = {
      nose: null, neck: null,
      rightShoulder: null, leftShoulder: null,
      rightElbow: null, leftElbow: null,
      rightWrist: null, leftWrist: null,
      rightHip: null, leftHip: null,
      rightKnee: null, leftKnee: null,
      rightAnkle: null, leftAnkle: null,
    };

    const keys = Object.keys(result) as (keyof PoseKeypoints)[];

    for (const key of keys) {
      const validPoints = poses
        .map(p => p[key])
        .filter((p): p is Point => p !== null && p.confidence >= MIN_CONFIDENCE);

      if (validPoints.length > 0) {
        result[key] = {
          x: validPoints.reduce((sum, p) => sum + p.x, 0) / validPoints.length,
          y: validPoints.reduce((sum, p) => sum + p.y, 0) / validPoints.length,
          confidence: validPoints.reduce((sum, p) => sum + p.confidence, 0) / validPoints.length,
        };
      }
    }

    return result;
  }

  /**
   * Extract body proportions from averaged poses
   */
  private extractProportions(
    frontPose: PoseKeypoints,
    tPose: PoseKeypoints | null
  ): BodyProportions {
    // Helper to calculate distance between two points
    const distance = (p1: Point | null, p2: Point | null): number => {
      if (!p1 || !p2) return 0;
      return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    };

    // Helper to get midpoint
    const midpoint = (p1: Point | null, p2: Point | null): Point | null => {
      if (!p1 || !p2) return null;
      return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
        confidence: (p1.confidence + p2.confidence) / 2,
      };
    };

    // Calculate key measurements
    const shoulderWidth = distance(frontPose.leftShoulder, frontPose.rightShoulder);
    const hipWidth = distance(frontPose.leftHip, frontPose.rightHip);

    const shoulderCenter = midpoint(frontPose.leftShoulder, frontPose.rightShoulder);
    const hipCenter = midpoint(frontPose.leftHip, frontPose.rightHip);
    const ankleCenter = midpoint(frontPose.leftAnkle, frontPose.rightAnkle);

    const torsoLength = distance(shoulderCenter, hipCenter);
    const legLength = distance(hipCenter, ankleCenter);

    // Arm length from T-pose if available, otherwise estimate from front
    let armLength = 0;
    if (tPose) {
      const leftArmLength = distance(tPose.leftShoulder, tPose.leftWrist);
      const rightArmLength = distance(tPose.rightShoulder, tPose.rightWrist);
      armLength = (leftArmLength + rightArmLength) / 2;
    } else {
      // Estimate from elbow positions in front pose
      const leftArm = distance(frontPose.leftShoulder, frontPose.leftElbow);
      const rightArm = distance(frontPose.rightShoulder, frontPose.rightElbow);
      armLength = ((leftArm + rightArm) / 2) * 2; // Approximate full arm
    }

    // Calculate total body height for normalization
    const totalHeight = torsoLength + legLength;

    // Normalize to 0-1 range with some sensible bounds
    const normalize = (value: number, refValue: number, min: number, max: number): number => {
      if (refValue === 0) return 0.5;
      const ratio = value / refValue;
      return Math.max(min, Math.min(max, ratio * 0.5)); // Scale to ~0.3-0.7 range
    };

    return {
      shoulderWidth: normalize(shoulderWidth, hipWidth, 0.3, 0.7),
      torsoLength: normalize(torsoLength, totalHeight, 0.3, 0.5),
      hipWidth: normalize(hipWidth, shoulderWidth, 0.3, 0.6),
      legLength: normalize(legLength, totalHeight, 0.4, 0.6),
      armLength: normalize(armLength, torsoLength, 0.3, 0.5),
    };
  }

  /**
   * Find the template that best matches the extracted proportions
   */
  private findBestTemplate(proportions: BodyProportions): { templateId: string; confidence: number } {
    let bestMatch = AVATAR_TEMPLATES[0];
    let bestScore = Infinity;

    for (const template of AVATAR_TEMPLATES) {
      // Calculate Euclidean distance between proportions
      const score = Math.sqrt(
        Math.pow(proportions.shoulderWidth - template.proportions.shoulderWidth, 2) +
        Math.pow(proportions.torsoLength - template.proportions.torsoLength, 2) +
        Math.pow(proportions.hipWidth - template.proportions.hipWidth, 2) +
        Math.pow(proportions.legLength - template.proportions.legLength, 2) +
        Math.pow(proportions.armLength - template.proportions.armLength, 2)
      );

      if (score < bestScore) {
        bestScore = score;
        bestMatch = template;
      }
    }

    // Convert score to confidence (lower score = higher confidence)
    // Max reasonable score is around 0.5, so we invert and scale
    const confidence = Math.max(0, Math.min(1, 1 - bestScore * 2));

    return {
      templateId: bestMatch.id,
      confidence,
    };
  }

  /**
   * Create a custom avatar from extracted proportions
   */
  createAvatarFromScan(result: ScanResult, baseAvatar: UserAvatar): UserAvatar {
    if (!result.success || !result.proportions) {
      return baseAvatar;
    }

    return {
      ...baseAvatar,
      templateId: result.matchedTemplateId,
      // In Phase 2+, we could store custom proportions for a truly personalized mesh
      // For now, we just use the best matching template
      updatedAt: new Date().toISOString(),
    };
  }
}

export const bodyScannerService = new BodyScannerService();
export default bodyScannerService;
