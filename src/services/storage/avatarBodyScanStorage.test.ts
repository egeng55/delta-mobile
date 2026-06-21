import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { UserAvatar } from '../../types/avatar';
import {
  AVATAR_BODY_SCAN_SCHEMA_VERSION,
  AVATAR_BODY_SCAN_TTL_MS,
  BODY_SCAN_ENABLED_LEGACY_KEY,
  BODY_SCAN_ENABLED_SECURE_KEY,
  avatarBodyScanStorageKey,
  getBodyScanEnabledSetting,
  readAvatarBodyScanMetadata,
  sanitizeAvatarBodyScanMetadata,
  sanitizeAvatarBodyScanValue,
  setBodyScanEnabledSetting,
  writeAvatarBodyScanMetadata,
} from './avatarBodyScanStorage';

type SecureStoreMock = typeof SecureStore & {
  __clearStore: () => void;
  __getStore: () => Record<string, string>;
};

const secureStore = SecureStore as SecureStoreMock;

const baseAvatar: UserAvatar = {
  templateId: 'average',
  style: 'soft',
  skinTone: '#D4A574',
  accentColor: '#6366F1',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  currentOutfitId: 'casual_default',
  unlockedOutfits: ['casual_default'],
  achievements: [],
};

describe('avatarBodyScanStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    secureStore.__clearStore();
    jest.clearAllMocks();
  });

  it('wraps avatar metadata with TTL envelope and preserves display metadata', async () => {
    const now = 1_000;
    const avatar: UserAvatar = {
      ...baseAvatar,
      meshFileUri: 'file:///avatar/body-scan.usdz',
      meshFormat: 'usdz',
      meshThumbnailUri: 'file:///avatar/body-scan-thumb.png',
      rpmAvatarUrl: 'https://models.readyplayer.me/avatar.glb',
      rpmAvatarId: 'rpm-123',
      rpmImageUrl: 'https://models.readyplayer.me/avatar.png',
      scanMethod: 'readyplayerme',
      scanDate: '2026-06-01T01:00:00.000Z',
      scanConfidence: 0.86,
    };

    await writeAvatarBodyScanMetadata('user-1', avatar, now);

    const raw = await AsyncStorage.getItem(avatarBodyScanStorageKey('user-1'));
    const envelope = JSON.parse(raw ?? '{}');
    expect(envelope).toMatchObject({
      schemaVersion: AVATAR_BODY_SCAN_SCHEMA_VERSION,
      kind: 'avatar_body_scan_metadata',
      createdAt: now,
      updatedAt: now,
      ttlMs: AVATAR_BODY_SCAN_TTL_MS,
      expiresAt: now + AVATAR_BODY_SCAN_TTL_MS,
    });
    expect(envelope.avatar).toMatchObject({
      templateId: 'average',
      style: 'soft',
      meshFileUri: 'file:///avatar/body-scan.usdz',
      rpmAvatarUrl: 'https://models.readyplayer.me/avatar.glb',
      scanMethod: 'readyplayerme',
    });
  });

  it('reads valid metadata and drops expired metadata', async () => {
    await writeAvatarBodyScanMetadata('user-1', baseAvatar, 1_000);

    await expect(readAvatarBodyScanMetadata('user-1', 2_000)).resolves.toMatchObject({
      status: 'hit',
      avatar: baseAvatar,
    });

    await expect(readAvatarBodyScanMetadata('user-1', 1_000 + AVATAR_BODY_SCAN_TTL_MS)).resolves.toMatchObject({
      status: 'expired',
      avatar: null,
      storageCleared: true,
    });
    await expect(AsyncStorage.getItem(avatarBodyScanStorageKey('user-1'))).resolves.toBeNull();
  });

  it('handles legacy raw avatar metadata and rewrites to the TTL envelope', async () => {
    await AsyncStorage.setItem(avatarBodyScanStorageKey('user-1'), JSON.stringify(baseAvatar));

    const result = await readAvatarBodyScanMetadata('user-1', 5_000);
    const raw = await AsyncStorage.getItem(avatarBodyScanStorageKey('user-1'));
    const envelope = JSON.parse(raw ?? '{}');

    expect(result).toMatchObject({
      status: 'legacy',
      fromLegacy: true,
      avatar: baseAvatar,
    });
    expect(envelope.kind).toBe('avatar_body_scan_metadata');
    expect(envelope.expiresAt).toBe(5_000 + AVATAR_BODY_SCAN_TTL_MS);
  });

  it('strips token-like and raw image/blob payload fields recursively', () => {
    const sanitized = sanitizeAvatarBodyScanValue({
      templateId: 'average',
      access_token: 'secret-access-token',
      nested: {
        Authorization: 'Bearer secret',
        keep: true,
        imageBase64: 'data:image/png;base64,abc123',
      },
      frames: [{ rawPhoto: 'data:image/png;base64,abc123' }],
    });

    expect(sanitized).toEqual({
      templateId: 'average',
      nested: { keep: true },
    });
    expect(JSON.stringify(sanitized)).not.toContain('secret-access-token');
    expect(JSON.stringify(sanitized)).not.toContain('Bearer secret');
    expect(JSON.stringify(sanitized)).not.toContain('data:image');
  });

  it('minimizes avatar metadata to known safe fields', () => {
    const sanitized = sanitizeAvatarBodyScanMetadata({
      ...baseAvatar,
      customProportions: {
        shoulderWidth: 0.4,
        torsoLength: 0.4,
        hipWidth: 0.3,
        legLength: 0.5,
        armLength: 0.4,
        secret: 'drop',
      },
      imageBlob: 'data:image/png;base64,abc123',
      token: 'drop',
      unknownField: 'drop',
    });

    expect(sanitized).toEqual({
      ...baseAvatar,
      customProportions: {
        shoulderWidth: 0.4,
        torsoLength: 0.4,
        hipWidth: 0.3,
        legLength: 0.5,
        armLength: 0.4,
      },
    });
  });

  it('handles malformed storage safely by clearing it', async () => {
    await AsyncStorage.setItem(avatarBodyScanStorageKey('user-1'), '{not-json');

    await expect(readAvatarBodyScanMetadata('user-1')).resolves.toMatchObject({
      status: 'malformed',
      avatar: null,
      storageCleared: true,
    });
    await expect(AsyncStorage.getItem(avatarBodyScanStorageKey('user-1'))).resolves.toBeNull();
  });

  it('stores the body scan enabled flag in SecureStore with legacy fallback', async () => {
    await AsyncStorage.setItem(BODY_SCAN_ENABLED_LEGACY_KEY, 'true');

    await expect(getBodyScanEnabledSetting()).resolves.toBe(true);
    expect(secureStore.__getStore()[BODY_SCAN_ENABLED_SECURE_KEY]).toBe('true');
    await expect(AsyncStorage.getItem(BODY_SCAN_ENABLED_LEGACY_KEY)).resolves.toBeNull();

    await setBodyScanEnabledSetting(false);
    expect(secureStore.__getStore()[BODY_SCAN_ENABLED_SECURE_KEY]).toBe('false');
  });
});
