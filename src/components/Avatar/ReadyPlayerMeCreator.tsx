/**
 * ReadyPlayerMeCreator - WebView-based avatar creator
 *
 * Embeds Ready Player Me's avatar creator and returns the avatar URL
 * when the user completes avatar creation.
 */

import React, { useRef, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  parseAvatarUrl,
  RPMAvatarResult,
} from '../../services/readyPlayerMe';
import { Theme } from '../../theme/colors';

interface ReadyPlayerMeCreatorProps {
  theme: Theme;
  onComplete: (avatar: RPMAvatarResult) => void;
  onClose: () => void;
}

export default function ReadyPlayerMeCreator({
  theme,
  onComplete,
  onClose,
}: ReadyPlayerMeCreatorProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusText, setStatusText] = useState('Loading avatar creator...');

  // Use demo subdomain (or your own from RPM Studio)
  const avatarCreatorUrl = 'https://demo.readyplayer.me/avatar?frameApi';

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const data = event.nativeEvent.data;
      console.log('[RPM] Raw message:', data);

      try {
        const json = JSON.parse(data);
        console.log('[RPM] Parsed message:', json);

        // Check if it's from Ready Player Me
        if (json.source !== 'readyplayerme') {
          return;
        }

        console.log('[RPM] Event:', json.eventName);

        switch (json.eventName) {
          case 'v1.frame.ready':
            // Frame is ready - subscribe to all events
            console.log('[RPM] Frame ready, subscribing to events...');
            setStatusText('Ready! Create your avatar.');
            setIsLoading(false);

            // Send subscribe message back to iframe
            webViewRef.current?.injectJavaScript(`
              window.postMessage(JSON.stringify({
                target: 'readyplayerme',
                type: 'subscribe',
                eventName: 'v1.**'
              }), '*');
              true;
            `);
            break;

          case 'v1.avatar.exported':
            // Avatar creation complete!
            console.log('[RPM] Avatar exported:', json.data);
            if (json.data?.url) {
              const result = parseAvatarUrl(json.data.url);
              console.log('[RPM] Parsed result:', result);
              onComplete(result);
            }
            break;

          case 'v1.user.set':
            console.log('[RPM] User set:', json.data?.id);
            break;

          case 'v1.user.logout':
            console.log('[RPM] User logged out');
            break;

          default:
            console.log('[RPM] Other event:', json.eventName, json.data);
        }
      } catch (e) {
        // Not a JSON message, ignore
        console.log('[RPM] Non-JSON message:', data);
      }
    },
    [onComplete]
  );

  // JavaScript to inject into WebView to forward postMessage events
  const injectedJavaScript = `
    (function() {
      // Override window.postMessage to capture outgoing messages
      const originalPostMessage = window.postMessage;

      // Listen for messages from the iframe content
      window.addEventListener('message', function(event) {
        // Forward to React Native
        if (window.ReactNativeWebView && event.data) {
          try {
            const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
            window.ReactNativeWebView.postMessage(data);
          } catch(e) {
            console.log('Error forwarding message:', e);
          }
        }
      });

      // Also listen on document
      document.addEventListener('message', function(event) {
        if (window.ReactNativeWebView && event.data) {
          try {
            const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
            window.ReactNativeWebView.postMessage(data);
          } catch(e) {
            console.log('Error forwarding message:', e);
          }
        }
      });

      console.log('[RPM WebView] Message listeners attached');
      true;
    })();
  `;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: theme.background,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          Create Your Avatar
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* WebView */}
      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: avatarCreatorUrl }}
          style={styles.webView}
          onMessage={handleMessage}
          injectedJavaScript={injectedJavaScript}
          onLoadStart={() => {
            setIsLoading(true);
            setStatusText('Loading avatar creator...');
          }}
          onLoadEnd={() => {
            console.log('[RPM] WebView loaded');
          }}
          onError={(e) => {
            console.log('[RPM] WebView error:', e.nativeEvent);
            setStatusText('Error loading. Please try again.');
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          startInLoadingState={false}
          scalesPageToFit={true}
          allowsFullscreenVideo={true}
          // Required for camera access
          mediaCapturePermissionGrantType="grant"
          allowsBackForwardNavigationGestures={false}
          // Enable camera/mic permissions
          allowsProtectedMedia={true}
        />

        {isLoading && (
          <View style={[styles.loadingOverlay, { backgroundColor: theme.background }]}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              {statusText}
            </Text>
          </View>
        )}
      </View>

      {/* Info footer */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 8,
            backgroundColor: theme.surface,
          },
        ]}
      >
        <Ionicons
          name="information-circle-outline"
          size={16}
          color={theme.textSecondary}
        />
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          Customize your avatar, then tap "Next" → "Done" to finish
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
