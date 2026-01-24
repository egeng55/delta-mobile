/**
 * AccessContext - Manages subscription and access control state.
 *
 * SAFETY DECISIONS:
 * - All boolean state is explicitly typed
 * - RevenueCat is source of truth for iOS purchases
 * - Supabase stores subscription for backend sync
 * - Developer role bypasses all feature gates
 *
 * APP STORE COMPLIANCE:
 * - Uses iOS IAP via RevenueCat for purchases
 * - All purchases go through App Store
 * - Uses RevenueCat Paywalls for purchase UI
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
  ReactNode,
} from 'react';
import { Alert } from 'react-native';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';
import * as RevenueCat from '../services/revenuecat';
import { syncToSupabase, SupabaseSubscription } from '../services/subscriptionSync';

// Developer emails that bypass all feature restrictions
const DEVELOPER_EMAILS = ['egeng@umich.edu', 'eric@egeng.co'];

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
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOffering | null;
  isRevenueCatReady: boolean;
  subscriptionStatus: RevenueCat.SubscriptionStatus | null;
}

// Context type
interface AccessContextType extends AccessState {
  checkAccess: () => Promise<void>;
  canAccessFeature: (feature: string) => boolean;
  isDeveloper: boolean;
  // Paywall methods - using RevenueCat Paywalls
  showPaywall: () => Promise<boolean>;
  showPaywallIfNeeded: () => Promise<boolean>;
  // Customer Center
  showCustomerCenter: () => Promise<void>;
  // Purchase methods (for custom UI if needed)
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshOfferings: () => Promise<void>;
}

// Initial state
const initialState: AccessState = {
  isLoading: true,
  hasAccess: false,
  profile: null,
  subscription: null,
  role: null,
  customerInfo: null,
  offerings: null,
  isRevenueCatReady: false,
  subscriptionStatus: null,
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
 * Integrates RevenueCat for iOS IAP and Supabase for backend sync.
 */
