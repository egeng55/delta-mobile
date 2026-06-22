import AsyncStorage from '@react-native-async-storage/async-storage';

export const OFFLINE_HEALTH_CACHE_SCHEMA_VERSION = 1;
export const OFFLINE_HEALTH_CACHE_KIND = 'offline_health_cache';
export const OFFLINE_HEALTH_CACHE_PREFIX = 'delta_cache_';
export const OFFLINE_HEALTH_CACHE_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export const OFFLINE_HEALTH_CACHE_TTLS_MS: Record<string, number> = {
  insights: 30 * 60 * 1000,
  workout: 60 * 60 * 1000,
  calendar: 24 * 60 * 60 * 1000,
  derivatives: 60 * 60 * 1000,
  profile: 24 * 60 * 60 * 1000,
  menstrual: 24 * 60 * 60 * 1000,
};

type OfflineCacheSensitivity = 'low' | 'medium' | 'high';

interface OfflineHealthCachePolicy {
  ttlMs: number;
  sensitivity: OfflineCacheSensitivity;
  maxArrayItems: number;
  classification: string[];
}

export const OFFLINE_HEALTH_CACHE_POLICIES: Record<string, OfflineHealthCachePolicy> = {
  insights: {
    ttlMs: OFFLINE_HEALTH_CACHE_TTLS_MS.insights,
    sensitivity: 'high',
    maxArrayItems: 50,
    classification: ['ttl_needed', 'minimization_needed'],
  },
  workout: {
    ttlMs: OFFLINE_HEALTH_CACHE_TTLS_MS.workout,
    sensitivity: 'high',
    maxArrayItems: 50,
    classification: ['ttl_needed', 'minimization_needed'],
  },
  calendar: {
    ttlMs: OFFLINE_HEALTH_CACHE_TTLS_MS.calendar,
    sensitivity: 'high',
    maxArrayItems: 62,
    classification: ['ttl_needed', 'minimization_needed'],
  },
  derivatives: {
    ttlMs: OFFLINE_HEALTH_CACHE_TTLS_MS.derivatives,
    sensitivity: 'high',
    maxArrayItems: 50,
    classification: ['ttl_needed', 'minimization_needed'],
  },
  profile: {
    ttlMs: OFFLINE_HEALTH_CACHE_TTLS_MS.profile,
    sensitivity: 'high',
    maxArrayItems: 50,
    classification: ['ttl_needed', 'minimization_needed'],
  },
  menstrual: {
    ttlMs: OFFLINE_HEALTH_CACHE_TTLS_MS.menstrual,
    sensitivity: 'high',
    maxArrayItems: 62,
    classification: ['ttl_needed', 'minimization_needed'],
  },
};

const TOKEN_LIKE_KEYS = new Set([
  'authorization',
  'auth',
  'bearer',
  'token',
  'accesstoken',
  'access_token',
  'refresh_token',
  'refreshtoken',
  'session_token',
  'sessiontoken',
  'id_token',
  'idtoken',
  'jwt',
  'password',
  'secret',
  'api_key',
  'apikey',
  'cookie',
  'cookies',
  'headers',
]);

const RAW_BLOB_KEYS = [
  'base64',
  'blob',
  'bytes',
  'rawimage',
  'rawphoto',
  'imagedata',
  'photodata',
  'capturedata',
  'frame',
  'frames',
];

export type OfflineHealthCacheReadStatus = 'empty' | 'hit' | 'expired' | 'legacy' | 'malformed';

export interface OfflineHealthCacheReadResult<T> {
  data: T | null;
  status: OfflineHealthCacheReadStatus;
  fromLegacy: boolean;
  storageCleared: boolean;
}

export interface OfflineHealthCacheEnvelope<T> {
  schemaVersion: typeof OFFLINE_HEALTH_CACHE_SCHEMA_VERSION;
  kind: typeof OFFLINE_HEALTH_CACHE_KIND;
  resource: string;
  createdAt: number;
  updatedAt: number;
  ttlMs: number;
  expiresAt: number;
  sensitivity: OfflineCacheSensitivity;
  classification: string[];
  data: T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

function shouldDropKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return TOKEN_LIKE_KEYS.has(normalized) ||
    RAW_BLOB_KEYS.some((unsafe) => normalized.includes(unsafe));
}

function looksLikeRawBlobString(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:application/octet-stream')) {
    return true;
  }
  return trimmed.length > 50_000 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed);
}

export function getOfflineHealthCachePolicy(
  resource: string,
  customTtlMs?: number
): OfflineHealthCachePolicy {
  const policy = OFFLINE_HEALTH_CACHE_POLICIES[resource] ?? {
    ttlMs: OFFLINE_HEALTH_CACHE_DEFAULT_TTL_MS,
    sensitivity: 'medium' as const,
    maxArrayItems: 100,
    classification: ['ttl_needed'],
  };

  const ttlMs = Number.isFinite(customTtlMs) && customTtlMs !== undefined && customTtlMs > 0
    ? Math.min(customTtlMs, policy.ttlMs)
    : policy.ttlMs;

  return {
    ...policy,
    ttlMs,
  };
}

export function offlineHealthCacheStorageKey(resource: string, userId?: string): string {
  return userId
    ? `${OFFLINE_HEALTH_CACHE_PREFIX}${resource}_${userId}`
    : `${OFFLINE_HEALTH_CACHE_PREFIX}${resource}`;
}

