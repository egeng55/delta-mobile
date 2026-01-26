/**
 * UnitsContext - Provides unit system preference throughout the app
 *
 * Features:
 * - Toggle between metric and imperial
 * - Persisted to AsyncStorage
 * - Provides conversion utilities
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UnitSystem,
  formatWeight,
  formatVolume,
  formatDistance,
  formatHeight,
  formatTemperature,
  getWeightUnit,
  getVolumeUnit,
  getDistanceUnit,
  getHeightUnit,
  getTemperatureUnit,
  toStorageWeight,
  toStorageVolume,
  toStorageDistance,
  toStorageHeight,
  fromStorageWeight,
  fromStorageVolume,
  fromStorageDistance,
  FormatOptions,
} from '../utils/unitConversion';

const STORAGE_KEY = '@delta_unit_system';

interface UnitsContextValue {
  unitSystem: UnitSystem;
  setUnitSystem: (system: UnitSystem) => Promise<void>;
  toggleUnitSystem: () => Promise<void>;
  isMetric: boolean;
  isImperial: boolean;

  // Formatters
  formatWeight: (kg: number, options?: FormatOptions) => string;
  formatVolume: (ml: number, options?: FormatOptions) => string;
  formatDistance: (km: number, options?: FormatOptions) => string;
  formatHeight: (cm: number, options?: FormatOptions) => string;
  formatTemperature: (celsius: number, options?: FormatOptions) => string;

  // Unit labels
  weightUnit: string;
  volumeUnit: string;
  distanceUnit: string;
  heightUnit: string;
  temperatureUnit: string;

  // Storage converters (for saving user input)
  toStorageWeight: (displayValue: number) => number;
  toStorageVolume: (displayValue: number) => number;
  toStorageDistance: (displayValue: number) => number;
  toStorageHeight: (displayValue: number) => number;

  // Display converters (for showing stored values)
  fromStorageWeight: (storedValue: number) => number;
  fromStorageVolume: (storedValue: number) => number;
  fromStorageDistance: (storedValue: number) => number;
}

const UnitsContext = createContext<UnitsContextValue | undefined>(undefined);

interface UnitsProviderProps {
  children: ReactNode;
}

export function UnitsProvider({ children }: UnitsProviderProps): React.ReactElement {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('metric');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved preference
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'imperial' || saved === 'metric') {
          setUnitSystemState(saved);
        }
      } catch {
        // Default to metric
      } finally {
        setIsLoaded(true);
      }
    };
    loadPreference();
  }, []);

  const setUnitSystem = useCallback(async (system: UnitSystem) => {
    setUnitSystemState(system);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, system);
    } catch {
      // Silent fail
    }
  }, []);

  const toggleUnitSystem = useCallback(async () => {
    const newSystem = unitSystem === 'metric' ? 'imperial' : 'metric';
    await setUnitSystem(newSystem);
  }, [unitSystem, setUnitSystem]);

  const value: UnitsContextValue = {
    unitSystem,
    setUnitSystem,
    toggleUnitSystem,
    isMetric: unitSystem === 'metric',
    isImperial: unitSystem === 'imperial',

    // Formatters
    formatWeight: (kg, options) => formatWeight(kg, unitSystem, options),
    formatVolume: (ml, options) => formatVolume(ml, unitSystem, options),
    formatDistance: (km, options) => formatDistance(km, unitSystem, options),
    formatHeight: (cm, options) => formatHeight(cm, unitSystem, options),
    formatTemperature: (celsius, options) => formatTemperature(celsius, unitSystem, options),

    // Unit labels
    weightUnit: getWeightUnit(unitSystem),
    volumeUnit: getVolumeUnit(unitSystem),
    distanceUnit: getDistanceUnit(unitSystem),
    heightUnit: getHeightUnit(unitSystem),
    temperatureUnit: getTemperatureUnit(unitSystem),

    // Storage converters
    toStorageWeight: (displayValue) => toStorageWeight(displayValue, unitSystem),
    toStorageVolume: (displayValue) => toStorageVolume(displayValue, unitSystem),
    toStorageDistance: (displayValue) => toStorageDistance(displayValue, unitSystem),
    toStorageHeight: (displayValue) => toStorageHeight(displayValue, unitSystem),

    // Display converters
    fromStorageWeight: (storedValue) => fromStorageWeight(storedValue, unitSystem),
    fromStorageVolume: (storedValue) => fromStorageVolume(storedValue, unitSystem),
    fromStorageDistance: (storedValue) => fromStorageDistance(storedValue, unitSystem),
  };

  // Wait for initial load before rendering
  if (!isLoaded) {
    return <></>;
  }

  return (
    <UnitsContext.Provider value={value}>
      {children}
    </UnitsContext.Provider>
  );
}

export function useUnits(): UnitsContextValue {
  const context = useContext(UnitsContext);
  if (context === undefined) {
    throw new Error('useUnits must be used within a UnitsProvider');
  }
  return context;
}

export default UnitsContext;
