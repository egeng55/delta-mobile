/**
 * Unit conversion utilities for imperial/metric support
 */

export type UnitSystem = 'metric' | 'imperial';

// Weight conversions
export const kgToLbs = (kg: number): number => kg * 2.20462;
export const lbsToKg = (lbs: number): number => lbs / 2.20462;

// Volume conversions
export const mlToOz = (ml: number): number => ml * 0.033814;
export const ozToMl = (oz: number): number => oz / 0.033814;

export const litersToGallons = (liters: number): number => liters * 0.264172;
export const gallonsToLiters = (gallons: number): number => gallons / 0.264172;

// Distance conversions
export const kmToMiles = (km: number): number => km * 0.621371;
export const milesToKm = (miles: number): number => miles / 0.621371;

export const metersToFeet = (meters: number): number => meters * 3.28084;
export const feetToMeters = (feet: number): number => feet / 3.28084;

// Height conversions
export const cmToFeetInches = (cm: number): { feet: number; inches: number } => {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
};

export const feetInchesToCm = (feet: number, inches: number): number => {
  return (feet * 12 + inches) * 2.54;
};

// Temperature conversions
export const celsiusToFahrenheit = (celsius: number): number => (celsius * 9) / 5 + 32;
export const fahrenheitToCelsius = (fahrenheit: number): number => ((fahrenheit - 32) * 5) / 9;

// Format helpers
export interface FormatOptions {
  decimals?: number;
  showUnit?: boolean;
}

export const formatWeight = (
  value: number,
  system: UnitSystem,
  options: FormatOptions = {}
): string => {
  const { decimals = 1, showUnit = true } = options;
  if (system === 'imperial') {
    const lbs = kgToLbs(value);
    return `${lbs.toFixed(decimals)}${showUnit ? ' lbs' : ''}`;
  }
  return `${value.toFixed(decimals)}${showUnit ? ' kg' : ''}`;
};

export const formatVolume = (
  ml: number,
  system: UnitSystem,
  options: FormatOptions = {}
): string => {
  const { decimals = 0, showUnit = true } = options;
  if (system === 'imperial') {
    const oz = mlToOz(ml);
    return `${oz.toFixed(decimals)}${showUnit ? ' oz' : ''}`;
  }
  return `${ml.toFixed(decimals)}${showUnit ? ' ml' : ''}`;
};

export const formatDistance = (
  km: number,
  system: UnitSystem,
  options: FormatOptions = {}
): string => {
  const { decimals = 1, showUnit = true } = options;
  if (system === 'imperial') {
    const miles = kmToMiles(km);
    return `${miles.toFixed(decimals)}${showUnit ? ' mi' : ''}`;
  }
  return `${km.toFixed(decimals)}${showUnit ? ' km' : ''}`;
};

export const formatHeight = (
  cm: number,
  system: UnitSystem,
  options: FormatOptions = {}
): string => {
  const { showUnit = true } = options;
  if (system === 'imperial') {
    const { feet, inches } = cmToFeetInches(cm);
    return showUnit ? `${feet}'${inches}"` : `${feet} ${inches}`;
  }
  return `${Math.round(cm)}${showUnit ? ' cm' : ''}`;
};

export const formatTemperature = (
  celsius: number,
  system: UnitSystem,
  options: FormatOptions = {}
): string => {
  const { decimals = 1, showUnit = true } = options;
  if (system === 'imperial') {
    const fahrenheit = celsiusToFahrenheit(celsius);
    return `${fahrenheit.toFixed(decimals)}${showUnit ? '°F' : ''}`;
  }
  return `${celsius.toFixed(decimals)}${showUnit ? '°C' : ''}`;
};

// Unit labels
export const getWeightUnit = (system: UnitSystem): string =>
  system === 'imperial' ? 'lbs' : 'kg';

export const getVolumeUnit = (system: UnitSystem): string =>
  system === 'imperial' ? 'oz' : 'ml';

export const getDistanceUnit = (system: UnitSystem): string =>
  system === 'imperial' ? 'mi' : 'km';

export const getHeightUnit = (system: UnitSystem): string =>
  system === 'imperial' ? 'ft/in' : 'cm';

export const getTemperatureUnit = (system: UnitSystem): string =>
  system === 'imperial' ? '°F' : '°C';

// Convert value to storage format (always metric)
export const toStorageWeight = (value: number, system: UnitSystem): number =>
  system === 'imperial' ? lbsToKg(value) : value;

export const toStorageVolume = (value: number, system: UnitSystem): number =>
  system === 'imperial' ? ozToMl(value) : value;

export const toStorageDistance = (value: number, system: UnitSystem): number =>
  system === 'imperial' ? milesToKm(value) : value;

export const toStorageHeight = (value: number, system: UnitSystem): number =>
  system === 'imperial' ? feetToMeters(value) * 100 : value; // Convert feet to cm

// Convert from storage format to display
export const fromStorageWeight = (value: number, system: UnitSystem): number =>
  system === 'imperial' ? kgToLbs(value) : value;

export const fromStorageVolume = (value: number, system: UnitSystem): number =>
  system === 'imperial' ? mlToOz(value) : value;

export const fromStorageDistance = (value: number, system: UnitSystem): number =>
  system === 'imperial' ? kmToMiles(value) : value;
