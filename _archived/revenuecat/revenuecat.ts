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
 * - Early native module check to prevent crashes when not linked
 *
 * NOTE: Native modules are checked at load time. If not available,
 * all functions become no-ops that return null/empty results.
 */

import { NativeModules } from 'react-native';

// Early check for native modules - prevents crashes when not linked
const NATIVE_MODULES_AVAILABLE = Boolean(NativeModules.RNPurchases);

// Module references - populated by loadModules()
// Using 'any' to avoid importing types that might trigger module resolution
let Purchases: any;
let RevenueCatUI: any;
let LOG_LEVEL: any;
let PURCHASES_ERROR_CODE: any;
let PAYWALL_RESULT: any;

// Define our own types to avoid importing from react-native-purchases at top level
export interface CustomerInfo {
  entitlements: {
    active: Record<string, {
      isActive: boolean;
      willRenew: boolean;
      periodType: string;
      productIdentifier: string;
      expirationDate: string | null;
    }>;
  };
  managementURL: string | null;
}

export interface PurchasesOffering {
  identifier: string;
  availablePackages: PurchasesPackage[];
}

export interface PurchasesPackage {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    priceString: string;
  };
}

export interface PurchasesError {
  code: number;
  message: string;
}

// RevenueCat API key - production iOS public key
const REVENUECAT_API_KEY = 'appl_iWiJYqhMXWRafzSqHZCdsuCdagJ';

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
let isAvailable = NATIVE_MODULES_AVAILABLE; // Based on early native module check

/**
 * Load RevenueCat modules lazily.
 * Returns false if modules couldn't be loaded (native not linked).
 */
async function loadModules(): Promise<boolean> {
  // Early exit if native modules not available (checked at load time)
  if (isAvailable === false) {
    return false;
  }

  // Already loaded
  if (Purchases !== undefined) {
    return true;
  }

  try {
    // Dynamic import - only runs if native modules are confirmed available
    const purchasesModule = await import('react-native-purchases');
    const purchasesUIModule = await import('react-native-purchases-ui');

    Purchases = purchasesModule.default;
    LOG_LEVEL = purchasesModule.LOG_LEVEL;
    PURCHASES_ERROR_CODE = purchasesModule.PURCHASES_ERROR_CODE;
    RevenueCatUI = purchasesUIModule.default;
    PAYWALL_RESULT = purchasesUIModule.PAYWALL_RESULT;
    return true;
  } catch {
    // Silently mark as unavailable
    isAvailable = false;
    return false;
  }
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
    const modulesLoaded = await loadModules();
    if (modulesLoaded === false) {
      // Native modules not available - silently skip
      isConfigured = true;
      return;
    }

    // Silence SDK logs
    Purchases.setLogLevel(LOG_LEVEL.ERROR);

    await Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
    });

    isConfigured = true;
    // RevenueCat: Configured successfully');
  } catch {
    // Configuration failed - silently mark as configured to prevent retry loops
    isConfigured = true;
  }
}

/**
 * Login user to RevenueCat with Supabase user ID.
 * Links RevenueCat purchases to Supabase user.
 */
export async function login(userId: string): Promise<CustomerInfo | null> {
  try {
    const modulesLoaded = await loadModules();
    if (modulesLoaded === false) {
      return null;
    }
    const { customerInfo } = await Purchases.logIn(userId);
    // RevenueCat: User logged in', userId);
    return customerInfo;
  } catch (error) {
    // Silently fail - IAP not available
    return null;
  }
}

/**
 * Logout user from RevenueCat.
 * Creates a new anonymous user.
 */
export async function logout(): Promise<CustomerInfo | null> {
  try {
    const modulesLoaded = await loadModules();
    if (modulesLoaded === false) {
      return null;
    }
    const customerInfo = await Purchases.logOut();
    // RevenueCat: User logged out');
    return customerInfo;
  } catch (error) {
    // Silently fail - IAP not available
    return null;
  }
}

