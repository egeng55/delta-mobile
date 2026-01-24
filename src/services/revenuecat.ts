/**
 * RevenueCat Service - iOS In-App Purchase integration.
 *
 * Uses RevenueCat SDK v9+ with Paywalls and Customer Center support.
 * Documentation: https://www.revenuecat.com/docs/getting-started/installation/reactnative
 *
 * SAFETY DECISIONS:
 * - User ID linked to Supabase auth for consistency
 * - All purchases go through RevenueCat SDK
 * - CustomerInfo is the source of truth for entitlements
 * - Lazy loading to avoid NativeEventEmitter initialization issues
 */

import Constants from 'expo-constants';

// Lazy load RevenueCat to avoid NativeEventEmitter issues on startup
let Purchases: typeof import('react-native-purchases').default;
let RevenueCatUI: typeof import('react-native-purchases-ui').default;
let LOG_LEVEL: typeof import('react-native-purchases').LOG_LEVEL;
let PURCHASES_ERROR_CODE: typeof import('react-native-purchases').PURCHASES_ERROR_CODE;
let PAYWALL_RESULT: typeof import('react-native-purchases-ui').PAYWALL_RESULT;

// Re-export types
export type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
export type { PurchasesError } from 'react-native-purchases';

type CustomerInfo = import('react-native-purchases').CustomerInfo;
type PurchasesOffering = import('react-native-purchases').PurchasesOffering;
type PurchasesPackage = import('react-native-purchases').PurchasesPackage;
type PurchasesError = import('react-native-purchases').PurchasesError;

// RevenueCat API key from app.json extra config
// For production, update the key in app.json with your iOS public key (starts with appl_)
const REVENUECAT_API_KEY = Constants.expoConfig?.extra?.revenueCatApiKey ?? '';

// Product identifiers matching RevenueCat dashboard
export const PRODUCT_IDS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

// Entitlement identifier matching RevenueCat dashboard
export const ENTITLEMENTS = {
  PRO: 'Delta Health Intelligence Pro',
} as const;

// Subscription status parsed from CustomerInfo
export interface SubscriptionStatus {
  isActive: boolean;
  isPro: boolean;
  willRenew: boolean;
  expirationDate: Date | null;
  productId: string | null;
  isTrialing: boolean;
  periodType: 'monthly' | 'yearly' | 'trial' | 'lifetime' | null;
  managementURL: string | null;
}

// Paywall result type
export type PaywallResultType =
  | 'purchased'
  | 'restored'
  | 'cancelled'
  | 'error';

// RevenueCat initialization state
let isConfigured = false;

/**
 * Load RevenueCat modules lazily.
 */
async function loadModules(): Promise<void> {
  if (Purchases !== undefined) {
    return;
  }

  const purchasesModule = await import('react-native-purchases');
  const purchasesUIModule = await import('react-native-purchases-ui');

  Purchases = purchasesModule.default;
  LOG_LEVEL = purchasesModule.LOG_LEVEL;
  PURCHASES_ERROR_CODE = purchasesModule.PURCHASES_ERROR_CODE;
  RevenueCatUI = purchasesUIModule.default;
  PAYWALL_RESULT = purchasesUIModule.PAYWALL_RESULT;
}

/**
 * Configure RevenueCat SDK.
 * Should be called once at app startup.
 */
export async function configure(): Promise<void> {
  if (isConfigured === true) {
    return;
  }

  try {
    // Load modules first
    await loadModules();

    // Enable debug logs in development
    if (__DEV__ === true) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    await Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
    });

    isConfigured = true;
    console.log('RevenueCat: Configured successfully');
  } catch (error) {
    console.warn('RevenueCat: Configuration failed - IAP will be unavailable', error);
    // Still mark as configured to prevent retry loops
    isConfigured = true;
    throw error;
  }
}

/**
 * Login user to RevenueCat with Supabase user ID.
 * Links RevenueCat purchases to Supabase user.
 */
export async function login(userId: string): Promise<CustomerInfo> {
  try {
    await loadModules();
    const { customerInfo } = await Purchases.logIn(userId);
    console.log('RevenueCat: User logged in', userId);
    return customerInfo;
  } catch (error) {
    console.error('RevenueCat: Login failed', error);
    throw error;
  }
}

/**
 * Logout user from RevenueCat.
 * Creates a new anonymous user.
 */
