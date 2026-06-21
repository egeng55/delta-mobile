import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserAvatar } from '../../types/avatar';
import {
  createSensitiveKey,
  getSensitiveItemWithLegacyFallback,
  setSensitiveItemReplacingLegacy,
} from './sensitiveStorage';

export const AVATAR_BODY_SCAN_SCHEMA_VERSION = 1;
export const AVATAR_BODY_SCAN_KIND = 'avatar_body_scan_metadata';
export const AVATAR_BODY_SCAN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const AVATAR_STORAGE_KEY_PREFIX = '@delta_user_avatar';
export const BODY_SCAN_ENABLED_LEGACY_KEY = '@delta:bodyScanEnabled';
export const BODY_SCAN_ENABLED_SECURE_KEY = createSensitiveKey('body_scan_enabled');

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

const RAW_IMAGE_OR_BLOB_KEYS = [
  'base64',
  'blob',
  'bytes',
  'rawimage',
  'rawphoto',
  'imagedata',
  'photodata',
  'imagebase64',
  'photobase64',
  'capturedata',
  'frame',
  'frames',
];

const PROPORTION_FIELDS = [
  'shoulderWidth',
  'torsoLength',
  'hipWidth',
  'legLength',
  'armLength',
] as const;

const ALLOWED_STYLES = new Set(['minimal', 'geometric', 'soft']);
const ALLOWED_MESH_FORMATS = new Set(['usdz', 'glb']);
const ALLOWED_SCAN_METHODS = new Set(['lidar', 'photogrammetry', 'template', 'readyplayerme']);
const ALLOWED_ANIMATIONS = new Set([
  'idle',
  'celebrate',
  'wave',
  'flex',
  'stretch',
  'sleep',
  'eat',
  'run',
  'meditate',
]);

interface AvatarBodyScanEnvelope {
  schemaVersion: typeof AVATAR_BODY_SCAN_SCHEMA_VERSION;
  kind: typeof AVATAR_BODY_SCAN_KIND;
  createdAt: number;
  updatedAt: number;
  ttlMs: typeof AVATAR_BODY_SCAN_TTL_MS;
  expiresAt: number;
  avatar: UserAvatar;
}

export type AvatarBodyScanReadStatus = 'empty' | 'hit' | 'expired' | 'legacy' | 'malformed';

export interface AvatarBodyScanReadResult {
  avatar: UserAvatar | null;
  status: AvatarBodyScanReadStatus;
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
  const normalized = normalizeKey(key);
  return TOKEN_LIKE_KEYS.has(normalized) ||
    RAW_IMAGE_OR_BLOB_KEYS.some((unsafe) => normalized.includes(unsafe));
}

function isRawImageOrBlobString(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:application/octet-stream')) {
    return true;
  }
  return trimmed.length > 20_000 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed);
}

function safeString(value: unknown, maxLength = 2048): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (value.length === 0 || value.length > maxLength) return undefined;
  if (isRawImageOrBlobString(value)) return undefined;
  return value;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function safeStringArray(value: unknown, maxItems = 50): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => safeString(item, 256))
    .filter((item): item is string => item !== undefined)
    .slice(0, maxItems);
  return items;
}

function safeProportions(value: unknown): UserAvatar['customProportions'] | undefined {
  if (!isRecord(value)) return undefined;
  const result: Record<string, number> = {};
  for (const field of PROPORTION_FIELDS) {
    const numberValue = safeNumber(value[field]);
    if (numberValue === undefined) return undefined;
    result[field] = numberValue;
  }
  return result as UserAvatar['customProportions'];
}

export function sanitizeAvatarBodyScanValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeAvatarBodyScanValue(item))
      .filter((item) => item !== undefined);
  }

  if (isRecord(value)) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (shouldDropKey(key)) continue;
      const sanitizedValue = sanitizeAvatarBodyScanValue(item);
      if (sanitizedValue !== undefined) sanitized[key] = sanitizedValue;
    }
    return sanitized;
  }

  if (typeof value === 'string') {
    return isRawImageOrBlobString(value) ? undefined : value;
  }

  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return undefined;
}