/**
 * Get current customer info.
 * Contains entitlements and subscription status.
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const modulesLoaded = await loadModules();
    if (modulesLoaded === false) {
      return null;
    }
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch {
    // Silently fail - IAP may not be configured
    return null;
  }
}

/**
 * Get available offerings (products).
 * Returns the current offering with packages.
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    const modulesLoaded = await loadModules();
    if (modulesLoaded === false) {
      return null;
    }
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    // Silently fail - offerings may not be configured
    return null;
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
    // RevenueCat: Purchase successful', result.productIdentifier);
    return {
      customerInfo: result.customerInfo,
      productIdentifier: result.productIdentifier,
    };
  } catch (error: unknown) {
    const purchaseError = error as PurchasesError;

    // Handle user cancellation
    if (purchaseError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      // RevenueCat: Purchase cancelled by user');
      throw new Error('PURCHASE_CANCELLED');
    }

    // Handle payment pending
    if (purchaseError.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
      // RevenueCat: Payment pending');
      throw new Error('PAYMENT_PENDING');
    }

    // Purchase failed - rethrow for UI handling
    throw error;
  }
}

/**
 * Restore previous purchases.
 * Used when user reinstalls or logs in on new device.
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    const modulesLoaded = await loadModules();
    if (modulesLoaded === false) {
      return null;
    }
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch {
    // Silently fail - restore may not be available
    return null;
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
        // RevenueCat: Paywall purchase completed');
        return { result: 'purchased', customerInfo: customerInfo ?? undefined };

      case PAYWALL_RESULT.RESTORED:
        const restoredInfo = await getCustomerInfo();
        // RevenueCat: Paywall restore completed');
        return { result: 'restored', customerInfo: restoredInfo ?? undefined };

      case PAYWALL_RESULT.CANCELLED:
        // RevenueCat: Paywall cancelled');
        return { result: 'cancelled' };

      case PAYWALL_RESULT.ERROR:
        // RevenueCat: Paywall error');
        return { result: 'error' };

      default:
        return { result: 'cancelled' };
    }
  } catch {
    // Silently fail - paywall may not be configured
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
        return { result: 'purchased', customerInfo: customerInfo ?? undefined };

      case PAYWALL_RESULT.RESTORED:
        const restoredInfo = await getCustomerInfo();
        return { result: 'restored', customerInfo: restoredInfo ?? undefined };

      case PAYWALL_RESULT.CANCELLED:
        return { result: 'cancelled' };

      case PAYWALL_RESULT.ERROR:
        return { result: 'error' };

      default:
        return { result: 'cancelled' };
    }
  } catch {
    // Silently fail - paywall may not be configured
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
    const modulesLoaded = await loadModules();
    if (modulesLoaded === false) {
      return;
    }
    await RevenueCatUI.presentCustomerCenter();
  } catch {
    // Silently fail - Customer Center may not be configured
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
    // Native module not available - return no-op
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
  return isConfigured === true && isAvailable === true;
}

/**
 * Check if RevenueCat native modules are available.
 */
export function isNativeAvailable(): boolean {
  return isAvailable === true;
}

/**
 * Get the subscription management URL.
 * Opens App Store subscription management.
 */
export async function getManagementURL(): Promise<string | null> {
  try {
    const customerInfo = await getCustomerInfo();
    return customerInfo?.managementURL ?? null;
  } catch {
    return null;
  }
}

/**
 * Sync purchases with RevenueCat.
 * Useful after app updates or to ensure latest state.
 */
export async function syncPurchases(): Promise<CustomerInfo | null> {
  try {
    const modulesLoaded = await loadModules();
    if (modulesLoaded === false) {
      return null;
    }
    await Purchases.syncPurchases();
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch {
    // Silently fail
    return null;
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
    const modulesLoaded = await loadModules();
    if (modulesLoaded === false) {
      return;
    }
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
  } catch {
    // Silently fail
  }
}
