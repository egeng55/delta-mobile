import AsyncStorage from '@react-native-async-storage/async-storage';

export const PENDING_SYNC_STORAGE_KEY = 'delta_pending_sync';
export const PENDING_SYNC_SCHEMA_VERSION = 1;
export const PENDING_SYNC_QUEUE_KIND = 'pending_sync_queue';
export const PENDING_SYNC_TTL_MS = 14 * 24 * 60 * 60 * 1000;

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

export interface PendingSyncItem {
  id: string;
  type: string;
  data: unknown;
  timestamp: number;
  attempts: number;
  schemaVersion: typeof PENDING_SYNC_SCHEMA_VERSION;
  payloadKind: string;
  createdAt: number;
  expiresAt: number;
}

interface PendingSyncQueueEnvelope {
  schemaVersion: typeof PENDING_SYNC_SCHEMA_VERSION;
  kind: typeof PENDING_SYNC_QUEUE_KIND;
  createdAt: number;
  updatedAt: number;
  ttlMs: number;
  items: PendingSyncItem[];
}

export interface PendingSyncReadResult {
  items: PendingSyncItem[];
  expiredCount: number;
  malformedCount: number;
  fromLegacy: boolean;
  storageCleared: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}

function shouldDropKey(key: string): boolean {
  return TOKEN_LIKE_KEYS.has(normalizeKey(key));
}

export function sanitizePendingSyncPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizePendingSyncPayload(item))
      .filter((item) => item !== undefined);
  }

  if (isRecord(value)) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (shouldDropKey(key)) continue;
      const sanitizedValue = sanitizePendingSyncPayload(item);
      if (sanitizedValue !== undefined) sanitized[key] = sanitizedValue;
    }
    return sanitized;
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  return undefined;
}

export function createPendingSyncItem(
  type: string,
  data: unknown,
  now: number = Date.now(),
  id: string = `${now}_${Math.random().toString(36).slice(2, 11)}`
): PendingSyncItem {
  return {
    id,
    type,
    data: sanitizePendingSyncPayload(data),
    timestamp: now,
    attempts: 0,
    schemaVersion: PENDING_SYNC_SCHEMA_VERSION,
    payloadKind: type,
    createdAt: now,
    expiresAt: now + PENDING_SYNC_TTL_MS,
  };
}

function normalizePendingSyncItem(
  value: unknown,
  now: number
): { item: PendingSyncItem | null; malformed: boolean; expired: boolean } {
  if (!isRecord(value)) {
    return { item: null, malformed: true, expired: false };
  }

  const type = typeof value.type === 'string' ? value.type : null;
  const id = typeof value.id === 'string' ? value.id : null;
  if (!type || !id) {
    return { item: null, malformed: true, expired: false };
  }

  const timestamp = typeof value.timestamp === 'number' ? value.timestamp : now;
  const createdAt = typeof value.createdAt === 'number' ? value.createdAt : timestamp;
  const expiresAt = typeof value.expiresAt === 'number'
    ? value.expiresAt
    : createdAt + PENDING_SYNC_TTL_MS;

  if (now >= expiresAt) {
    return { item: null, malformed: false, expired: true };
  }

  return {
    item: {
      id,
      type,
      data: sanitizePendingSyncPayload(value.data),
      timestamp,
      attempts: typeof value.attempts === 'number' ? value.attempts : 0,
      schemaVersion: PENDING_SYNC_SCHEMA_VERSION,
      payloadKind: typeof value.payloadKind === 'string' ? value.payloadKind : type,
      createdAt,
      expiresAt,
    },
    malformed: false,
    expired: false,
  };
}

function parsePendingSyncQueue(
  raw: string | null,
  now: number
): PendingSyncReadResult & { shouldRewrite: boolean } {
  if (raw === null || raw.trim() === '') {
    return {
      items: [],
      expiredCount: 0,
      malformedCount: 0,
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
      items: [],
      expiredCount: 0,
      malformedCount: 1,
      fromLegacy: false,
      storageCleared: true,
      shouldRewrite: true,
    };
  }

  const fromLegacy = Array.isArray(parsed);
  const rawItems = fromLegacy
    ? parsed
    : isRecord(parsed) &&
        parsed.schemaVersion === PENDING_SYNC_SCHEMA_VERSION &&
        parsed.kind === PENDING_SYNC_QUEUE_KIND &&
        Array.isArray(parsed.items)
      ? parsed.items
      : null;

  if (!rawItems) {
    return {
      items: [],
      expiredCount: 0,
      malformedCount: 1,
      fromLegacy: false,
      storageCleared: true,
      shouldRewrite: true,
    };
  }

  let expiredCount = 0;
  let malformedCount = 0;
  const items: PendingSyncItem[] = [];

  for (const rawItem of rawItems) {
    const result = normalizePendingSyncItem(rawItem, now);
    if (result.item) items.push(result.item);
    if (result.expired) expiredCount += 1;
    if (result.malformed) malformedCount += 1;
  }

  return {
    items,
    expiredCount,
    malformedCount,
    fromLegacy,
    storageCleared: false,
    shouldRewrite: fromLegacy || expiredCount > 0 || malformedCount > 0,
  };
}

function createPendingSyncEnvelope(
  items: readonly PendingSyncItem[],
  now: number
): PendingSyncQueueEnvelope {
  const createdAt = items.reduce(
    (oldest, item) => Math.min(oldest, item.createdAt),
    now
  );

  return {
    schemaVersion: PENDING_SYNC_SCHEMA_VERSION,
    kind: PENDING_SYNC_QUEUE_KIND,
    createdAt,
    updatedAt: now,
    ttlMs: PENDING_SYNC_TTL_MS,
    items: items.map((item) => ({
      ...item,
      data: sanitizePendingSyncPayload(item.data),
    })),
  };
}

export async function savePendingSyncItems(
  items: readonly PendingSyncItem[],
  now: number = Date.now()
): Promise<void> {
  const validItems = items
    .map((item) => normalizePendingSyncItem(item, now).item)
    .filter((item): item is PendingSyncItem => item !== null);

  if (validItems.length === 0) {
    await AsyncStorage.removeItem(PENDING_SYNC_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(
    PENDING_SYNC_STORAGE_KEY,
    JSON.stringify(createPendingSyncEnvelope(validItems, now))
  );
}

export async function loadPendingSyncItems(
  now: number = Date.now()
): Promise<PendingSyncReadResult> {
  const raw = await AsyncStorage.getItem(PENDING_SYNC_STORAGE_KEY);
  const result = parsePendingSyncQueue(raw, now);

  if (result.shouldRewrite) {
    if (result.items.length === 0) {
      await AsyncStorage.removeItem(PENDING_SYNC_STORAGE_KEY);
    } else {
      await savePendingSyncItems(result.items, now);
    }
  }

  return {
    items: result.items,
    expiredCount: result.expiredCount,
    malformedCount: result.malformedCount,
    fromLegacy: result.fromLegacy,
    storageCleared: result.storageCleared,
  };
}

export async function appendPendingSyncItem(
  type: string,
  data: unknown,
  now: number = Date.now()
): Promise<PendingSyncItem> {
  const current = await loadPendingSyncItems(now);
  const item = createPendingSyncItem(type, data, now);
  await savePendingSyncItems([...current.items, item], now);
  return item;
}

export async function removePendingSyncItem(
  id: string,
  now: number = Date.now()
): Promise<void> {
  const current = await loadPendingSyncItems(now);
  await savePendingSyncItems(
    current.items.filter((item) => item.id !== id),
    now
  );
}
