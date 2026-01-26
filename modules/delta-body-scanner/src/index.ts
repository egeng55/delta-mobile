import { requireNativeModule, NativeModulesProxy, EventEmitter } from 'expo-modules-core';
import type {
  ScanCapabilities,
  ScanResult,
  ScanProgressEvent,
  ScanCompleteEvent,
  ScanErrorEvent,
  MeshUpdateEvent,
} from './DeltaBodyScanner.types';

// Import and re-export types
export * from './DeltaBodyScanner.types';

// Export components
export { BodyScanner3DView } from './BodyScanner3DView';
export { Model3DViewer } from './Model3DViewer';

// Export hook
export { useBodyScanner } from './hooks/useBodyScanner';

// Get the native module - may be null if not available
let DeltaBodyScanner: any = null;
try {
  DeltaBodyScanner = requireNativeModule('DeltaBodyScanner');
  console.log('[DeltaBodyScanner] Native module loaded:', DeltaBodyScanner ? 'YES' : 'NO');
  console.log('[DeltaBodyScanner] hasLiDAR constant:', DeltaBodyScanner?.hasLiDAR);
  console.log('[DeltaBodyScanner] getCapabilities available:', typeof DeltaBodyScanner?.getCapabilities);
} catch (e) {
  console.log('[DeltaBodyScanner] Failed to load native module:', e);
}

// Create event emitter
const emitter = new EventEmitter(DeltaBodyScanner ?? NativeModulesProxy.DeltaBodyScanner);

// Module constants (synchronous) - with safe defaults
export const hasLiDAR: boolean = DeltaBodyScanner?.hasLiDAR ?? false;
export const supportsPhotogrammetry: boolean = DeltaBodyScanner?.supportsPhotogrammetry ?? false;
export const supportsARKit: boolean = (DeltaBodyScanner as any)?.supportsARKit ?? false;

// Async functions
export async function getCapabilities(): Promise<ScanCapabilities> {
  console.log('[DeltaBodyScanner] getCapabilities called, module exists:', !!DeltaBodyScanner);

  if (!DeltaBodyScanner?.getCapabilities) {
    console.log('[DeltaBodyScanner] getCapabilities not available, returning defaults');
    return {
      hasLiDAR: false,
      supportsPhotogrammetry: false,
      supportedMethods: ['template'],
      deviceModel: 'unknown',
      iosVersion: 'unknown',
    };
  }

  try {
    const caps = await DeltaBodyScanner.getCapabilities();
    console.log('[DeltaBodyScanner] getCapabilities result:', JSON.stringify(caps));
    return caps;
  } catch (e) {
    console.log('[DeltaBodyScanner] getCapabilities error:', e);
    return {
      hasLiDAR: false,
      supportsPhotogrammetry: false,
      supportedMethods: ['template'],
      deviceModel: 'unknown',
      iosVersion: 'unknown',
    };
  }
}

export async function startLiDARScan(): Promise<void> {
  return DeltaBodyScanner?.startLiDARScan?.();
}

export async function startPhotogrammetryScan(): Promise<void> {
  return DeltaBodyScanner?.startPhotogrammetryScan?.();
}

export async function exportMesh(format: 'usdz' | 'glb'): Promise<{ fileUri: string }> {
  return DeltaBodyScanner?.exportMesh?.(format);
}

export async function deleteScan(scanId: string): Promise<boolean> {
  return DeltaBodyScanner?.deleteScan?.(scanId) ?? false;
}

export async function getScanHistory(): Promise<ScanResult[]> {
  return DeltaBodyScanner?.getScanHistory?.() ?? [];
}

export async function meshExists(fileUri: string): Promise<boolean> {
  return (DeltaBodyScanner as any)?.meshExists?.(fileUri) ?? false;
}

export async function getMeshFileSize(fileUri: string): Promise<number> {
  return (DeltaBodyScanner as any)?.getMeshFileSize?.(fileUri) ?? 0;
}

// Event subscriptions
export function addScanProgressListener(
  listener: (event: ScanProgressEvent) => void
) {
  // @ts-ignore - EventEmitter typing issue with expo-modules-core
  return emitter.addListener('onScanProgress', listener);
}

export function addScanCompleteListener(
  listener: (event: ScanCompleteEvent) => void
) {
  // @ts-ignore - EventEmitter typing issue with expo-modules-core
  return emitter.addListener('onScanComplete', listener);
}

export function addScanErrorListener(
  listener: (event: ScanErrorEvent) => void
) {
  // @ts-ignore - EventEmitter typing issue with expo-modules-core
  return emitter.addListener('onScanError', listener);
}

export function addMeshUpdateListener(
  listener: (event: MeshUpdateEvent) => void
) {
  // @ts-ignore - EventEmitter typing issue with expo-modules-core
  return emitter.addListener('onMeshUpdate', listener);
}

// Default export for convenience
export default {
  hasLiDAR,
  supportsPhotogrammetry,
  supportsARKit,
  getCapabilities,
  startLiDARScan,
  startPhotogrammetryScan,
  exportMesh,
  deleteScan,
  getScanHistory,
  meshExists,
  getMeshFileSize,
  addScanProgressListener,
  addScanCompleteListener,
  addScanErrorListener,
  addMeshUpdateListener,
};
