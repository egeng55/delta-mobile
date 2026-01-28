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
import { Theme, lightTheme, darkTheme, FitnessGoal, GoalTints, getGoalTints } from '../theme/colors';

const THEME_STORAGE_KEY = '@delta_theme_preference';
const GOAL_STORAGE_KEY = '@delta_fitness_goal';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setDarkMode: (dark: boolean) => void;
  useSystemTheme: () => void;
  isUsingSystem: boolean;
  // Goal-based theming
  fitnessGoal: FitnessGoal;
  goalTints: GoalTints;
  setFitnessGoal: (goal: FitnessGoal) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.ReactNode {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean>(systemColorScheme === 'dark');
  const [isUsingSystem, setIsUsingSystem] = useState<boolean>(true);
  const [fitnessGoal, setFitnessGoalState] = useState<FitnessGoal>('maintain');

  // Load saved theme preference and fitness goal
  useEffect(() => {
    const loadPreferences = async (): Promise<void> => {
      try {
        const [savedTheme, savedGoal] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(GOAL_STORAGE_KEY),
        ]);

        if (savedTheme !== null) {
          const preference = JSON.parse(savedTheme);
          if (preference.useSystem === true) {
            setIsUsingSystem(true);
            setIsDark(systemColorScheme === 'dark');
          } else {
            setIsUsingSystem(false);
            setIsDark(preference.isDark === true);
          }
        }

        if (savedGoal !== null) {
          const goal = savedGoal as FitnessGoal;
          if (goal === 'cut' || goal === 'maintain' || goal === 'bulk') {
            setFitnessGoalState(goal);
          }
        }
      } catch {
        // Use defaults on error
      }
    };
    loadPreferences();
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

  const setFitnessGoal = useCallback(async (goal: FitnessGoal): Promise<void> => {
    setFitnessGoalState(goal);
    try {
      await AsyncStorage.setItem(GOAL_STORAGE_KEY, goal);
    } catch {
      // Silent fail
    }
  }, []);

  const theme: Theme = isDark === true ? darkTheme : lightTheme;
  const goalTints: GoalTints = getGoalTints(fitnessGoal, isDark ? 'dark' : 'light');

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        toggleTheme,
        setDarkMode,
        useSystemTheme,
        isUsingSystem,
        fitnessGoal,
        goalTints,
        setFitnessGoal,
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
