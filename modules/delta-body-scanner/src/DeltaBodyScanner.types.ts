import type { ViewProps } from 'react-native';

// Device capability detection
export interface ScanCapabilities {
  hasLiDAR: boolean;
  supportsPhotogrammetry: boolean;
  supportedMethods: ScanMethod[];
  deviceModel: string;
  iosVersion: string;
}

// Scan methods
export type ScanMethod = 'lidar' | 'photogrammetry' | 'template';

// Scan state
export type ScanState =
  | 'idle'
  | 'initializing'
  | 'scanning'
  | 'processing'
  | 'complete'
  | 'error';

// Scan progress information
export interface ScanProgress {
  state: ScanState;
  coverage: number; // 0-100 percentage of body covered
  guidanceMessage: string;
  meshVertexCount?: number;
  estimatedTimeRemaining?: number; // seconds
}

// Photogrammetry capture progress
export interface PhotogrammetryProgress {
  state: 'capturing' | 'processing' | 'complete' | 'error';
  photosCaptured: number;
  photosRequired: number;
  processingProgress: number; // 0-100
  guidanceAngle?: number; // degrees, for guiding user to next position
  guidanceMessage: string;
}

// Scan result
export interface ScanResult {
  success: boolean;
  meshFileUri?: string;
  meshFormat?: 'usdz' | 'glb';
  thumbnailUri?: string;
  scanMethod: ScanMethod;
  scanDate: string;
  scanDuration: number; // seconds
  meshVertexCount?: number;
  error?: string;
}

// Events emitted from native module
export interface ScanProgressEvent {
  progress: ScanProgress;
}

export interface PhotogrammetryProgressEvent {
  progress: PhotogrammetryProgress;
}

export interface ScanCompleteEvent {
  result: ScanResult;
}

export interface ScanErrorEvent {
  error: string;
  code: string;
}

export interface MeshUpdateEvent {
  vertexCount: number;
  coverage: number;
}

// Props for BodyScanner3DView
export interface BodyScanner3DViewProps extends ViewProps {
  scanMethod: 'lidar' | 'photogrammetry';
  autoStart?: boolean;
  showGuides?: boolean;
  showMeshPreview?: boolean;
  onScanProgress?: (event: { nativeEvent: ScanProgressEvent }) => void;
  onScanComplete?: (event: { nativeEvent: ScanCompleteEvent }) => void;
  onScanError?: (event: { nativeEvent: ScanErrorEvent }) => void;
  onMeshUpdate?: (event: { nativeEvent: MeshUpdateEvent }) => void;
}

// Props for Model3DViewer
export interface Model3DViewerProps extends ViewProps {
  modelUri: string;
  autoRotate?: boolean;
  allowUserInteraction?: boolean;
  backgroundColor?: string;
  lightingIntensity?: number;
  initialRotation?: { x: number; y: number; z: number };
  onModelLoaded?: () => void;
  onModelError?: (event: { nativeEvent: { error: string } }) => void;
}

// Module function types
export interface DeltaBodyScannerModule {
  // Constants
  hasLiDAR: boolean;
  supportsPhotogrammetry: boolean;

  // Functions
  getCapabilities(): Promise<ScanCapabilities>;
  startLiDARScan(): Promise<void>;
  startPhotogrammetryScan(): Promise<void>;
  stopScan(): Promise<ScanResult>;
  capturePhoto(): Promise<{ photoIndex: number; totalRequired: number }>;
  exportMesh(format: 'usdz' | 'glb'): Promise<{ fileUri: string }>;
  deleteScan(scanId: string): Promise<boolean>;
  getScanHistory(): Promise<ScanResult[]>;
}

// Export all types for external use
export type {
  ViewProps,
};
