import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createCacheEnvelope,
  readCacheEnvelope,
} from './cachePolicy';

export const WEATHER_LOCATION_CACHE_KEY = '@delta_weather_cache';
export const WEATHER_LOCATION_CACHE_TTL_MS = 30 * 60 * 1000;
export const WEATHER_LOCATION_COORDINATE_DECIMALS = 2;

export type WeatherLocationCacheReadStatus = 'empty' | 'hit' | 'expired' | 'invalid';

export interface WeatherLocationCacheReadResult<T> {
  data: T | null;
  status: WeatherLocationCacheReadStatus;
  fromLegacy: boolean;
}

const TOKEN_LIKE_FIELD = /token|api[_-]?key|appid|authorization|credential|secret|password/i;
const COORDINATE_FIELD = /^(lat|lon|latitude|longitude)$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function roundCoordinate(value: number): number {
  const factor = 10 ** WEATHER_LOCATION_COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (TOKEN_LIKE_FIELD.test(key)) continue;
    if (COORDINATE_FIELD.test(key) && typeof nestedValue === 'number' && Number.isFinite(nestedValue)) {
      sanitized[key] = roundCoordinate(nestedValue);
      continue;
    }
    sanitized[key] = sanitizeValue(nestedValue);
  }
  return sanitized;
}

export function sanitizeWeatherLocationPayload<T>(value: T): T {
  return sanitizeValue(value) as T;
}

export function createWeatherLocationCache<T>(
  value: T,
  now: number = Date.now()
): string {
  const sanitized = sanitizeWeatherLocationPayload(value);
  return JSON.stringify(createCacheEnvelope(sanitized, WEATHER_LOCATION_CACHE_TTL_MS, {
    category: 'weather_location_cache',
    payloadKind: 'current_conditions',
    sensitivity: 'medium',
    coordinatePrecision: `rounded_${WEATHER_LOCATION_COORDINATE_DECIMALS}_decimals_if_present`,
    tokenFieldsStored: false,
  }, now));
}

function readLegacyWeatherCache<T>(
  raw: string,
  now: number
): WeatherLocationCacheReadResult<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { data: null, status: 'invalid', fromLegacy: false };
  }

  if (!isRecord(parsed) || typeof parsed.timestamp !== 'number') {
    return { data: null, status: 'invalid', fromLegacy: false };
  }

  if (now - parsed.timestamp >= WEATHER_LOCATION_CACHE_TTL_MS) {
    return { data: null, status: 'expired', fromLegacy: true };
  }

  const legacyPayload = Object.prototype.hasOwnProperty.call(parsed, 'data')
    ? parsed.data
    : parsed;

  return {
    data: sanitizeWeatherLocationPayload(legacyPayload as T),
    status: 'hit',
    fromLegacy: true,
  };
}

export async function readWeatherLocationCache<T>(
  now: number = Date.now()
): Promise<WeatherLocationCacheReadResult<T>> {
  const raw = await AsyncStorage.getItem(WEATHER_LOCATION_CACHE_KEY);
  const envelope = readCacheEnvelope<T>(raw, now);

  if (envelope.status === 'empty') {
    return { data: null, status: 'empty', fromLegacy: false };
  }

  if (envelope.status === 'hit') {
    return {
      data: sanitizeWeatherLocationPayload(envelope.value as T),
      status: 'hit',
      fromLegacy: false,
    };
  }

  if (envelope.status === 'expired') {
    await AsyncStorage.removeItem(WEATHER_LOCATION_CACHE_KEY);
    return { data: null, status: 'expired', fromLegacy: false };
  }

  if (envelope.status === 'invalid') {
    await AsyncStorage.removeItem(WEATHER_LOCATION_CACHE_KEY);
    return { data: null, status: 'invalid', fromLegacy: false };
  }

  const legacy = readLegacyWeatherCache<T>(raw ?? '', now);
  if (legacy.status === 'hit' && legacy.data !== null) {
    await AsyncStorage.setItem(WEATHER_LOCATION_CACHE_KEY, createWeatherLocationCache(legacy.data, now));
    return legacy;
  }

  await AsyncStorage.removeItem(WEATHER_LOCATION_CACHE_KEY);
  return legacy;
}

export async function writeWeatherLocationCache<T>(
  value: T,
  now: number = Date.now()
): Promise<void> {
  await AsyncStorage.setItem(WEATHER_LOCATION_CACHE_KEY, createWeatherLocationCache(value, now));
}

export async function clearWeatherLocationCache(): Promise<void> {
  await AsyncStorage.removeItem(WEATHER_LOCATION_CACHE_KEY);
}