export function sanitizeAvatarBodyScanMetadata(value: unknown): UserAvatar | null {
  const sanitized = sanitizeAvatarBodyScanValue(value);
  if (!isRecord(sanitized)) return null;

  const templateId = safeString(sanitized.templateId, 128);
  const style = safeString(sanitized.style, 32);
  const skinTone = safeString(sanitized.skinTone, 64);
  const accentColor = safeString(sanitized.accentColor, 64);
  const createdAt = safeString(sanitized.createdAt, 128);
  const updatedAt = safeString(sanitized.updatedAt, 128);

  if (!templateId || !style || !ALLOWED_STYLES.has(style) || !skinTone || !accentColor || !createdAt || !updatedAt) {
    return null;
  }

  const avatar: UserAvatar = {
    templateId,
    style: style as UserAvatar['style'],
    skinTone,
    accentColor,
    createdAt,
    updatedAt,
  };

  const customProportions = safeProportions(sanitized.customProportions);
  if (customProportions) avatar.customProportions = customProportions;

  const scanConfidence = safeNumber(sanitized.scanConfidence);
  if (scanConfidence !== undefined) avatar.scanConfidence = scanConfidence;

  const currentOutfitId = safeString(sanitized.currentOutfitId, 128);
  if (currentOutfitId) avatar.currentOutfitId = currentOutfitId;

  const unlockedOutfits = safeStringArray(sanitized.unlockedOutfits);
  if (unlockedOutfits) avatar.unlockedOutfits = unlockedOutfits;

  const achievements = safeStringArray(sanitized.achievements);
  if (achievements) avatar.achievements = achievements;

  const animationPreference = safeString(sanitized.animationPreference, 32);
  if (animationPreference && ALLOWED_ANIMATIONS.has(animationPreference)) {
    avatar.animationPreference = animationPreference as UserAvatar['animationPreference'];
  }

  const meshFileUri = safeString(sanitized.meshFileUri);
  if (meshFileUri) avatar.meshFileUri = meshFileUri;

  const meshFormat = safeString(sanitized.meshFormat, 16);
  if (meshFormat && ALLOWED_MESH_FORMATS.has(meshFormat)) {
    avatar.meshFormat = meshFormat as UserAvatar['meshFormat'];
  }

  const scanMethod = safeString(sanitized.scanMethod, 32);
  if (scanMethod && ALLOWED_SCAN_METHODS.has(scanMethod)) {
    avatar.scanMethod = scanMethod as UserAvatar['scanMethod'];
  }

  const scanDate = safeString(sanitized.scanDate, 128);
  if (scanDate) avatar.scanDate = scanDate;

  const meshThumbnailUri = safeString(sanitized.meshThumbnailUri);
  if (meshThumbnailUri) avatar.meshThumbnailUri = meshThumbnailUri;

  const rpmAvatarUrl = safeString(sanitized.rpmAvatarUrl);
  if (rpmAvatarUrl) avatar.rpmAvatarUrl = rpmAvatarUrl;

  const rpmAvatarId = safeString(sanitized.rpmAvatarId, 512);
  if (rpmAvatarId) avatar.rpmAvatarId = rpmAvatarId;

  const rpmImageUrl = safeString(sanitized.rpmImageUrl);
  if (rpmImageUrl) avatar.rpmImageUrl = rpmImageUrl;

  return avatar;
}

export function avatarBodyScanStorageKey(userId: string): string {
  return `${AVATAR_STORAGE_KEY_PREFIX}_${userId}`;
}

function createEnvelope(avatar: UserAvatar, now: number): AvatarBodyScanEnvelope {
  return {
    schemaVersion: AVATAR_BODY_SCAN_SCHEMA_VERSION,
    kind: AVATAR_BODY_SCAN_KIND,
    createdAt: now,
    updatedAt: now,
    ttlMs: AVATAR_BODY_SCAN_TTL_MS,
    expiresAt: now + AVATAR_BODY_SCAN_TTL_MS,
    avatar,
  };
}

