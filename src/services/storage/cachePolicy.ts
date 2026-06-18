export interface CacheEnvelope<T> {
  version: 1;
  data: T;
  createdAt: number;
  expiresAt: number;
  metadata?: Record<string, unknown>;
}

export type CacheEnvelopeReadStatus = 'empty' | 'hit' | 'expired' | 'not-envelope' | 'invalid';

export interface CacheEnvelopeReadResult<T> {
  status: CacheEnvelopeReadStatus;
  value: T | null;
  envelope: CacheEnvelope<T> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCacheEnvelope<T>(value: unknown): value is CacheEnvelope<T> {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    typeof value.createdAt === 'number' &&
    typeof value.expiresAt === 'number' &&
    Object.prototype.hasOwnProperty.call(value, 'data')
  );
}

export function createCacheEnvelope<T>(
  value: T,
  ttlMs: number,
  metadata?: Record<string, unknown>,
  now: number = Date.now()
): CacheEnvelope<T> {
  const safeTtl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 0;
  return {
    version: 1,
    data: value,
    createdAt: now,
    expiresAt: now + safeTtl,
    ...(metadata ? { metadata } : {}),
  };
}

export function isCacheEnvelopeExpired<T>(
  envelope: CacheEnvelope<T>,
  now: number = Date.now()
): boolean {
  return now >= envelope.expiresAt;
}

export function readCacheEnvelope<T>(
  raw: string | null,
  now: number = Date.now()
): CacheEnvelopeReadResult<T> {
  if (raw === null || raw.trim() === '') {
    return { status: 'empty', value: null, envelope: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'invalid', value: null, envelope: null };
  }

  if (!isCacheEnvelope<T>(parsed)) {
    return { status: 'not-envelope', value: null, envelope: null };
  }

  if (isCacheEnvelopeExpired(parsed, now)) {
    return { status: 'expired', value: null, envelope: parsed };
  }

  return { status: 'hit', value: parsed.data, envelope: parsed };
}

export function trimArrayToLimit<T>(items: readonly T[], maxItems: number): T[] {
  if (!Number.isFinite(maxItems) || maxItems <= 0) return [];
  if (items.length <= maxItems) return [...items];
  return items.slice(0, maxItems);
}

export function trimArrayToMostRecent<T>(items: readonly T[], maxItems: number): T[] {
  if (!Number.isFinite(maxItems) || maxItems <= 0) return [];
  if (items.length <= maxItems) return [...items];
  return items.slice(items.length - maxItems);
}
