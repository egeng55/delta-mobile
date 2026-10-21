import { Platform } from 'react-native';

export function newClientId(): string {
  // Expo's native UUID generator is installed by the existing Expo runtime.
  // Do not rely on browser-only crypto globals or weak random fallbacks.
  const runtime = globalThis as typeof globalThis & { expo?: { uuidv4?: () => string } };
  const id = Platform.OS === 'web'
    ? globalThis.crypto?.randomUUID?.()
    : runtime.expo?.uuidv4?.();
  if (!id || !isCanonicalConversationId(id)) throw new Error('Secure ID generation is unavailable');
  return id;
}

export function isCanonicalConversationId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
