/**
 * Weather Service - Fetches weather data for health-aware recommendations.
 *
 * Weather impacts:
 * - UV index: Sunscreen recommendations, vitamin D
 * - Temperature: Hydration needs, workout intensity
 * - Humidity: Perceived exertion, sweat rate
 * - Air quality: Outdoor exercise safety
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Constants from 'expo-constants';

const API_KEY: string = Constants.expoConfig?.extra?.openWeatherMapApiKey ?? '';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const ONE_CALL_URL = 'https://api.openweathermap.org/data/3.0/onecall';
const CACHE_KEY = '@delta_weather_cache';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export interface WeatherData {
  temperature: number; // Fahrenheit
  temperatureCelsius: number;
  feelsLike: number;
  feelsLikeCelsius: number;
  humidity: number; // Percentage
  description: string;
  icon: string;
  uvIndex: number;
  airQuality?: AirQualityData;
  windSpeed: number; // mph
  visibility: number; // miles
  sunrise: string;
  sunset: string;
  location: string;
  timestamp: number;
}

export interface AirQualityData {
  aqi: number; // 1-5 scale (1=Good, 5=Very Poor)
  label: string;
  pm25: number;
  pm10: number;
}

interface CachedWeather {
  data: WeatherData;
  timestamp: number;
}

/**
 * Get UV index risk level and recommendations.
 */
export function getUVRiskLevel(uvIndex: number): {
  level: string;
  recommendation: string;
  color: string;
} {
  if (uvIndex <= 2) {
    return {
      level: 'Low',
      recommendation: 'No protection needed',
      color: '#22C55E',
    };
  } else if (uvIndex <= 5) {
    return {
      level: 'Moderate',
      recommendation: 'Wear sunscreen SPF 30+',
      color: '#F59E0B',
    };
  } else if (uvIndex <= 7) {
    return {
      level: 'High',
      recommendation: 'Sunscreen, hat, and sunglasses recommended',
      color: '#F97316',
    };
  } else if (uvIndex <= 10) {
    return {
      level: 'Very High',
      recommendation: 'Minimize sun exposure 10am-4pm',
      color: '#EF4444',
    };
  } else {
    return {
      level: 'Extreme',
      recommendation: 'Avoid outdoor activities midday',
      color: '#7C3AED',
    };
  }
}

/**
 * Get air quality description.
 */
export function getAirQualityLabel(aqi: number): string {
  switch (aqi) {
    case 1: return 'Good';
    case 2: return 'Fair';
    case 3: return 'Moderate';
    case 4: return 'Poor';
    case 5: return 'Very Poor';
    default: return 'Unknown';
  }
}

/**
 * Get hydration adjustment based on weather.
 */
export function getHydrationAdjustment(weather: WeatherData): {
  multiplier: number;
  reason: string;
} {
  let multiplier = 1.0;
  const reasons: string[] = [];

  // Temperature adjustments
  if (weather.temperature > 85) {
    multiplier += 0.25;
    reasons.push('hot weather');
  } else if (weather.temperature > 75) {
    multiplier += 0.1;
    reasons.push('warm weather');
  }

  // Humidity adjustments
  if (weather.humidity > 70) {
    multiplier += 0.15;
    reasons.push('high humidity');
  }

  // UV adjustments (sun exposure increases fluid loss)
  if (weather.uvIndex > 6) {
    multiplier += 0.1;
    reasons.push('high UV');
  }

  return {
    multiplier,
    reason: reasons.length > 0 ? `Due to ${reasons.join(', ')}` : 'Normal conditions',
  };
}

/**
 * Get workout recommendations based on weather.
 */
export function getWorkoutRecommendation(weather: WeatherData): string {
  const issues: string[] = [];

  // Temperature concerns
  if (weather.temperature > 90) {
    issues.push('Consider indoor workout - extreme heat');
  } else if (weather.temperature < 32) {
    issues.push('Layer up for outdoor activities');
  }

  // Air quality concerns
  if (weather.airQuality && weather.airQuality.aqi >= 4) {
    issues.push('Poor air quality - prefer indoor exercise');
  }

  // UV concerns
  if (weather.uvIndex > 7) {
    issues.push('High UV - workout early morning or evening');
  }

  // Humidity concerns
  if (weather.humidity > 80 && weather.temperature > 75) {
    issues.push('High humidity - reduce intensity, hydrate frequently');
  }

  return issues.length > 0 ? issues.join('. ') : 'Great conditions for outdoor activity!';
}

/**
 * Format weather for Delta's context.
 */
