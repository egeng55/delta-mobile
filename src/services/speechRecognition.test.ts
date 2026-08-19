import type { ExpoSpeechRecognitionNativeEventMap } from 'expo-speech-recognition';
import {
  createSpeechRecognitionAdapter,
  SpeechRecognitionPermissionDeniedError,
  SpeechRecognitionUnavailableError,
} from './speechRecognition';

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {},
}));

type EventName = keyof ExpoSpeechRecognitionNativeEventMap;
type Listener = (event: unknown) => void;

function createNativeModule(options: { available?: boolean; granted?: boolean } = {}) {
  const listeners = new Map<EventName, Listener>();
  const removers: jest.Mock[] = [];
  const module = {
    isRecognitionAvailable: jest.fn(() => options.available ?? true),
    requestPermissionsAsync: jest.fn(async () => ({ granted: options.granted ?? true })),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    addListener: jest.fn((event: EventName, listener: Listener) => {
      listeners.set(event, listener);
      const remove = jest.fn(() => listeners.delete(event));
      removers.push(remove);
      return { remove };
    }),
  };

  return {
    module,
    removers,
    emit<K extends EventName>(event: K, payload: ExpoSpeechRecognitionNativeEventMap[K]) {
      listeners.get(event)?.(payload);
    },
  };
}

function createCallbacks() {
  return {
    onResult: jest.fn(),
    onError: jest.fn(),
    onEnd: jest.fn(),
  };
}

describe('speechRecognition adapter', () => {
  it('rejects permission denial without starting recognition', async () => {
    const native = createNativeModule({ granted: false });
    const adapter = createSpeechRecognitionAdapter(createCallbacks(), native.module as never);

    await expect(adapter.start()).rejects.toBeInstanceOf(SpeechRecognitionPermissionDeniedError);
    expect(native.module.start).not.toHaveBeenCalled();
  });

  it('rejects unavailable recognition services before requesting permission', async () => {
    const native = createNativeModule({ available: false });
    const adapter = createSpeechRecognitionAdapter(createCallbacks(), native.module as never);

    await expect(adapter.start()).rejects.toBeInstanceOf(SpeechRecognitionUnavailableError);
    expect(native.module.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(native.module.start).not.toHaveBeenCalled();
  });

  it('starts with bounded options and forwards partial and final results', async () => {
    const native = createNativeModule();
    const callbacks = createCallbacks();
    const adapter = createSpeechRecognitionAdapter(callbacks, native.module as never);

    await adapter.start('en-GB');
    expect(native.module.start).toHaveBeenCalledWith({
      lang: 'en-GB',
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
    });

    native.emit('result', {
      isFinal: false,
      results: [{ transcript: 'partial result', confidence: 0, segments: [] }],
    });
    native.emit('result', {
      isFinal: true,
      results: [{ transcript: 'final result', confidence: 0.9, segments: [] }],
    });

    expect(callbacks.onResult).toHaveBeenNthCalledWith(1, 'partial result', false);
    expect(callbacks.onResult).toHaveBeenNthCalledWith(2, 'final result', true);
  });

  it('stops an active recognition session once', async () => {
    const native = createNativeModule();
    const adapter = createSpeechRecognitionAdapter(createCallbacks(), native.module as never);

    await adapter.start();
    adapter.stop();
    adapter.stop();

    expect(native.module.stop).toHaveBeenCalledTimes(1);
  });

  it('forwards native recognition errors', async () => {
    const native = createNativeModule();
    const callbacks = createCallbacks();
    createSpeechRecognitionAdapter(callbacks, native.module as never);

    native.emit('error', { error: 'network', message: 'Network unavailable', code: 2 });

    expect(callbacks.onError).toHaveBeenCalledWith({
      code: 'network',
      message: 'Network unavailable',
    });
  });

  it('cancels without surfacing the expected aborted error', async () => {
    const native = createNativeModule();
    const callbacks = createCallbacks();
    const adapter = createSpeechRecognitionAdapter(callbacks, native.module as never);

    await adapter.start();
    adapter.cancel();
    native.emit('error', { error: 'aborted', message: 'Recognition aborted' });

    expect(native.module.abort).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('cancels a pending permission request before native recognition starts', async () => {
    let resolvePermission: ((permission: { granted: boolean }) => void) | undefined;
    const native = createNativeModule();
    native.module.requestPermissionsAsync.mockImplementation(
      () => new Promise(resolve => { resolvePermission = resolve; })
    );
    const adapter = createSpeechRecognitionAdapter(createCallbacks(), native.module as never);

    const start = adapter.start();
    adapter.cancel();
    resolvePermission?.({ granted: true });
    await start;

    expect(native.module.start).not.toHaveBeenCalled();
    expect(native.module.abort).not.toHaveBeenCalled();
  });

  it('tears down an active session and removes every listener exactly once', async () => {
    const native = createNativeModule();
    const adapter = createSpeechRecognitionAdapter(createCallbacks(), native.module as never);

    await adapter.start();
    adapter.destroy();
    adapter.destroy();

    expect(native.module.abort).toHaveBeenCalledTimes(1);
    expect(native.removers).toHaveLength(3);
    native.removers.forEach(remove => expect(remove).toHaveBeenCalledTimes(1));
  });

  it('reports normal recognition completion', () => {
    const native = createNativeModule();
    const callbacks = createCallbacks();
    createSpeechRecognitionAdapter(callbacks, native.module as never);

    native.emit('end', null);

    expect(callbacks.onEnd).toHaveBeenCalledTimes(1);
  });
});
