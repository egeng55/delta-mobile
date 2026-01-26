import type { ViewProps } from 'react-native';
export interface ScanCapabilities {
    hasLiDAR: boolean;
    supportsPhotogrammetry: boolean;
    supportedMethods: ScanMethod[];
    deviceModel: string;
    iosVersion: string;
}
export type ScanMethod = 'lidar' | 'photogrammetry' | 'template';
export type ScanState = 'idle' | 'initializing' | 'scanning' | 'processing' | 'complete' | 'error';
export interface ScanProgress {
    state: ScanState;
    coverage: number;
    guidanceMessage: string;
    meshVertexCount?: number;
    estimatedTimeRemaining?: number;
}
export interface PhotogrammetryProgress {
    state: 'capturing' | 'processing' | 'complete' | 'error';
    photosCaptured: number;
    photosRequired: number;
    processingProgress: number;
    guidanceAngle?: number;
    guidanceMessage: string;
}
export interface ScanResult {
    success: boolean;
    meshFileUri?: string;
    meshFormat?: 'usdz' | 'glb';
    thumbnailUri?: string;
    scanMethod: ScanMethod;
    scanDate: string;
    scanDuration: number;
    meshVertexCount?: number;
    error?: string;
}
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
export interface BodyScanner3DViewProps extends ViewProps {
    scanMethod: 'lidar' | 'photogrammetry';
    autoStart?: boolean;
    showGuides?: boolean;
    showMeshPreview?: boolean;
    onScanProgress?: (event: {
        nativeEvent: ScanProgressEvent;
    }) => void;
    onScanComplete?: (event: {
        nativeEvent: ScanCompleteEvent;
    }) => void;
    onScanError?: (event: {
        nativeEvent: ScanErrorEvent;
    }) => void;
    onMeshUpdate?: (event: {
        nativeEvent: MeshUpdateEvent;
    }) => void;
}
export interface Model3DViewerProps extends ViewProps {
    modelUri: string;
    autoRotate?: boolean;
    allowUserInteraction?: boolean;
    backgroundColor?: string;
    lightingIntensity?: number;
    initialRotation?: {
        x: number;
        y: number;
        z: number;
    };
    onModelLoaded?: () => void;
    onModelError?: (event: {
        nativeEvent: {
            error: string;
        };
    }) => void;
}
export interface DeltaBodyScannerModule {
    hasLiDAR: boolean;
    supportsPhotogrammetry: boolean;
    getCapabilities(): Promise<ScanCapabilities>;
    startLiDARScan(): Promise<void>;
    startPhotogrammetryScan(): Promise<void>;
    stopScan(): Promise<ScanResult>;
    capturePhoto(): Promise<{
        photoIndex: number;
        totalRequired: number;
    }>;
    exportMesh(format: 'usdz' | 'glb'): Promise<{
        fileUri: string;
    }>;
    deleteScan(scanId: string): Promise<boolean>;
    getScanHistory(): Promise<ScanResult[]>;
}
export type { ViewProps, };
