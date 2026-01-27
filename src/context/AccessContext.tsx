/**
 * AccessContext - Manages access control state.
 *
 * ARCHIVED: RevenueCat integration has been archived for pre-seed phase.
 * All users currently have full access to all features.
 * See _archived/revenuecat/ to re-enable monetization.
 *
 * SAFETY DECISIONS:
 * - All boolean state is explicitly typed
 * - Developer role still tracked for future use
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';
import { isDeveloperEmail } from '../config/constants';

// Supabase types
interface Profile {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  age: number | null;
  gender: 'male' | 'female' | 'other' | null;
  role: 'user' | 'developer' | 'admin';
  created_at: string;
  updated_at: string;
}

// Access state
interface AccessState {
  isLoading: boolean;
  hasAccess: boolean;
  profile: Profile | null;
  role: 'user' | 'developer' | 'admin' | null;
}

// Context type
interface AccessContextType extends AccessState {
  checkAccess: () => Promise<void>;
  canAccessFeature: (feature: string) => boolean;
  isDeveloper: boolean;
}

// Initial state - all users have access during pre-seed phase
const initialState: AccessState = {
  isLoading: true,
  hasAccess: true, // All features unlocked
  profile: null,
  role: null,
};

const AccessContext = createContext<AccessContextType | null>(null);

/**
 * Hook to use access context.
 */
export function useAccess(): AccessContextType {
  const context = useContext(AccessContext);
  if (context === null) {
    throw new Error('useAccess must be used within AccessProvider');
  }
  return context;
}

interface AccessProviderProps {
  children: ReactNode;
}

/**
 * Access provider component.
 * Currently grants all users full access (pre-seed phase).
 */
export function AccessProvider({ children }: AccessProviderProps): React.ReactNode {
  const { isAuthenticated, user, session } = useAuth();
  const [state, setState] = useState<AccessState>(initialState);

  // Check access when user changes
  const checkAccess = useCallback(async (): Promise<void> => {
    if (isAuthenticated !== true || user === null || session === null) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasAccess: true, // Still grant access even when not authenticated
        profile: null,
        role: null,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Fetch profile from Supabase
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
      }

      const fetchedProfile = profileData as Profile | null;

      // Determine role
      const isDev = isDeveloperEmail(user.email) ||
        fetchedProfile?.role === 'developer' ||
        fetchedProfile?.role === 'admin';

      setState(prev => ({
        ...prev,
        isLoading: false,
        hasAccess: true, // All users have full access during pre-seed
        profile: fetchedProfile,
        role: fetchedProfile?.role || (isDeveloperEmail(user.email) ? 'developer' : 'user'),
      }));
    } catch (error) {
      console.error('Error checking access:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasAccess: true, // Default to full access
        profile: null,
        role: null,
      }));
    }
  }, [isAuthenticated, user, session]);

  // Check access on mount and when user changes
  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  /**
   * Check if user can access a specific feature.
   * Currently all features are accessible (pre-seed phase).
   */
  const canAccessFeature = useCallback((_feature: string): boolean => {
    // All features accessible during pre-seed phase
    return true;
  }, []);

  const isDeveloper = state.role === 'developer' || state.role === 'admin';

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<AccessContextType>(() => ({
    isLoading: state.isLoading === true,
    hasAccess: true, // Always true during pre-seed
    profile: state.profile,
    role: state.role,
    checkAccess,
    canAccessFeature,
    isDeveloper,
  }), [
    state,
    checkAccess,
    canAccessFeature,
    isDeveloper,
  ]);

  return (
    <AccessContext.Provider value={contextValue}>
      {children}
    </AccessContext.Provider>
  );
}

/**
 * Feature gate component - renders children (all features accessible).
 * Kept for future use when monetization is re-enabled.
 */
interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({
  feature,
  children,
  fallback = null,
}: FeatureGateProps): React.ReactNode {
  const { canAccessFeature } = useAccess();

  if (canAccessFeature(feature) !== true) {
    return fallback;
  }

  return <>{children}</>;
}
