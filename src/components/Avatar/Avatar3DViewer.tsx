/**
 * Avatar3DViewer - Displays a 3D avatar model with spinning animation
 *
 * Uses Google's model-viewer in a WebView for reliable GLB rendering.
 * Supports auto-rotation and touch interaction.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Theme } from '../../theme/colors';

interface Avatar3DViewerProps {
  modelUrl: string;
  theme: Theme;
  size?: number;
  autoRotate?: boolean;
  backgroundColor?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export default function Avatar3DViewer({
  modelUrl,
  theme,
  size = 280,
  autoRotate = true,
  backgroundColor,
  onLoad,
  onError,
}: Avatar3DViewerProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bgColor = backgroundColor || theme.surface;

  // HTML page with model-viewer component
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
    }
    model-viewer {
      width: 100%;
      height: 100%;
      background: transparent;
      --poster-color: transparent;
    }
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #888;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <model-viewer
    id="viewer"
    src="${modelUrl}"
    camera-controls
    ${autoRotate ? 'auto-rotate' : ''}
    auto-rotate-delay="0"
    rotation-per-second="12deg"
    camera-orbit="0deg 90deg 4m"
    camera-target="0m 0.9m 0m"
    min-camera-orbit="auto auto 2m"
    max-camera-orbit="auto auto 6m"
    field-of-view="60deg"
    shadow-intensity="0"
    exposure="1.2"
    environment-image="neutral"
  >
    <div class="loading" slot="poster">Loading 3D model...</div>
  </model-viewer>

  <script>
    const viewer = document.getElementById('viewer');

    viewer.addEventListener('load', () => {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'loaded' }));
    });

    viewer.addEventListener('error', (e) => {
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'error',
        message: e.detail?.message || 'Failed to load model'
      }));
    });
  </script>
</body>
</html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'loaded') {
        setIsLoading(false);
        onLoad?.();
      } else if (data.type === 'error') {
        setError(data.message);
        setIsLoading(false);
        onError?.(new Error(data.message));
      }
    } catch (e) {
      // Ignore parse errors
    }
  };

  if (error) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            backgroundColor: theme.surface,
          },
        ]}
      >
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          backgroundColor: 'transparent',
        },
      ]}
    >
      <WebView
        source={{ html }}
        style={[styles.webView, { backgroundColor: 'transparent' }]}
        scrollEnabled={false}
        bounces={false}
        onMessage={handleMessage}
        onLoadEnd={() => {
          // Give model-viewer time to initialize
          setTimeout(() => setIsLoading(false), 1000);
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        allowsBackForwardNavigationGestures={false}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  errorText: {
    textAlign: 'center',
    fontSize: 14,
    padding: 20,
  },
});