export async function logout(): Promise<CustomerInfo> {
  try {
    await loadModules();
    const customerInfo = await Purchases.logOut();
    console.log('RevenueCat: User logged out');
    return customerInfo;
  } catch (error) {
    console.error('RevenueCat: Logout failed', error);
    throw error;
  }
}

/**
 * Get current customer info.
 * Contains entitlements and subscription status.
 */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  try {
    await loadModules();
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('RevenueCat: Failed to get customer info', error);
    throw error;
  }
}

/**
 * Get available offerings (products).
 * Returns the current offering with packages.
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    await loadModules();
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (error) {
    console.error('RevenueCat: Failed to get offerings', error);
    throw error;
  }
}

/**
 * Purchase a package.
 * Returns updated CustomerInfo after successful purchase.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<{
  customerInfo: CustomerInfo;
  productIdentifier: string;
}> {
  try {
    await loadModules();
    const result = await Purchases.purchasePackage(pkg);
    console.log('RevenueCat: Purchase successful', result.productIdentifier);
    return {
      customerInfo: result.customerInfo,
      productIdentifier: result.productIdentifier,
    };
  } catch (error: unknown) {
    const purchaseError = error as PurchasesError;

    // Handle user cancellation
    if (purchaseError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      console.log('RevenueCat: Purchase cancelled by user');
      throw new Error('PURCHASE_CANCELLED');
    }

    // Handle payment pending
    if (purchaseError.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
      console.log('RevenueCat: Payment pending');
      throw new Error('PAYMENT_PENDING');
    }

    console.error('RevenueCat: Purchase failed', error);
    throw error;
  }
}

/**
 * Restore previous purchases.
 * Used when user reinstalls or logs in on new device.
 */
export async function restorePurchases(): Promise<CustomerInfo> {
  try {
    await loadModules();
    const customerInfo = await Purchases.restorePurchases();
    console.log('RevenueCat: Purchases restored');
    return customerInfo;
  } catch (error) {
    console.error('RevenueCat: Failed to restore purchases', error);
    throw error;
  }
}

/**
 * Present the RevenueCat Paywall UI.
 * Uses the paywall configured in the RevenueCat dashboard.
 *
 * @returns Result of paywall presentation
 */
export async function presentPaywall(): Promise<{
  result: PaywallResultType;
  customerInfo?: CustomerInfo;
}> {
  try {
    await loadModules();
    const paywallResult = await RevenueCatUI.presentPaywall();

    switch (paywallResult) {
      case PAYWALL_RESULT.PURCHASED:
        const customerInfo = await getCustomerInfo();
        console.log('RevenueCat: Paywall purchase completed');
        return { result: 'purchased', customerInfo };

      case PAYWALL_RESULT.RESTORED:
        const restoredInfo = await getCustomerInfo();
        console.log('RevenueCat: Paywall restore completed');
        return { result: 'restored', customerInfo: restoredInfo };

      case PAYWALL_RESULT.CANCELLED:
        console.log('RevenueCat: Paywall cancelled');
        return { result: 'cancelled' };

      case PAYWALL_RESULT.ERROR:
        console.log('RevenueCat: Paywall error');
        return { result: 'error' };

      default:
        return { result: 'cancelled' };
    }
  } catch (error) {
    console.error('RevenueCat: Failed to present paywall', error);
    return { result: 'error' };
  }
}

/**
 * Present the RevenueCat Paywall UI if needed.
 * Only shows if user doesn't have the entitlement.
 *
 * @param entitlement - The entitlement to check for
 * @returns Result of paywall presentation
 */
export async function presentPaywallIfNeeded(
  entitlement: string = ENTITLEMENTS.PRO
): Promise<{
  result: PaywallResultType;
  customerInfo?: CustomerInfo;
}> {
  try {
    await loadModules();
    const paywallResult = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: entitlement,
    });

    switch (paywallResult) {
      case PAYWALL_RESULT.PURCHASED:
        const customerInfo = await getCustomerInfo();
        return { result: 'purchased', customerInfo };

      case PAYWALL_RESULT.RESTORED:
        const restoredInfo = await getCustomerInfo();
        return { result: 'restored', customerInfo: restoredInfo };

      case PAYWALL_RESULT.CANCELLED:
        return { result: 'cancelled' };

      case PAYWALL_RESULT.ERROR:
        return { result: 'error' };

      default:
        return { result: 'cancelled' };
    }
  } catch (error) {
    console.error('RevenueCat: Failed to present paywall', error);
    return { result: 'error' };
  }
}

