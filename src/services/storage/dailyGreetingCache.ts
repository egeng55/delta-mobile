import {
  createCacheEnvelope,
  readCacheEnvelope,
} from './cachePolicy';

export const DAILY_GREETING_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const DAILY_GREETING_MAX_LENGTH = 1200;

export interface DailyGreetingReadResult {
  message: string | null;
  expired: boolean;
  invalid: boolean;
  fromLegacy: boolean;
}

export function dailyGreetingCacheKey(userId: string, date: string): string {
  return `delta-greeting-${userId}-${date}`;
}

function sanitizeGreetingMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith('data:image/') || trimmed.length > DAILY_GREETING_MAX_LENGTH) {
    return null;
  }
  return trimmed;
}

export function createDailyGreetingCache(
  message: string,
  now: number = Date.now()
): string {
  const sanitized = sanitizeGreetingMessage(message) ?? '';
  return JSON.stringify(createCacheEnvelope(sanitized, DAILY_GREETING_CACHE_TTL_MS, {
    category: 'daily_generated_greeting',
    maxLength: DAILY_GREETING_MAX_LENGTH,
  }, now));
}

export function readDailyGreetingCache(
  raw: string | null,
  now: number = Date.now()
): DailyGreetingReadResult {
  const envelope = readCacheEnvelope<string>(raw, now);

  if (envelope.status === 'hit') {
    const message = sanitizeGreetingMessage(envelope.value);
    return {
      message,
      expired: false,
      invalid: message === null,
      fromLegacy: false,
    };
  }

  if (envelope.status === 'expired') {
    return { message: null, expired: true, invalid: false, fromLegacy: false };
  }

  if (envelope.status === 'invalid') {
    const trimmed = raw?.trim() ?? '';
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      const legacy = sanitizeGreetingMessage(raw);
      if (legacy) {
        return { message: legacy, expired: false, invalid: false, fromLegacy: true };
      }
    }
  }

  if (envelope.status === 'empty' || envelope.status === 'invalid') {
    return {
      message: null,
      expired: false,
      invalid: envelope.status === 'invalid',
      fromLegacy: false,
    };
  }

  const legacy = sanitizeGreetingMessage(raw);
  return legacy
    ? { message: legacy, expired: false, invalid: false, fromLegacy: true }
    : { message: null, expired: false, invalid: true, fromLegacy: false };
}