export function sanitizeOfflineHealthCachePayload(
  value: unknown,
  maxArrayItems: number = 100
): unknown {
  if (Array.isArray(value)) {
    return value
      .slice(0, Math.max(0, maxArrayItems))
      .map((item) => sanitizeOfflineHealthCachePayload(item, maxArrayItems))
      .filter((item) => item !== undefined);
  }

  if (isRecord(value)) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (shouldDropKey(key)) continue;
      const sanitizedValue = sanitizeOfflineHealthCachePayload(item, maxArrayItems);
      if (sanitizedValue !== undefined) sanitized[key] = sanitizedValue;
    }
    return sanitized;
  }

  if (typeof value === 'string') {
    return looksLikeRawBlobString(value) ? undefined : value;
  }

  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  return undefined;
}

function createEnvelope<T>(
  resource: string,
  data: T,
  policy: OfflineHealthCachePolicy,
  now: number
): OfflineHealthCacheEnvelope<T> {
  return {
    schemaVersion: OFFLINE_HEALTH_CACHE_SCHEMA_VERSION,
    kind: OFFLINE_HEALTH_CACHE_KIND,
    resource,
    createdAt: now,
    updatedAt: now,
    ttlMs: policy.ttlMs,
    expiresAt: now + policy.ttlMs,
    sensitivity: policy.sensitivity,
    classification: policy.classification,
    data,
  };
}

function parseStoredCache<T>(
  resource: string,
  raw: string | null,
  now: number
): OfflineHealthCacheReadResult<T> & { shouldRewrite: boolean } {
  if (raw === null || raw.trim() === '') {
    return {
      data: null,
      status: 'empty',
      fromLegacy: false,
      storageCleared: false,
      shouldRewrite: false,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      data: null,
      status: 'malformed',
      fromLegacy: false,
      storageCleared: true,
      shouldRewrite: true,
    };
  }

  const policy = getOfflineHealthCachePolicy(resource);
  const isEnvelope = isRecord(parsed) &&
    parsed.schemaVersion === OFFLINE_HEALTH_CACHE_SCHEMA_VERSION &&
    parsed.kind === OFFLINE_HEALTH_CACHE_KIND &&
    Object.prototype.hasOwnProperty.call(parsed, 'data');

  if (isEnvelope) {
    if (typeof parsed.expiresAt !== 'number' || now >= parsed.expiresAt) {
      return {
        data: null,
        status: 'expired',
        fromLegacy: false,
        storageCleared: true,
        shouldRewrite: true,
      };
    }

    const sanitizedData = sanitizeOfflineHealthCachePayload(
      parsed.data,
      policy.maxArrayItems
    ) as T;
    return {
      data: sanitizedData,
      status: 'hit',
      fromLegacy: false,
      storageCleared: false,
      shouldRewrite: JSON.stringify(parsed.data) !== JSON.stringify(sanitizedData),
    };
  }

  if (isRecord(parsed) && Object.prototype.hasOwnProperty.call(parsed, 'data')) {
    const expiresAt = typeof parsed.expiresAt === 'number'
      ? parsed.expiresAt
      : typeof parsed.timestamp === 'number'
        ? parsed.timestamp + policy.ttlMs
        : now + policy.ttlMs;

    if (now >= expiresAt) {
      return {
        data: null,
        status: 'expired',
        fromLegacy: true,
        storageCleared: true,
        shouldRewrite: true,
      };
    }

    const sanitizedData = sanitizeOfflineHealthCachePayload(
      parsed.data,
      policy.maxArrayItems
    ) as T;
    return {
      data: sanitizedData,
      status: 'legacy',
      fromLegacy: true,
      storageCleared: false,
      shouldRewrite: true,
    };
  }

  const sanitizedData = sanitizeOfflineHealthCachePayload(parsed, policy.maxArrayItems) as T;
  if (sanitizedData === undefined) {
    return {
      data: null,
      status: 'malformed',
      fromLegacy: false,
      storageCleared: true,
      shouldRewrite: true,
    };
  }

  return {
    data: sanitizedData,
    status: 'legacy',
    fromLegacy: true,
    storageCleared: false,
    shouldRewrite: true,
  };
}

export async function saveOfflineHealthCache<T>(
  resource: string,
  data: T,
  userId?: string,
  customTtlMs?: number,
  now: number = Date.now()
): Promise<void> {
  const policy = getOfflineHealthCachePolicy(resource, customTtlMs);
  const sanitizedData = sanitizeOfflineHealthCachePayload(data, policy.maxArrayItems) as T;

  await AsyncStorage.setItem(
    offlineHealthCacheStorageKey(resource, userId),
    JSON.stringify(createEnvelope(resource, sanitizedData, policy, now))
  );
}

export async function readOfflineHealthCache<T>(
  resource: string,
  userId?: string,
  now: number = Date.now()
): Promise<OfflineHealthCacheReadResult<T>> {
  const key = offlineHealthCacheStorageKey(resource, userId);
  const raw = await AsyncStorage.getItem(key);
  const result = parseStoredCache<T>(resource, raw, now);

  if (result.shouldRewrite) {
    if (result.data !== null) {
      await saveOfflineHealthCache(resource, result.data, userId, undefined, now);
    } else {
      await AsyncStorage.removeItem(key);
    }
  }

  return {
    data: result.data,
    status: result.status,
    fromLegacy: result.fromLegacy,
    storageCleared: result.storageCleared,
  };
}

export async function clearOfflineHealthCache(resource: string, userId?: string): Promise<void> {
  await AsyncStorage.removeItem(offlineHealthCacheStorageKey(resource, userId));
}