export function formatWeatherForContext(weather: WeatherData): string {
  const uvRisk = getUVRiskLevel(weather.uvIndex);
  const hydration = getHydrationAdjustment(weather);
  const workout = getWorkoutRecommendation(weather);

  let context = `Current weather in ${weather.location}: ${weather.temperature}°F (${weather.temperatureCelsius}°C), ${weather.description}. `;
  context += `Humidity: ${weather.humidity}%. `;
  context += `UV Index: ${weather.uvIndex} (${uvRisk.level} - ${uvRisk.recommendation}). `;

  if (weather.airQuality) {
    context += `Air Quality: ${weather.airQuality.label}. `;
  }

  if (hydration.multiplier > 1) {
    context += `Hydration note: Increase water intake by ${Math.round((hydration.multiplier - 1) * 100)}% ${hydration.reason}. `;
  }

  context += `Workout advice: ${workout}`;

  return context;
}

/**
 * Request location permissions.
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Check if location permission is granted.
 */
export async function hasLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Get current location coordinates.
 */
async function getCurrentLocation(): Promise<{ lat: number; lon: number } | null> {
  try {
    const hasPermission = await hasLocationPermission();
    if (!hasPermission) {
      const granted = await requestLocationPermission();
      if (!granted) return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      lat: location.coords.latitude,
      lon: location.coords.longitude,
    };
  } catch (error) {
    console.log('Weather: Failed to get location', error);
    return null;
  }
}

/**
 * Fetch weather data from OpenWeatherMap.
 */
async function fetchWeatherData(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    // Fetch current weather
    const weatherResponse = await fetch(
      `${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=imperial`
    );

    if (!weatherResponse.ok) {
      throw new Error(`Weather API error: ${weatherResponse.status}`);
    }

    const weatherData = await weatherResponse.json();

    // Estimate UV index based on time of day and weather (free tier doesn't include UV)
    let uvIndex = 0;
    const hour = new Date().getHours();
    const isClear = weatherData.weather[0]?.main === 'Clear';
    if (hour >= 10 && hour <= 16 && isClear) {
      uvIndex = hour >= 11 && hour <= 14 ? 7 : 5; // Peak UV midday
    } else if (hour >= 8 && hour <= 18 && isClear) {
      uvIndex = 3;
    } else {
      uvIndex = 1;
    }

    // Fetch air quality
    let airQuality: AirQualityData | undefined;
    try {
      const aqResponse = await fetch(
        `${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`
      );
      if (aqResponse.ok) {
        const aqData = await aqResponse.json();
        if (aqData.list && aqData.list[0]) {
          const aq = aqData.list[0];
          airQuality = {
            aqi: aq.main.aqi,
            label: getAirQualityLabel(aq.main.aqi),
            pm25: aq.components.pm2_5,
            pm10: aq.components.pm10,
          };
        }
      }
    } catch {
      // Air quality optional
    }

    const tempCelsius = Math.round((weatherData.main.temp - 32) * 5 / 9);
    const feelsLikeCelsius = Math.round((weatherData.main.feels_like - 32) * 5 / 9);

    return {
      temperature: Math.round(weatherData.main.temp),
      temperatureCelsius: tempCelsius,
      feelsLike: Math.round(weatherData.main.feels_like),
      feelsLikeCelsius: feelsLikeCelsius,
      humidity: weatherData.main.humidity,
      description: weatherData.weather[0]?.description || 'Unknown',
      icon: weatherData.weather[0]?.icon || '01d',
      uvIndex: Math.round(uvIndex),
      airQuality,
      windSpeed: Math.round(weatherData.wind.speed),
      visibility: Math.round(weatherData.visibility / 1609.34), // meters to miles
      sunrise: new Date(weatherData.sys.sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sunset: new Date(weatherData.sys.sunset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      location: weatherData.name || 'Unknown',
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Weather: Failed to fetch data', error);
    return null;
  }
}

/**
 * Get cached weather if still valid.
 */
async function getCachedWeather(): Promise<WeatherData | null> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed: CachedWeather = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_DURATION_MS) {
        return parsed.data;
      }
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

/**
 * Cache weather data.
 */
async function cacheWeather(data: WeatherData): Promise<void> {
  try {
    const cached: CachedWeather = {
      data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore cache errors
  }
}

/**
 * Get current weather data.
 * Returns cached data if available and fresh, otherwise fetches new data.
 */
export async function getWeather(forceRefresh: boolean = false): Promise<WeatherData | null> {
  // Try cache first
  if (!forceRefresh) {
    const cached = await getCachedWeather();
    if (cached) {
      return cached;
    }
  }

  // Get location
  const location = await getCurrentLocation();
  if (!location) {
    console.log('Weather: No location available');
    return null;
  }

  // Fetch fresh data
  const weather = await fetchWeatherData(location.lat, location.lon);
  if (weather) {
    await cacheWeather(weather);
  }

  return weather;
}

/**
 * Clear weather cache.
 */
export async function clearWeatherCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore
  }
}