export function AccessProvider({ children }: AccessProviderProps): React.ReactNode {
  const { isAuthenticated, user, session } = useAuth();
  const [state, setState] = useState<AccessState>(initialState);
  const customerInfoListenerRef = useRef<(() => void) | null>(null);

  // Initialize RevenueCat
  useEffect(() => {
    const initRevenueCat = async (): Promise<void> => {
      try {
        await RevenueCat.configure();
        setState(prev => ({ ...prev, isRevenueCatReady: true }));
        console.log('AccessContext: RevenueCat initialized');
      } catch (error) {
        // RevenueCat init failed - app continues without IAP
        console.warn('AccessContext: RevenueCat init failed (continuing without IAP)', error);
        setState(prev => ({ ...prev, isRevenueCatReady: true }));
      }
    };

    initRevenueCat();
  }, []);

  // Handle CustomerInfo updates from RevenueCat
  const handleCustomerInfoUpdate = useCallback(
    async (customerInfo: CustomerInfo): Promise<void> => {
      console.log('AccessContext: CustomerInfo updated');

      const subscriptionStatus = RevenueCat.parseSubscriptionStatus(customerInfo);
      setState(prev => ({ ...prev, customerInfo, subscriptionStatus }));

      // Update hasAccess based on RevenueCat entitlements
      const hasPro = RevenueCat.hasProAccess(customerInfo);
      const isDev = isDeveloperEmail(user?.email) || state.profile?.role === 'developer' || state.profile?.role === 'admin';

      setState(prev => ({
        ...prev,
        hasAccess: isDev || hasPro,
      }));

      // Sync to Supabase if we have a user (non-blocking)
      if (user?.id) {
        syncToSupabase(user.id, customerInfo)
          .then(synced => {
            if (synced !== null) {
              setState(prev => ({ ...prev, subscription: synced as Subscription }));
            }
          })
          .catch(err => console.warn('AccessContext: Failed to sync to Supabase', err));
      }
    },
    [user?.id, user?.email, state.profile?.role]
  );

  // Login to RevenueCat when user authenticates
  useEffect(() => {
    const setupRevenueCat = async (): Promise<void> => {
      if (state.isRevenueCatReady !== true) {
        return;
      }

      // Remove previous listener
      if (customerInfoListenerRef.current !== null) {
        customerInfoListenerRef.current();
        customerInfoListenerRef.current = null;
      }

      if (isAuthenticated === true && user?.id) {
        try {
          // Login to RevenueCat with Supabase user ID
          const customerInfo = await RevenueCat.login(user.id);
          await handleCustomerInfoUpdate(customerInfo);

          // Set user attributes for analytics (non-blocking)
          if (user.email) {
            RevenueCat.setUserAttributes({
              email: user.email,
            }).catch(err => console.warn('AccessContext: Failed to set user attributes', err));
          }

          // Add listener for future updates
          customerInfoListenerRef.current = RevenueCat.addCustomerInfoUpdateListener(
            handleCustomerInfoUpdate
          );

          // Get offerings (non-blocking)
          RevenueCat.getOfferings()
            .then(offerings => setState(prev => ({ ...prev, offerings })))
            .catch(err => console.warn('AccessContext: Failed to get offerings', err));
        } catch (error) {
          console.warn('AccessContext: RevenueCat setup failed (continuing without IAP)', error);
        }
      } else {
        // Logout from RevenueCat (non-blocking)
        RevenueCat.logout().catch(() => {
          // Ignore logout errors
        });
      }
    };

    setupRevenueCat();

    // Cleanup listener on unmount
    return () => {
      if (customerInfoListenerRef.current !== null) {
        customerInfoListenerRef.current();
        customerInfoListenerRef.current = null;
      }
    };
  }, [state.isRevenueCatReady, isAuthenticated, user?.id, user?.email, handleCustomerInfoUpdate]);

  // Check access when user changes
  const checkAccess = useCallback(async (): Promise<void> => {
    if (isAuthenticated !== true || user === null || session === null) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasAccess: false,
        profile: null,
        subscription: null,
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

      // Check iOS IAP subscription
      const hasIosSubscription = fetchedSubscription?.source === 'ios' &&
        fetchedSubscription?.status === 'active' &&
        fetchedSubscription?.plan !== 'free' &&
        new Date(fetchedSubscription?.current_period_end || 0) > new Date();

      // Also check RevenueCat directly if available
      let hasRevenueCatPro = false;
      if (state.customerInfo !== null) {
        hasRevenueCatPro = RevenueCat.hasProAccess(state.customerInfo);
      }

      // Developers always have access; regular users need iOS IAP subscription
      const hasAccess = isDev || hasIosSubscription || hasRevenueCatPro;

      setState(prev => ({
        ...prev,
        isLoading: false,
        hasAccess,
        profile: fetchedProfile,
        subscription: fetchedSubscription,
        role: fetchedProfile?.role || (isDeveloperEmail(user.email) ? 'developer' : 'user'),
      }));
    } catch (error) {
      console.error('Error checking access:', error);
      // On error, default to no access for safety
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasAccess: false,
        profile: null,
        subscription: null,
        role: null,
      }));
    }
  }, [isAuthenticated, user, session, state.customerInfo]);

  // Check access on mount and when user changes
  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  /**
   * Check if user can access a specific feature.
   * Synchronous check based on current state.
   *
   * Free features: chat_basic, tracking, profile
   * Pro features: insights, coaching, exports, vision, chat_unlimited
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

    // Pro features require iOS IAP subscription
    return state.hasAccess === true;
  }, [state.role, state.hasAccess]);

  /**
   * Show RevenueCat Paywall.
   * Uses the paywall configured in RevenueCat dashboard.
   * Returns true if purchase was successful.
   */
  const showPaywall = useCallback(async (): Promise<boolean> => {
    try {
      const { result, customerInfo } = await RevenueCat.presentPaywall();

      if (customerInfo !== undefined) {
        await handleCustomerInfoUpdate(customerInfo);
      }

      if (result === 'purchased' || result === 'restored') {
        Alert.alert(
          'Welcome to Pro!',
          'Your subscription is now active. Enjoy all Pro features!'
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error('AccessContext: Paywall error', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      return false;
    }
  }, [handleCustomerInfoUpdate]);

  /**
   * Show RevenueCat Paywall only if user doesn't have Pro access.
   * Returns true if user has access (either already had it or just purchased).
   */
  const showPaywallIfNeeded = useCallback(async (): Promise<boolean> => {
    // Check if already has access
    if (state.hasAccess === true) {
      return true;
    }

    try {
      const { result, customerInfo } = await RevenueCat.presentPaywallIfNeeded();

      if (customerInfo !== undefined) {
        await handleCustomerInfoUpdate(customerInfo);
      }

      return result === 'purchased' || result === 'restored';
    } catch (error) {
      console.error('AccessContext: Paywall error', error);
      return false;
    }
  }, [state.hasAccess, handleCustomerInfoUpdate]);

  /**
   * Show RevenueCat Customer Center.
   * Allows users to manage their subscription.
   */
  const showCustomerCenter = useCallback(async (): Promise<void> => {
    try {
      await RevenueCat.presentCustomerCenter();
    } catch (error) {
      console.error('AccessContext: Customer Center error', error);
      Alert.alert('Error', 'Could not open subscription management. Please try again.');
    }
  }, []);

  /**
   * Purchase a package from RevenueCat.
   * Returns true if successful, false otherwise.
   */
  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const { customerInfo } = await RevenueCat.purchasePackage(pkg);
      await handleCustomerInfoUpdate(customerInfo);
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'PURCHASE_CANCELLED') {
        return false;
      }
      if (error instanceof Error && error.message === 'PAYMENT_PENDING') {
        Alert.alert(
          'Payment Pending',
          'Your payment is being processed. You\'ll get access once it\'s confirmed.'
        );
        return false;
      }
      console.error('AccessContext: Purchase failed', error);
      Alert.alert('Purchase Failed', 'There was a problem with your purchase. Please try again.');
      throw error;
    }
  }, [handleCustomerInfoUpdate]);

  /**
   * Restore previous purchases.
   * Returns true if pro access restored, false otherwise.
   */
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const customerInfo = await RevenueCat.restorePurchases();
      await handleCustomerInfoUpdate(customerInfo);
      const hasAccess = RevenueCat.hasProAccess(customerInfo);

      if (hasAccess === true) {
        Alert.alert('Purchases Restored', 'Your subscription has been restored successfully!');
      } else {
        Alert.alert('No Purchases Found', 'We couldn\'t find any previous purchases to restore.');
      }

      return hasAccess;
    } catch (error) {
      console.error('AccessContext: Restore failed', error);
      Alert.alert('Restore Failed', 'There was a problem restoring your purchases. Please try again.');
      throw error;
    }
  }, [handleCustomerInfoUpdate]);

  /**
   * Refresh offerings from RevenueCat.
   */
  const refreshOfferings = useCallback(async (): Promise<void> => {
    try {
      const offerings = await RevenueCat.getOfferings();
      setState(prev => ({ ...prev, offerings }));
    } catch (error) {
      console.error('AccessContext: Failed to refresh offerings', error);
    }
  }, []);

  const isDeveloper = state.role === 'developer' || state.role === 'admin';

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo<AccessContextType>(() => ({
    isLoading: state.isLoading === true,
    hasAccess: state.hasAccess === true,
    profile: state.profile,
    subscription: state.subscription,
    role: state.role,
    customerInfo: state.customerInfo,
    offerings: state.offerings,
    isRevenueCatReady: state.isRevenueCatReady,
    subscriptionStatus: state.subscriptionStatus,
    checkAccess,
    canAccessFeature,
    isDeveloper,
    showPaywall,
    showPaywallIfNeeded,
    showCustomerCenter,
    purchasePackage,
    restorePurchases,
    refreshOfferings,
  }), [
    state,
    checkAccess,
    canAccessFeature,
    isDeveloper,
    showPaywall,
    showPaywallIfNeeded,
    showCustomerCenter,
    purchasePackage,
    restorePurchases,
    refreshOfferings,
  ]);

  return (
    <AccessContext.Provider value={contextValue}>
      {children}
    </AccessContext.Provider>
  );
}

/**
 * Feature gate component - only renders children if user has access.
 * For pro features, shows a compliant fallback.
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
