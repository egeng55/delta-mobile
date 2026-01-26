import { useState, useEffect, useCallback, useRef, MutableRefObject } from 'react';
import {
  hasLiDAR,
  supportsPhotogrammetry,
  getCapabilities,
  getScanHistory,
  deleteScan,
  meshExists,
} from '../index';
import type {
  ScanCapabilities,
  ScanProgress,
  ScanResult,
  ScanMethod,
  ScanState,
  PhotogrammetryProgress,
} from '../DeltaBodyScanner.types';
import type { BodyScanner3DViewRef } from '../BodyScanner3DView';

export interface UseBodyScannerReturn {
  // Capabilities
  capabilities: ScanCapabilities | null;
  isCapabilitiesLoading: boolean;

  // Current scan state
  scanProgress: ScanProgress | null;
  photogrammetryProgress: PhotogrammetryProgress | null;
  isScanning: boolean;
  scanResult: ScanResult | null;
  error: string | null;

  // Scan control
  startScan: (method: ScanMethod) => void;
  stopScan: () => void;
  capturePhoto: () => void; // For photogrammetry

  // History
  scanHistory: ScanResult[];
  loadScanHistory: () => Promise<void>;
  deleteExistingScan: (fileUri: string) => Promise<boolean>;

  // Utilities
  checkMeshExists: (fileUri: string) => Promise<boolean>;
  getBestScanMethod: () => ScanMethod;
  scannerRef: MutableRefObject<BodyScanner3DViewRef | null>;
}

export function useBodyScanner(): UseBodyScannerReturn {
  // Refs
  const scannerRef = useRef<BodyScanner3DViewRef>(null);

  // State
  const [capabilities, setCapabilities] = useState<ScanCapabilities | null>(null);
  const [isCapabilitiesLoading, setIsCapabilitiesLoading] = useState(true);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [photogrammetryProgress, setPhotogrammetryProgress] = useState<PhotogrammetryProgress | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);

  // Load capabilities on mount
  useEffect(() => {
    loadCapabilities();
  }, []);

  const loadCapabilities = async () => {
    setIsCapabilitiesLoading(true);
    try {
      const caps = await getCapabilities();
      setCapabilities(caps);
    } catch (err) {
      // Fallback to synchronous constants
      setCapabilities({
        hasLiDAR,
        supportsPhotogrammetry,
        supportedMethods: [
          ...(hasLiDAR ? ['lidar' as const] : []),
          ...(supportsPhotogrammetry ? ['photogrammetry' as const] : []),
          'template' as const,
        ],
        deviceModel: 'unknown',
        iosVersion: 'unknown',
      });
    } finally {
      setIsCapabilitiesLoading(false);
    }
  };

  const loadScanHistory = useCallback(async () => {
    try {
      const history = await getScanHistory();
      setScanHistory(history);
    } catch (err) {
      console.warn('Failed to load scan history:', err);
    }
  }, []);

  const startScan = useCallback((method: ScanMethod) => {
    if (method === 'template') {
      setError('Template method does not require scanning');
      return;
    }

    // Validate method is supported
    if (method === 'lidar' && !hasLiDAR) {
      setError('LiDAR is not available on this device');
      return;
    }

    if (method === 'photogrammetry' && !supportsPhotogrammetry) {
      setError('Photogrammetry is not available on this device');
      return;
    }

    // Reset state
    setError(null);
    setScanResult(null);
    setScanProgress({
      state: 'initializing',
      coverage: 0,
      guidanceMessage: 'Preparing scanner...',
    });
    setIsScanning(true);

    // Start scan via native view ref
    scannerRef.current?.startScan();
  }, []);

  const stopScan = useCallback(() => {
    scannerRef.current?.stopScan();
    // Note: isScanning will be set to false when onScanComplete fires
  }, []);

  const capturePhoto = useCallback(() => {
    scannerRef.current?.capturePhoto();
  }, []);

  const deleteExistingScan = useCallback(async (fileUri: string): Promise<boolean> => {
    try {
      const success = await deleteScan(fileUri);
      if (success) {
        setScanHistory((prev) => prev.filter((s) => s.meshFileUri !== fileUri));
      }
      return success;
    } catch (err) {
      console.warn('Failed to delete scan:', err);
      return false;
    }
  }, []);

  const checkMeshExists = useCallback(async (fileUri: string): Promise<boolean> => {
    try {
      return await meshExists(fileUri);
    } catch {
      return false;
    }
  }, []);

  const getBestScanMethod = useCallback((): ScanMethod => {
    if (hasLiDAR) {
      return 'lidar';
    }
    if (supportsPhotogrammetry) {
      return 'photogrammetry';
    }
    return 'template';
  }, []);

  // Event handlers that should be passed to BodyScanner3DView
  const handleScanProgress = useCallback((event: { nativeEvent: { progress: ScanProgress } }) => {
    const progress = event.nativeEvent.progress;
    setScanProgress(progress);

    // Update photogrammetry-specific progress if available
    if ('photosCaptured' in progress) {
      setPhotogrammetryProgress(progress as unknown as PhotogrammetryProgress);
    }
  }, []);

  const handleScanComplete = useCallback((event: { nativeEvent: { result: ScanResult } }) => {
    const result = event.nativeEvent.result;
    setScanResult(result);
    setIsScanning(false);
    setScanProgress((prev) => prev ? { ...prev, state: 'complete' as ScanState } : null);

    if (result.success) {
      // Add to history
      setScanHistory((prev) => [result, ...prev]);
    } else {
      setError(result.error || 'Scan failed');
    }
  }, []);

  const handleScanError = useCallback((event: { nativeEvent: { error: string; code: string } }) => {
    setError(event.nativeEvent.error);
    setIsScanning(false);
    setScanProgress((prev) => prev ? { ...prev, state: 'error' as ScanState } : null);
  }, []);

  return {
    // Capabilities
    capabilities,
    isCapabilitiesLoading,

    // Current scan state
    scanProgress,
    photogrammetryProgress,
    isScanning,
    scanResult,
    error,

    // Scan control
    startScan,
    stopScan,
    capturePhoto,

    // History
    scanHistory,
    loadScanHistory,
    deleteExistingScan,

    // Utilities
    checkMeshExists,
    getBestScanMethod,
    scannerRef,
  };
}
