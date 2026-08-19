import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorCode,
  type ExpoSpeechRecognitionNativeEventMap,
} from 'expo-speech-recognition';

export interface SpeechRecognitionCallbacks {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: SpeechRecognitionFailure) => void;
  onEnd: () => void;
}

export interface SpeechRecognitionFailure {
  code: ExpoSpeechRecognitionErrorCode | 'start-failed';
  message: string;
}

export interface SpeechRecognitionAdapter {
  start: (locale?: string) => Promise<void>;
  stop: () => void;
  cancel: () => void;
  destroy: () => void;
}

export class SpeechRecognitionUnavailableError extends Error {
  constructor() {
    super('Speech recognition is unavailable on this device.');
    this.name = 'SpeechRecognitionUnavailableError';
  }
}

export class SpeechRecognitionPermissionDeniedError extends Error {
  constructor() {
    super('Speech recognition permission was denied.');
    this.name = 'SpeechRecognitionPermissionDeniedError';
  }
}

type NativeSpeechRecognitionModule = typeof ExpoSpeechRecognitionModule;
type NativeSubscription = { remove: () => void };

export function createSpeechRecognitionAdapter(
  callbacks: SpeechRecognitionCallbacks,
  nativeModule: NativeSpeechRecognitionModule = ExpoSpeechRecognitionModule
): SpeechRecognitionAdapter {
  let active = false;
  let disposed = false;
  let suppressAbortError = false;
  let operation = 0;

  const subscriptions: NativeSubscription[] = [
    nativeModule.addListener('result', (event: ExpoSpeechRecognitionNativeEventMap['result']) => {
      const transcript = event.results[0]?.transcript.trim();
      if (transcript) callbacks.onResult(transcript, event.isFinal);
    }),
    nativeModule.addListener('error', (event: ExpoSpeechRecognitionNativeEventMap['error']) => {
      active = false;
      if (suppressAbortError && event.error === 'aborted') return;
      callbacks.onError({ code: event.error, message: event.message });
    }),
    nativeModule.addListener('end', () => {
      active = false;
      suppressAbortError = false;
      callbacks.onEnd();
    }),
  ];

  return {
    async start(locale = 'en-US'): Promise<void> {
      if (disposed) throw new Error('Speech recognition adapter has been destroyed.');
      if (!nativeModule.isRecognitionAvailable()) {
        throw new SpeechRecognitionUnavailableError();
      }

      const startOperation = ++operation;
      const permission = await nativeModule.requestPermissionsAsync();
      if (disposed || startOperation !== operation) return;
      if (!permission.granted) {
        throw new SpeechRecognitionPermissionDeniedError();
      }

      suppressAbortError = false;
      try {
        nativeModule.start({
          lang: locale,
          interimResults: true,
          maxAlternatives: 1,
          continuous: false,
        });
        active = true;
      } catch (error) {
        active = false;
        throw error;
      }
    },

    stop(): void {
      operation += 1;
      if (!active || disposed) return;
      nativeModule.stop();
      active = false;
    },

    cancel(): void {
      operation += 1;
      if (!active || disposed) return;
      suppressAbortError = true;
      nativeModule.abort();
      active = false;
    },

    destroy(): void {
      if (disposed) return;
      operation += 1;
      if (active) {
        suppressAbortError = true;
        nativeModule.abort();
        active = false;
      }
      subscriptions.forEach(subscription => subscription.remove());
      disposed = true;
    },
  };
}
