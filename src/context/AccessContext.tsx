/**
 * AccessContext - Manages subscription and access control state.
 *
 * SAFETY DECISIONS:
 * - All boolean state is explicitly typed
 * - Server-side access checks are the source of truth
 * - Developer role bypasses all paywalls
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
import {
  subscriptionApi,
  AccessLevel,
  Subscription,
  FeatureAccess,
  PRICING_URL,
} from '../services/api';

// Access state
interface AccessState {
  isLoading: boolean;
  hasAccess: boolean;
  subscription: Subscription | null;
  accessLevel: AccessLevel | null;
  role: 'user' | 'developer' | 'admin' | null;
}

// Context type
interface AccessContextType extends AccessState {
  checkAccess: () => Promise<void>;
  checkFeature: (feature: string) => Promise<FeatureAccess>;
  requireAccess: (feature?: string) => Promise<boolean>;
  openPricing: () => void;
  isDeveloper: boolean;
}

// Initial state
const initialState: AccessState = {
  isLoading: true,
  hasAccess: false,
  subscription: null,
  accessLevel: null,
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
 * Checks subscription and role-based access from the backend.
 */
export function AccessProvider({ children }: AccessProviderProps): React.ReactNode {
  const { isAuthenticated, user } = useAuth();
  const [state, setState] = useState<AccessState>(initialState);

  // Check access when user changes
  const checkAccess = useCallback(async (): Promise<void> => {
    if (isAuthenticated !== true || user === null) {
      setState({
        isLoading: false,
        hasAccess: false,
        subscription: null,
        accessLevel: null,
        role: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const result = await subscriptionApi.getSubscription(user.id);

      setState({
        isLoading: false,
        hasAccess: result.access.has_access === true,
        subscription: result.subscription,
        accessLevel: result.access,
        role: result.access.role,
      });
    } catch (error) {
      console.error('Error checking access:', error);
      // On error, default to no access for safety
      setState({
        isLoading: false,
        hasAccess: false,
        subscription: null,
        accessLevel: null,
        role: null,
      });
    }
  }, [isAuthenticated, user]);

  // Check access on mount and when user changes
  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  // Check if user can access a specific feature
  const checkFeature = useCallback(async (feature: string): Promise<FeatureAccess> => {
    if (isAuthenticated !== true || user === null) {
      return {
        allowed: false,
        reason: 'not_authenticated',
        feature,
        redirect_url: PRICING_URL,
      };
    }

    try {
      return await subscriptionApi.checkFeatureAccess(user.id, feature);
    } catch {
      return {
        allowed: false,
        reason: 'error',
        feature,
        redirect_url: PRICING_URL,
      };
    }
  }, [isAuthenticated, user]);

  // Require access - returns true if allowed, opens pricing if not
  const requireAccess = useCallback(async (feature?: string): Promise<boolean> => {
    // Developers always have access
    if (state.role === 'developer' || state.role === 'admin') {
      return true;
    }

    if (feature !== undefined) {
      const access = await checkFeature(feature);
      if (access.allowed !== true) {
        openPricing();
        return false;
      }
      return true;
    }

    if (state.hasAccess !== true) {
      openPricing();
      return false;
    }

    return true;
  }, [state.hasAccess, state.role, checkFeature]);

  // Open pricing page in browser
  const openPricing = useCallback((): void => {
    Linking.openURL(PRICING_URL).catch((err) => {
      console.error('Error opening pricing URL:', err);
    });
  }, []);

  const isDeveloper = state.role === 'developer' || state.role === 'admin';

  const contextValue: AccessContextType = {
    isLoading: state.isLoading === true,
    hasAccess: state.hasAccess === true,
    subscription: state.subscription,
    accessLevel: state.accessLevel,
    role: state.role,
    checkAccess,
    checkFeature,
    requireAccess,
    openPricing,
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
  const { hasAccess, role } = useAccess();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const { user } = useAuth();

  // Free features don't need subscription
  const FREE_FEATURES = ['chat_basic', 'tracking', 'profile'];

  useEffect(() => {
    // Developers/admins always have access
    if (role === 'developer' || role === 'admin') {
      setAllowed(true);
      return;
    }

    // Free features are always allowed
    if (FREE_FEATURES.includes(feature)) {
      setAllowed(true);
      return;
    }

    // Check server-side access
    if (user !== null) {
      subscriptionApi.checkFeatureAccess(user.id, feature)
        .then((access) => {
          setAllowed(access.allowed === true);
        })
        .catch(() => {
          setAllowed(false);
        });
    } else {
      setAllowed(false);
    }
  }, [feature, hasAccess, role, user]);

  if (allowed === null) {
    // Still loading
    return null;
  }

  if (allowed !== true) {
    return fallback;
  }

  return <>{children}</>;
}
