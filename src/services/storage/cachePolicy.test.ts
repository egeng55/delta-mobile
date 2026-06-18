import {
  createCacheEnvelope,
  isCacheEnvelopeExpired,
  readCacheEnvelope,
  trimArrayToLimit,
  trimArrayToMostRecent,
} from './cachePolicy';

describe('cachePolicy', () => {
  it('creates TTL envelopes and reads non-expired values', () => {
    const envelope = createCacheEnvelope({ count: 2 }, 1000, { category: 'test' }, 100);

    expect(envelope).toEqual({
      version: 1,
      data: { count: 2 },
      createdAt: 100,
      expiresAt: 1100,
      metadata: { category: 'test' },
    });
    expect(readCacheEnvelope<{ count: number }>(JSON.stringify(envelope), 500)).toMatchObject({
      status: 'hit',
      value: { count: 2 },
    });
  });

  it('marks expired envelopes without returning sensitive payload values', () => {
    const envelope = createCacheEnvelope({ text: 'private' }, 1000, undefined, 100);

    expect(isCacheEnvelopeExpired(envelope, 1100)).toBe(true);
    expect(readCacheEnvelope<{ text: string }>(JSON.stringify(envelope), 1100)).toMatchObject({
      status: 'expired',
      value: null,
    });
  });

  it('reports legacy or invalid cache shapes safely', () => {
    expect(readCacheEnvelope(JSON.stringify([{ legacy: true }]))).toMatchObject({
      status: 'not-envelope',
      value: null,
    });
    expect(readCacheEnvelope('{bad json')).toMatchObject({
      status: 'invalid',
      value: null,
    });
  });

  it('trims arrays to bounded cache sizes', () => {
    expect(trimArrayToLimit([1, 2, 3, 4], 2)).toEqual([1, 2]);
    expect(trimArrayToMostRecent([1, 2, 3, 4], 2)).toEqual([3, 4]);
    expect(trimArrayToLimit([1, 2], 5)).toEqual([1, 2]);
  });
});
