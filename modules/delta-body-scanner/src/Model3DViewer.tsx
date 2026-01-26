import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { requireNativeViewManager } from 'expo-modules-core';
import type { Model3DViewerProps } from './DeltaBodyScanner.types';

// Get the native view
const NativeModel3DView = requireNativeViewManager('DeltaBodyScanner');

export interface Model3DViewerRef {
  resetCamera: () => void;
  snapshot: () => Promise<string | null>;
}

export const Model3DViewer = forwardRef<Model3DViewerRef, Model3DViewerProps>(
  (
    {
      modelUri,
      autoRotate = true,
      allowUserInteraction = true,
      backgroundColor = '#000000',
      lightingIntensity = 1.0,
      initialRotation,
      onModelLoaded,
      onModelError,
      style,
      ...props
    },
    ref
  ) => {
    const nativeRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      resetCamera: () => {
        nativeRef.current?.resetCamera?.();
      },
      snapshot: async () => {
        return nativeRef.current?.snapshot?.() ?? null;
      },
    }));

    return (
      <NativeModel3DView
        ref={nativeRef}
        modelUri={modelUri}
        autoRotate={autoRotate}
        allowUserInteraction={allowUserInteraction}
        backgroundColor={backgroundColor}
        lightingIntensity={lightingIntensity}
        onModelLoaded={() => {
          onModelLoaded?.();
        }}
        onModelError={(event: { nativeEvent: { error: string } }) => {
          onModelError?.(event);
        }}
        style={[{ flex: 1 }, style]}
        {...props}
      />
    );
  }
);

Model3DViewer.displayName = 'Model3DViewer';
