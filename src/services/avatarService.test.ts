import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserAvatar } from '../types/avatar';
import { supabase } from './supabase';
import {
  AVATAR_BODY_SCAN_TTL_MS,
  avatarBodyScanStorageKey,
} from './storage/avatarBodyScanStorage';
import { avatarService } from './avatarService';

jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  },
}));

const mockedSupabase = supabase as { from: jest.Mock };

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

describe('avatarService storage policy', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    avatarService.clearCache();
    jest.clearAllMocks();
  });

  it('saves avatar metadata through the TTL/minimization storage helper', async () => {
    const avatarWithUnsafeFields = {
      ...baseAvatar,
      meshFileUri: 'file:///avatar/body-scan.usdz',
      scanMethod: 'lidar',
      access_token: 'secret-access-token',
      imageBlob: 'data:image/png;base64,abc123',
    } as UserAvatar & Record<string, unknown>;

    await avatarService.saveAvatar('user-1', avatarWithUnsafeFields);

    const raw = await AsyncStorage.getItem(avatarBodyScanStorageKey('user-1'));
    const envelope = JSON.parse(raw ?? '{}');
    expect(envelope).toMatchObject({
      kind: 'avatar_body_scan_metadata',
      ttlMs: AVATAR_BODY_SCAN_TTL_MS,
    });
    expect(envelope.avatar).toMatchObject({
      templateId: 'average',
      style: 'soft',
      meshFileUri: 'file:///avatar/body-scan.usdz',
      scanMethod: 'lidar',
    });
    expect(JSON.stringify(envelope)).not.toContain('secret-access-token');
    expect(JSON.stringify(envelope)).not.toContain('data:image');
  });

  it('loads legacy raw avatar metadata without calling cloud storage', async () => {
    await AsyncStorage.setItem(avatarBodyScanStorageKey('user-1'), JSON.stringify(baseAvatar));

    const avatar = await avatarService.getAvatar('user-1');
    const raw = await AsyncStorage.getItem(avatarBodyScanStorageKey('user-1'));
    const envelope = JSON.parse(raw ?? '{}');

    expect(avatar).toEqual(baseAvatar);
    expect(envelope.kind).toBe('avatar_body_scan_metadata');
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });
});
