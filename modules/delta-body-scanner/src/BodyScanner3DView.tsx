import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { requireNativeViewManager } from 'expo-modules-core';
import type {
  BodyScanner3DViewProps,
  ScanProgressEvent,
  ScanCompleteEvent,
  ScanErrorEvent,
  MeshUpdateEvent,
} from './DeltaBodyScanner.types';

// Get the native view
const NativeBodyScanner3DView = requireNativeViewManager('DeltaBodyScanner');

export interface BodyScanner3DViewRef {
  startScan: () => void;
  stopScan: () => void;
  capturePhoto: () => void;
}

export const BodyScanner3DView = forwardRef<BodyScanner3DViewRef, BodyScanner3DViewProps>(
  (
    {
      scanMethod = 'lidar',
      autoStart = false,
      showGuides = true,
      showMeshPreview = true,
      onScanProgress,
      onScanComplete,
      onScanError,
      onMeshUpdate,
      style,
      ...props
    },
    ref
  ) => {
    const nativeRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      startScan: () => {
        nativeRef.current?.startScan?.();
      },
      stopScan: () => {
        nativeRef.current?.stopScan?.();
      },
      capturePhoto: () => {
        nativeRef.current?.capturePhoto?.();
      },
    }));

    return (
      <NativeBodyScanner3DView
        ref={nativeRef}
        scanMethod={scanMethod}
        autoStart={autoStart}
        showGuides={showGuides}
        showMeshPreview={showMeshPreview}
        onScanProgress={(event: { nativeEvent: ScanProgressEvent }) => {
          onScanProgress?.(event);
        }}
        onScanComplete={(event: { nativeEvent: ScanCompleteEvent }) => {
          onScanComplete?.(event);
        }}
        onScanError={(event: { nativeEvent: ScanErrorEvent }) => {
          onScanError?.(event);
        }}
        onMeshUpdate={(event: { nativeEvent: MeshUpdateEvent }) => {
          onMeshUpdate?.(event);
        }}
        style={[{ flex: 1 }, style]}
        {...props}
      />
    );
  }
);

BodyScanner3DView.displayName = 'BodyScanner3DView';
