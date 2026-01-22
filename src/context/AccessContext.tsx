/**
 * AccessContext - Manages subscription and access control state.
 *
 * SAFETY DECISIONS:
 * - All boolean state is explicitly typed
 * - Supabase is the single source of truth for subscriptions
 * - Developer role bypasses all feature gates
 *
 * APP STORE COMPLIANCE:
 * - Does NOT unlock features based on external purchases
 * - Only shows informational "Learn More" links
 * - No pricing details or payment references in-app
 * - Access state does NOT change after visiting external pages
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Linking } from 'react-native';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';

// Developer emails that bypass all feature restrictions
const DEVELOPER_EMAILS = ['egeng@umich.edu', 'eric@egeng.co'];

// External info URL (must NOT contain pricing/payment info)
const INFO_URL = 'https://deltahealthintelligence.com/learn-more';

// Supabase types
interface Profile {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  age: number | null;
  gender: 'male' | 'female' | 'non-binary' | 'other' | null;
  role: 'user' | 'developer' | 'admin';
  created_at: string;
  updated_at: string;
}

interface Subscription {
  id: string;
  user_id: string;
  plan: 'free' | 'premium' | 'pro';
  status: 'active' | 'canceled' | 'expired' | 'trialing';
  source: 'web' | 'ios' | 'android' | 'manual';
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  canceled_at: string | null;
}

// Access state
interface AccessState {
  isLoading: boolean;
  hasAccess: boolean;
  profile: Profile | null;
  subscription: Subscription | null;
  role: 'user' | 'developer' | 'admin' | null;
}

// Context type
interface AccessContextType extends AccessState {
  checkAccess: () => Promise<void>;
  canAccessFeature: (feature: string) => boolean;
  openLearnMore: () => void;
  isDeveloper: boolean;
}

// Initial state
const initialState: AccessState = {
  isLoading: true,
  hasAccess: false,
  profile: null,
  subscription: null,
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
 * Check if an email has developer access.
 */
function isDeveloperEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEVELOPER_EMAILS.includes(email.toLowerCase());
}

/**
 * Access provider component.
 * Checks subscription and role-based access from Supabase.
 */
export function AccessProvider({ children }: AccessProviderProps): React.ReactNode {
  const { isAuthenticated, user, session } = useAuth();
  const [state, setState] = useState<AccessState>(initialState);

  // Check access when user changes
  const checkAccess = useCallback(async (): Promise<void> => {
    if (isAuthenticated !== true || user === null || session === null) {
      setState({
        isLoading: false,
        hasAccess: false,
        profile: null,
        subscription: null,
        role: null,
      });
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

      // Fetch subscription from Supabase
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (subError && subError.code !== 'PGRST116') {
        console.error('Error fetching subscription:', subError);
      }

      const fetchedProfile = profileData as Profile | null;
      const fetchedSubscription = subData as Subscription | null;

      // Calculate access based on role and subscription
      const isDev = isDeveloperEmail(user.email) ||
        fetchedProfile?.role === 'developer' ||
        fetchedProfile?.role === 'admin';

      // For App Store compliance: Only iOS IAP subscriptions should unlock features
      // Web/external subscriptions do NOT grant in-app access
      const hasIosSubscription = fetchedSubscription?.source === 'ios' &&
        fetchedSubscription?.status === 'active' &&
        fetchedSubscription?.plan !== 'free' &&
        new Date(fetchedSubscription?.current_period_end || 0) > new Date();

      // Developers always have access; regular users need iOS IAP subscription
      const hasAccess = isDev || hasIosSubscription;

      setState({
        isLoading: false,
        hasAccess,
        profile: fetchedProfile,
        subscription: fetchedSubscription,
        role: fetchedProfile?.role || (isDeveloperEmail(user.email) ? 'developer' : 'user'),
      });
    } catch (error) {
      console.error('Error checking access:', error);
      // On error, default to no access for safety
      setState({
        isLoading: false,
        hasAccess: false,
        profile: null,
        subscription: null,
        role: null,
      });
    }
  }, [isAuthenticated, user, session]);

  // Check access on mount and when user changes
  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  /**
   * Check if user can access a specific feature.
   * Synchronous check based on current state.
   *
   * Free features: chat_basic, tracking, profile
   * Premium features: insights, coaching, exports, vision, chat_unlimited
   */
  const canAccessFeature = useCallback((feature: string): boolean => {
    const FREE_FEATURES = ['chat_basic', 'tracking', 'profile'];

    // Free features are always allowed
    if (FREE_FEATURES.includes(feature)) {
      return true;
    }

    // Developers always have access
    if (state.role === 'developer' || state.role === 'admin') {
      return true;
    }

    // Premium features require iOS IAP subscription
    return state.hasAccess === true;
  }, [state.role, state.hasAccess]);

  /**
   * Open external info page.
   * App Store compliant: Opens generic info page, NOT pricing/payment page.
   */
  const openLearnMore = useCallback((): void => {
    Linking.openURL(INFO_URL).catch((err) => {
      console.error('Error opening URL:', err);
    });
  }, []);

  const isDeveloper = state.role === 'developer' || state.role === 'admin';

  const contextValue: AccessContextType = {
    isLoading: state.isLoading === true,
    hasAccess: state.hasAccess === true,
    profile: state.profile,
    subscription: state.subscription,
    role: state.role,
    checkAccess,
    canAccessFeature,
    openLearnMore,
    isDeveloper,
  };

  return (
    <AccessContext.Provider value={contextValue}>
      {children}
    </AccessContext.Provider>
  );
}

/**
 * Feature gate component - only renders children if user has access.
 * For premium features, shows a compliant fallback.
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