/**
 * Present the Customer Center UI.
 * Allows users to manage their subscription.
 * Documentation: https://www.revenuecat.com/docs/tools/customer-center
 */
export async function presentCustomerCenter(): Promise<void> {
  try {
    await loadModules();
    await RevenueCatUI.presentCustomerCenter();
    console.log('RevenueCat: Customer Center presented');
  } catch (error) {
    console.error('RevenueCat: Failed to present Customer Center', error);
    throw error;
  }
}

/**
 * Parse subscription status from CustomerInfo.
 * Extracts relevant fields for the app.
 */
export function parseSubscriptionStatus(customerInfo: CustomerInfo): SubscriptionStatus {
  const proEntitlement = customerInfo.entitlements.active[ENTITLEMENTS.PRO];

  if (proEntitlement === undefined) {
    return {
      isActive: false,
      isPro: false,
      willRenew: false,
      expirationDate: null,
      productId: null,
      isTrialing: false,
      periodType: null,
      managementURL: customerInfo.managementURL,
    };
  }

  const expirationDateStr = proEntitlement.expirationDate;
  const expirationDate = expirationDateStr !== null ? new Date(expirationDateStr) : null;

  // Determine period type from product ID
  let periodType: 'monthly' | 'yearly' | 'trial' | 'lifetime' | null = null;
  const productId = proEntitlement.productIdentifier;

  if (productId === PRODUCT_IDS.MONTHLY) {
    periodType = 'monthly';
  } else if (productId === PRODUCT_IDS.YEARLY) {
    periodType = 'yearly';
  }

  // Check if trialing
  const isTrialing = proEntitlement.periodType === 'TRIAL';
  if (isTrialing === true) {
    periodType = 'trial';
  }

  // Check for lifetime (no expiration)
  if (expirationDate === null && proEntitlement.isActive === true) {
    periodType = 'lifetime';
  }

  return {
    isActive: proEntitlement.isActive === true,
    isPro: true,
    willRenew: proEntitlement.willRenew === true,
    expirationDate,
    productId,
    isTrialing,
    periodType,
    managementURL: customerInfo.managementURL,
  };
}

/**
 * Check if user has Pro access.
 * Quick helper to check entitlement.
 */
export function hasProAccess(customerInfo: CustomerInfo): boolean {
  return customerInfo.entitlements.active[ENTITLEMENTS.PRO] !== undefined;
}

/**
 * Add listener for CustomerInfo updates.
 * Called when purchases change (new purchase, renewal, etc).
 * Note: Modules must be loaded before calling this (call after configure/login).
 */
export function addCustomerInfoUpdateListener(
  listener: (customerInfo: CustomerInfo) => void
): () => void {
  if (Purchases === undefined) {
    console.warn('RevenueCat: Purchases not loaded, listener not added');
    return () => {};
  }

  Purchases.addCustomerInfoUpdateListener(listener);

  // Return unsubscribe function
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

/**
 * Check if RevenueCat is configured and ready.
 */
export function isReady(): boolean {
  return isConfigured === true;
}

/**
 * Get the subscription management URL.
 * Opens App Store subscription management.
 */
export async function getManagementURL(): Promise<string | null> {
  try {
    const customerInfo = await getCustomerInfo();
    return customerInfo.managementURL;
  } catch (error) {
    console.error('RevenueCat: Failed to get management URL', error);
    return null;
  }
}

/**
 * Sync purchases with RevenueCat.
 * Useful after app updates or to ensure latest state.
 */
export async function syncPurchases(): Promise<CustomerInfo> {
  try {
    await loadModules();
    await Purchases.syncPurchases();
    console.log('RevenueCat: Purchases synced');
    // Get customer info after sync
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('RevenueCat: Failed to sync purchases', error);
    throw error;
  }
}

/**
 * Set user attributes for analytics.
 */
export async function setUserAttributes(attributes: {
  email?: string;
  displayName?: string;
  [key: string]: string | undefined;
}): Promise<void> {
  try {
    await loadModules();
    if (attributes.email) {
      await Purchases.setEmail(attributes.email);
    }
    if (attributes.displayName) {
      await Purchases.setDisplayName(attributes.displayName);
    }

    // Set custom attributes
    for (const [key, value] of Object.entries(attributes)) {
      if (key !== 'email' && key !== 'displayName' && value !== undefined) {
        await Purchases.setAttributes({ [key]: value });
      }
    }

    console.log('RevenueCat: User attributes set');
  } catch (error) {
    console.error('RevenueCat: Failed to set user attributes', error);
  }
}
