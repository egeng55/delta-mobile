import type { ScanCapabilities, ScanProgress, ScanResult, ScanMethod, PhotogrammetryProgress } from '../DeltaBodyScanner.types';
import type { BodyScanner3DViewRef } from '../BodyScanner3DView';
export interface UseBodyScannerReturn {
    capabilities: ScanCapabilities | null;
    isCapabilitiesLoading: boolean;
    scanProgress: ScanProgress | null;
    photogrammetryProgress: PhotogrammetryProgress | null;
    isScanning: boolean;
    scanResult: ScanResult | null;
    error: string | null;
    startScan: (method: ScanMethod) => void;
    stopScan: () => void;
    capturePhoto: () => void;
    scanHistory: ScanResult[];
    loadScanHistory: () => Promise<void>;
    deleteExistingScan: (fileUri: string) => Promise<boolean>;
    checkMeshExists: (fileUri: string) => Promise<boolean>;
    getBestScanMethod: () => ScanMethod;
    scannerRef: React.RefObject<BodyScanner3DViewRef>;
}
export declare function useBodyScanner(): UseBodyScannerReturn;
