import {
  DAILY_GREETING_CACHE_TTL_MS,
  DAILY_GREETING_MAX_LENGTH,
  createDailyGreetingCache,
  dailyGreetingCacheKey,
  readDailyGreetingCache,
} from './dailyGreetingCache';

describe('dailyGreetingCache', () => {
  it('wraps generated greeting text in a TTL envelope', () => {
    const raw = createDailyGreetingCache('Hydrate earlier today.', 1_000);
    const parsed = JSON.parse(raw);

    expect(parsed).toMatchObject({
      version: 1,
      data: 'Hydrate earlier today.',
      createdAt: 1_000,
      expiresAt: 1_000 + DAILY_GREETING_CACHE_TTL_MS,
      metadata: {
        category: 'daily_generated_greeting',
        maxLength: DAILY_GREETING_MAX_LENGTH,
      },
    });
  });

  it('reads valid and legacy generated greeting cache values', () => {
    const raw = createDailyGreetingCache('Recovery looks steady.', 1_000);

    expect(readDailyGreetingCache(raw, 2_000)).toEqual({
      message: 'Recovery looks steady.',
      expired: false,
      invalid: false,
      fromLegacy: false,
    });
    expect(readDailyGreetingCache('Legacy greeting text.', 2_000)).toEqual({
      message: 'Legacy greeting text.',
      expired: false,
      invalid: false,
      fromLegacy: true,
    });
  });

  it('drops expired, malformed, and oversized greeting cache values', () => {
    const raw = createDailyGreetingCache('Short-lived note.', 1_000);
    expect(readDailyGreetingCache(raw, 1_000 + DAILY_GREETING_CACHE_TTL_MS)).toMatchObject({
      message: null,
      expired: true,
    });

    expect(readDailyGreetingCache('{not-json')).toMatchObject({
      message: null,
      invalid: true,
    });
    expect(readDailyGreetingCache('x'.repeat(DAILY_GREETING_MAX_LENGTH + 1))).toMatchObject({
      message: null,
      invalid: true,
    });
  });

  it('uses the existing daily greeting key pattern', () => {
    expect(dailyGreetingCacheKey('user-1', '2026-06-21')).toBe('delta-greeting-user-1-2026-06-21');
  });
});
