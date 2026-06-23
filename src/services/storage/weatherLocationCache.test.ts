import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  WEATHER_LOCATION_CACHE_KEY,
  WEATHER_LOCATION_CACHE_TTL_MS,
  createWeatherLocationCache,
  readWeatherLocationCache,
  sanitizeWeatherLocationPayload,
  writeWeatherLocationCache,
} from './weatherLocationCache';

const weatherPayload = {
  temperature: 72,
  temperatureCelsius: 22,
  feelsLike: 74,
  feelsLikeCelsius: 23,
  humidity: 61,
  description: 'clear sky',
  icon: '01d',
  uvIndex: 3,
  windSpeed: 8,
  visibility: 10,
  sunrise: '06:15 AM',
  sunset: '08:45 PM',
  location: 'Austin',
  timestamp: 1_000,
  airQuality: {
    aqi: 2,
    label: 'Fair',
    pm25: 4,
    pm10: 8,
  },
};

describe('weatherLocationCache', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('wraps valid weather data in a TTL envelope and reads it while fresh', async () => {
    await writeWeatherLocationCache(weatherPayload, 10_000);

    const raw = await AsyncStorage.getItem(WEATHER_LOCATION_CACHE_KEY);
    const parsed = JSON.parse(raw ?? '{}');

    expect(parsed).toMatchObject({
      version: 1,
      data: weatherPayload,
      createdAt: 10_000,
      expiresAt: 10_000 + WEATHER_LOCATION_CACHE_TTL_MS,
      metadata: {
        category: 'weather_location_cache',
        payloadKind: 'current_conditions',
        sensitivity: 'medium',
        tokenFieldsStored: false,
      },
    });

    await expect(readWeatherLocationCache<typeof weatherPayload>(11_000)).resolves.toEqual({
      data: weatherPayload,
      status: 'hit',
      fromLegacy: false,
    });
  });

  it('removes expired cache entries on read', async () => {
    await AsyncStorage.setItem(
      WEATHER_LOCATION_CACHE_KEY,
      createWeatherLocationCache(weatherPayload, 10_000)
    );

    await expect(readWeatherLocationCache(10_000 + WEATHER_LOCATION_CACHE_TTL_MS)).resolves.toMatchObject({
      data: null,
      status: 'expired',
    });
    await expect(AsyncStorage.getItem(WEATHER_LOCATION_CACHE_KEY)).resolves.toBeNull();
  });

  it('removes malformed cache entries on read', async () => {
    await AsyncStorage.setItem(WEATHER_LOCATION_CACHE_KEY, '{not-json');

    await expect(readWeatherLocationCache()).resolves.toMatchObject({
      data: null,
      status: 'invalid',
    });
    await expect(AsyncStorage.getItem(WEATHER_LOCATION_CACHE_KEY)).resolves.toBeNull();
  });

  it('strips token-like fields without dropping display weather fields', async () => {
    const payload = {
      ...weatherPayload,
      apiKey: 'provider-token',
      appid: 'provider-app-id',
      authorization: 'Bearer token',
      nested: {
        secret: 'nope',
        display: 'keep me',
      },
    };

    await writeWeatherLocationCache(payload, 10_000);
    const result = await readWeatherLocationCache<Record<string, unknown>>(11_000);

    expect(result.data).toMatchObject({
      temperature: 72,
      description: 'clear sky',
      location: 'Austin',
      nested: {
        display: 'keep me',
      },
    });
    expect(result.data).not.toHaveProperty('apiKey');
    expect(result.data).not.toHaveProperty('appid');
    expect(result.data).not.toHaveProperty('authorization');
    expect(result.data?.nested).not.toHaveProperty('secret');
  });

  it('reduces coordinate precision if coordinates are accidentally included', async () => {
    const sanitized = sanitizeWeatherLocationPayload({
      lat: 30.267153,
      lon: -97.743057,
      latitude: 30.2711286,
      longitude: -97.7436995,
      location: 'Austin',
    });

    expect(sanitized).toEqual({
      lat: 30.27,
      lon: -97.74,
      latitude: 30.27,
      longitude: -97.74,
      location: 'Austin',
    });
  });

  it('reads and rewrites the legacy weather cache shape', async () => {
    await AsyncStorage.setItem(WEATHER_LOCATION_CACHE_KEY, JSON.stringify({
      data: {
        ...weatherPayload,
        apiKey: 'legacy-token',
        lat: 30.267153,
        lon: -97.743057,
      },
      timestamp: 10_000,
    }));

    const result = await readWeatherLocationCache<Record<string, unknown>>(11_000);

    expect(result).toMatchObject({
      status: 'hit',
      fromLegacy: true,
    });
    expect(result.data).toMatchObject({
      location: 'Austin',
      lat: 30.27,
      lon: -97.74,
    });
    expect(result.data).not.toHaveProperty('apiKey');

    const rewritten = JSON.parse(await AsyncStorage.getItem(WEATHER_LOCATION_CACHE_KEY) ?? '{}');
    expect(rewritten.version).toBe(1);
    expect(rewritten.metadata.category).toBe('weather_location_cache');
  });
});
