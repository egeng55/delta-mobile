/**
 * Subscription Sync Service - Syncs RevenueCat purchases to Supabase.
 *
 * SAFETY DECISIONS:
 * - RevenueCat CustomerInfo is source of truth for purchases
 * - Supabase stores subscription data for backend access
 * - Only syncs iOS purchases (source: 'ios')
 * - Maps RevenueCat entitlements to Supabase plan types
 */

import type { CustomerInfo } from 'react-native-purchases';
import { supabase } from './supabase';
import { parseSubscriptionStatus, PRODUCT_IDS, ENTITLEMENTS } from './revenuecat';

// Supabase subscription record
export interface SupabaseSubscription {
  id?: string;
  user_id: string;
  plan: 'free' | 'premium' | 'pro';
  status: 'active' | 'canceled' | 'expired' | 'trialing';
  source: 'web' | 'ios' | 'android' | 'manual';
  current_period_start: string;
  current_period_end: string;
  created_at?: string;
  canceled_at: string | null;
  revenuecat_customer_id?: string;
  revenuecat_product_id?: string;
}

/**
 * Map RevenueCat product to Supabase plan type.
 */
function mapProductToPlan(productId: string | null): 'free' | 'premium' | 'pro' {
  if (productId === null) {
    return 'free';
  }

  // Both monthly and yearly are pro plans
  if (productId === PRODUCT_IDS.MONTHLY || productId === PRODUCT_IDS.YEARLY) {
    return 'pro';
  }

  return 'free';
}

/**
 * Map RevenueCat status to Supabase status.
 */
function mapStatus(
  isActive: boolean,
  isTrialing: boolean,
  willRenew: boolean,
  expirationDate: Date | null
): 'active' | 'canceled' | 'expired' | 'trialing' {
  if (isTrialing === true) {
    return 'trialing';
  }

  if (isActive !== true) {
    // Check if expired
    if (expirationDate !== null && expirationDate < new Date()) {
      return 'expired';
    }
    return 'expired';
  }

  if (willRenew !== true) {
    return 'canceled';
  }

  return 'active';
}

/**
 * Sync RevenueCat CustomerInfo to Supabase subscriptions table.
 * Creates or updates the subscription record.
 */
export async function syncToSupabase(
  userId: string,
  customerInfo: CustomerInfo
): Promise<SupabaseSubscription | null> {
  const status = parseSubscriptionStatus(customerInfo);

  // If no pro entitlement, check if we need to clear/update existing subscription
  if (status.isPro !== true) {
    // Check for existing iOS subscription to mark as expired
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('source', 'ios')
      .single();

    if (existing !== null) {
      // Mark existing subscription as expired
      const { data: updated, error } = await supabase
        .from('subscriptions')
        .update({
          status: 'expired',
          canceled_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error !== null) {
        console.error('subscriptionSync: Failed to expire subscription', error);
        return null;
      }

      console.log('subscriptionSync: Subscription marked as expired');
      return updated as SupabaseSubscription;
    }

    // No subscription to update
    return null;
  }

  // User has pro entitlement - sync to Supabase
  const proEntitlement = customerInfo.entitlements.active[ENTITLEMENTS.PRO];
  if (proEntitlement === undefined) {
    return null;
  }

  const plan = mapProductToPlan(status.productId);
  const subscriptionStatus = mapStatus(
    status.isActive,
    status.isTrialing,
    status.willRenew,
    status.expirationDate
  );

  // Calculate period dates
  const purchaseDate = proEntitlement.latestPurchaseDate;
  const expirationDate = proEntitlement.expirationDate;

  const subscriptionData: Omit<SupabaseSubscription, 'id' | 'created_at'> = {
    user_id: userId,
    plan,
    status: subscriptionStatus,
    source: 'ios',
    current_period_start: purchaseDate ?? new Date().toISOString(),
    current_period_end: expirationDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    canceled_at: status.willRenew !== true && status.isActive === true ? new Date().toISOString() : null,
    revenuecat_customer_id: customerInfo.originalAppUserId,
    revenuecat_product_id: status.productId ?? undefined,
  };

  // Check for existing subscription
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'ios')
    .single();

  let result;

  if (existing !== null) {
    // Update existing subscription
    const { data, error } = await supabase
      .from('subscriptions')
      .update(subscriptionData)
      .eq('id', existing.id)
      .select()
      .single();

    if (error !== null) {
      console.error('subscriptionSync: Failed to update subscription', error);
      return null;
    }

    result = data;
    console.log('subscriptionSync: Subscription updated');
  } else {
    // Insert new subscription
    const { data, error } = await supabase
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (error !== null) {
      console.error('subscriptionSync: Failed to create subscription', error);
      return null;
    }

    result = data;
    console.log('subscriptionSync: Subscription created');
  }

  return result as SupabaseSubscription;
}

/**
 * Get current subscription from Supabase.
 */
export async function getSubscription(userId: string): Promise<SupabaseSubscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error !== null && error.code !== 'PGRST116') {
    console.error('subscriptionSync: Failed to get subscription', error);
    return null;
  }

  return data as SupabaseSubscription | null;
}

/**
 * Format subscription period for display.
 */
export function formatPeriod(periodType: 'monthly' | 'yearly' | 'trial' | 'lifetime' | null): string {
  switch (periodType) {
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
    case 'trial':
      return 'Trial';
    case 'lifetime':
      return 'Lifetime';
    default:
      return 'Free';
  }
}

/**
 * Format expiration date for display.
 */
export function formatExpirationDate(date: Date | null): string {
  if (date === null) {
    return 'N/A';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get human-readable subscription status.
 */
export function formatSubscriptionStatus(status: 'active' | 'canceled' | 'expired' | 'trialing'): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'canceled':
      return 'Cancels at period end';
    case 'expired':
      return 'Expired';
    case 'trialing':
      return 'Trial';
    default:
      return 'Unknown';
  }
}
