/**
 * ThemeContext - Manages light/dark mode state.
 *
 * SAFETY DECISIONS:
 * - Explicit boolean checks
 * - Persists theme preference to AsyncStorage
 * - Falls back to system preference
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, lightTheme, darkTheme } from '../theme/colors';

const THEME_STORAGE_KEY = '@delta_theme_preference';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setDarkMode: (dark: boolean) => void;
  useSystemTheme: () => void;
  isUsingSystem: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.ReactNode {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean>(systemColorScheme === 'dark');
  const [isUsingSystem, setIsUsingSystem] = useState<boolean>(true);

  // Load saved theme preference
  useEffect(() => {
    const loadThemePreference = async (): Promise<void> => {
      try {
        const savedPreference = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedPreference !== null) {
          const preference = JSON.parse(savedPreference);
          if (preference.useSystem === true) {
            setIsUsingSystem(true);
            setIsDark(systemColorScheme === 'dark');
          } else {
            setIsUsingSystem(false);
            setIsDark(preference.isDark === true);
          }
        }
      } catch {
        // Use system default on error
      }
    };
    loadThemePreference();
  }, []);

  // Update theme when system changes (if using system)
  useEffect(() => {
    if (isUsingSystem === true) {
      setIsDark(systemColorScheme === 'dark');
    }
  }, [systemColorScheme, isUsingSystem]);

  const savePreference = useCallback(async (useSystem: boolean, dark: boolean): Promise<void> => {
    try {
      await AsyncStorage.setItem(
        THEME_STORAGE_KEY,
        JSON.stringify({ useSystem, isDark: dark })
      );
    } catch {
      // Silent fail
    }
  }, []);

  const toggleTheme = useCallback((): void => {
    const newIsDark = isDark !== true;
    setIsDark(newIsDark);
    setIsUsingSystem(false);
    savePreference(false, newIsDark);
  }, [isDark, savePreference]);

  const setDarkMode = useCallback((dark: boolean): void => {
    setIsDark(dark === true);
    setIsUsingSystem(false);
    savePreference(false, dark);
  }, [savePreference]);

  const useSystemTheme = useCallback((): void => {
    setIsUsingSystem(true);
    setIsDark(systemColorScheme === 'dark');
    savePreference(true, systemColorScheme === 'dark');
  }, [systemColorScheme, savePreference]);

  const theme: Theme = isDark === true ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        toggleTheme,
        setDarkMode,
        useSystemTheme,
        isUsingSystem,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