function parseStoredAvatar(
  raw: string | null,
  now: number
): AvatarBodyScanReadResult & { shouldRewrite: boolean } {
  if (raw === null || raw.trim() === '') {
    return {
      avatar: null,
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
      avatar: null,
      status: 'malformed',
      fromLegacy: false,
      storageCleared: true,
      shouldRewrite: true,
    };
  }

  const isEnvelope = isRecord(parsed) &&
    parsed.schemaVersion === AVATAR_BODY_SCAN_SCHEMA_VERSION &&
    parsed.kind === AVATAR_BODY_SCAN_KIND &&
    isRecord(parsed.avatar);

  if (isEnvelope) {
    if (typeof parsed.expiresAt !== 'number' || now >= parsed.expiresAt) {
      return {
        avatar: null,
        status: 'expired',
        fromLegacy: false,
        storageCleared: true,
        shouldRewrite: true,
      };
    }

    const avatar = sanitizeAvatarBodyScanMetadata(parsed.avatar);
    if (!avatar) {
      return {
        avatar: null,
        status: 'malformed',
        fromLegacy: false,
        storageCleared: true,
        shouldRewrite: true,
      };
    }

    return {
      avatar,
      status: 'hit',
      fromLegacy: false,
      storageCleared: false,
      shouldRewrite: JSON.stringify(parsed.avatar) !== JSON.stringify(avatar),
    };
  }

  const legacyAvatar = sanitizeAvatarBodyScanMetadata(parsed);
  if (!legacyAvatar) {
    return {
      avatar: null,
      status: 'malformed',
      fromLegacy: false,
      storageCleared: true,
      shouldRewrite: true,
    };
  }

  return {
    avatar: legacyAvatar,
    status: 'legacy',
    fromLegacy: true,
    storageCleared: false,
    shouldRewrite: true,
  };
}

export async function writeAvatarBodyScanMetadata(
  userId: string,
  avatar: UserAvatar,
  now: number = Date.now()
): Promise<UserAvatar | null> {
  const sanitized = sanitizeAvatarBodyScanMetadata(avatar);
  const key = avatarBodyScanStorageKey(userId);
  if (!sanitized) {
    await AsyncStorage.removeItem(key);
    return null;
  }

  await AsyncStorage.setItem(key, JSON.stringify(createEnvelope(sanitized, now)));
  return sanitized;
}

export async function readAvatarBodyScanMetadata(
  userId: string,
  now: number = Date.now()
): Promise<AvatarBodyScanReadResult> {
  const key = avatarBodyScanStorageKey(userId);
  const raw = await AsyncStorage.getItem(key);
  const result = parseStoredAvatar(raw, now);

  if (result.shouldRewrite) {
    if (result.avatar) {
      await writeAvatarBodyScanMetadata(userId, result.avatar, now);
    } else {
      await AsyncStorage.removeItem(key);
    }
  }

  return {
    avatar: result.avatar,
    status: result.status,
    fromLegacy: result.fromLegacy,
    storageCleared: result.storageCleared,
  };
}

export async function clearAvatarBodyScanMetadata(userId: string): Promise<void> {
  await AsyncStorage.removeItem(avatarBodyScanStorageKey(userId));
}

export async function getBodyScanEnabledSetting(): Promise<boolean> {
  const value = await getSensitiveItemWithLegacyFallback(
    BODY_SCAN_ENABLED_SECURE_KEY,
    BODY_SCAN_ENABLED_LEGACY_KEY
  );
  return value === 'true';
}

export async function setBodyScanEnabledSetting(value: boolean): Promise<void> {
  await setSensitiveItemReplacingLegacy(
    BODY_SCAN_ENABLED_SECURE_KEY,
    value ? 'true' : 'false',
    BODY_SCAN_ENABLED_LEGACY_KEY
  );
}
