/**
 * Tests subscription sync helpers and RevenueCat parsing.
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios },
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  LOG_LEVEL: { DEBUG: 'DEBUG' },
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  },
}));

jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  PAYWALL_RESULT: {
    PURCHASED: 'PURCHASED',
    RESTORED: 'RESTORED',
    CANCELED: 'CANCELED',
  },
  default: {
    presentPaywall: jest.fn(),
  },
}));

jest.mock('../services/supabase', () => {
  const singleResponses: Array<{ data: unknown; error: unknown }> = [];

  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    single: jest.fn(async () => singleResponses.shift() ?? { data: null, error: null }),
    update: jest.fn((payload) => {
      (builder as Record<string, unknown>).__lastUpdate = payload;
      return builder;
    }),
    insert: jest.fn((payload) => {
      (builder as Record<string, unknown>).__lastInsert = payload;
      return builder;
    }),
  };

  return {
    supabase: {
      from: jest.fn(() => builder),
      __setSingleResponses: (responses: Array<{ data: unknown; error: unknown }>) => {
        singleResponses.length = 0;
        singleResponses.push(...responses);
      },
      __getBuilder: () => builder,
    },
  };
});

import { CustomerInfo } from 'react-native-purchases';
import { ENTITLEMENTS, PRODUCT_IDS, parseSubscriptionStatus } from '../services/revenuecat';
import {
  formatExpirationDate,
  formatPeriod,
  formatSubscriptionStatus,
  syncToSupabase,
} from '../services/subscriptionSync';
import { supabase } from '../services/supabase';

type SupabaseMock = {
  from: jest.Mock;
  __setSingleResponses: (responses: Array<{ data: unknown; error: unknown }>) => void;
  __getBuilder: () => {
    select: jest.Mock;
    eq: jest.Mock;
    single: jest.Mock;
    update: jest.Mock;
    insert: jest.Mock;
    __lastInsert?: unknown;
    __lastUpdate?: unknown;
  };
};

const supabaseMock = supabase as unknown as SupabaseMock;

function createEntitlement(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const purchaseDate = '2025-01-01T12:00:00Z';
  const expirationDate = '2025-02-01T12:00:00Z';

  return {
    identifier: ENTITLEMENTS.PRO,
    isActive: true,
    willRenew: true,
    periodType: 'NORMAL',
    latestPurchaseDate: purchaseDate,
    latestPurchaseDateMillis: Date.parse(purchaseDate),
    originalPurchaseDate: purchaseDate,
    originalPurchaseDateMillis: Date.parse(purchaseDate),
    expirationDate,
    expirationDateMillis: Date.parse(expirationDate),
    store: 'APP_STORE',
    productIdentifier: PRODUCT_IDS.YEARLY,
    productPlanIdentifier: null,
    isSandbox: true,
    unsubscribeDetectedAt: null,
    unsubscribeDetectedAtMillis: null,
    billingIssueDetectedAt: null,
    billingIssueDetectedAtMillis: null,
    ownershipType: 'PURCHASED',
    verification: 'NOT_REQUESTED',
    ...overrides,
  };
}

function createCustomerInfo(
  entitlement?: Record<string, unknown>,
  overrides: Record<string, unknown> = {}
): CustomerInfo {
  const entitlementsMap = entitlement !== undefined
    ? { [ENTITLEMENTS.PRO]: entitlement }
    : {};

  return {
    entitlements: {
      active: entitlementsMap,
      all: entitlementsMap,
      verification: 'NOT_REQUESTED',
    } as unknown as CustomerInfo['entitlements'],
    activeSubscriptions: entitlement ? [entitlement.productIdentifier as string] : [],
    allPurchasedProductIdentifiers: entitlement ? [entitlement.productIdentifier as string] : [],
    latestExpirationDate: entitlement?.expirationDate as string | null ?? null,
    firstSeen: '2025-01-01T00:00:00Z',
    originalAppUserId: 'user_test',
    requestDate: '2025-01-02T00:00:00Z',
    managementURL: null,
    allExpirationDates: entitlement
      ? { [entitlement.productIdentifier as string]: entitlement.expirationDate }
      : {},
    allPurchaseDates: entitlement
      ? { [entitlement.productIdentifier as string]: entitlement.latestPurchaseDate }
      : {},
    originalApplicationVersion: '1.0.0',
    originalPurchaseDate: entitlement?.originalPurchaseDate as string | null ?? '2025-01-01T00:00:00Z',
    managementURL: null,
    nonSubscriptionTransactions: [],
    subscriptionsByProductIdentifier: {},
    ...overrides,
  } as unknown as CustomerInfo;
}

beforeEach(() => {
  jest.clearAllMocks();
  supabaseMock.__setSingleResponses([]);
});

describe('parseSubscriptionStatus', () => {
  it('flags premium yearly access from RevenueCat entitlement', () => {
    const entitlement = createEntitlement({ productIdentifier: PRODUCT_IDS.YEARLY });
    const customerInfo = createCustomerInfo(entitlement);

    const status = parseSubscriptionStatus(customerInfo);

    expect(status.isPro).toBe(true);
    expect(status.periodType).toBe('yearly');
    expect(status.productId).toBe(PRODUCT_IDS.YEARLY);
    expect(status.expirationDate?.toISOString()).toBe('2025-02-01T12:00:00.000Z');
    expect(status.willRenew).toBe(true);
  });

  it('detects trial periods', () => {
    const entitlement = createEntitlement({
      productIdentifier: PRODUCT_IDS.MONTHLY,
      periodType: 'TRIAL',
      expirationDate: '2025-01-10T12:00:00Z',
    });
    const customerInfo = createCustomerInfo(entitlement);

    const status = parseSubscriptionStatus(customerInfo);

    expect(status.isTrialing).toBe(true);
    expect(status.periodType).toBe('trial');
    expect(status.productId).toBe(PRODUCT_IDS.MONTHLY);
  });

  it('returns non-premium when entitlement missing', () => {
    const status = parseSubscriptionStatus(createCustomerInfo());

    expect(status.isPro).toBe(false);
    expect(status.periodType).toBeNull();
    expect(status.productId).toBeNull();
  });
});

describe('syncToSupabase', () => {
  it('creates a new premium subscription when none exists', async () => {
    const entitlement = createEntitlement({
      productIdentifier: PRODUCT_IDS.MONTHLY,
      expirationDate: '2025-03-01T12:00:00Z',
      latestPurchaseDate: '2025-02-01T12:00:00Z',
    });
    const customerInfo = createCustomerInfo(entitlement, { originalAppUserId: 'user_premium' });

    supabaseMock.__setSingleResponses([
      { data: null, error: { code: 'PGRST116' } },
      { data: { id: 'sub_new', status: 'active', plan: 'pro' }, error: null },
    ]);

    const result = await syncToSupabase('user_premium', customerInfo);
    const builder = supabaseMock.__getBuilder();
    const inserted = builder.insert.mock.calls[0][0];

    expect(builder.insert).toHaveBeenCalledTimes(1);
    expect(inserted.user_id).toBe('user_premium');
    expect(inserted.plan).toBe('pro');
    expect(inserted.status).toBe('active');
    expect(inserted.source).toBe('ios');
    expect(inserted.current_period_start).toBe('2025-02-01T12:00:00Z');
    expect(inserted.current_period_end).toBe('2025-03-01T12:00:00Z');
    expect(result?.plan).toBe('pro');
    expect(result?.status).toBe('active');
  });

  it('marks existing iOS subscription as expired when entitlement is gone', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-04-01T00:00:00Z'));

    supabaseMock.__setSingleResponses([
      { data: { id: 'sub_existing', status: 'active' }, error: null },
      {
        data: {
          id: 'sub_existing',
          status: 'expired',
          canceled_at: new Date().toISOString(),
        },
        error: null,
      },
    ]);

    const result = await syncToSupabase('user_basic', createCustomerInfo(undefined));
    const builder = supabaseMock.__getBuilder();
    const updatePayload = builder.update.mock.calls[0][0];

    expect(builder.update).toHaveBeenCalledTimes(1);
    expect(updatePayload.status).toBe('expired');
    expect(updatePayload.canceled_at).toBe(new Date().toISOString());
    expect(result?.status).toBe('expired');

    jest.useRealTimers();
  });
});

describe('format helpers', () => {
  it('formats period and subscription status labels', () => {
    expect(formatPeriod('monthly')).toBe('Monthly');
    expect(formatPeriod('yearly')).toBe('Yearly');
    expect(formatPeriod(null)).toBe('Free');
    expect(formatSubscriptionStatus('canceled')).toBe('Cancels at period end');
  });

  it('formats expiration dates for display', () => {
    const date = new Date('2025-04-01T12:00:00Z');
    expect(formatExpirationDate(date)).toBe('Apr 1, 2025');
    expect(formatExpirationDate(null)).toBe('N/A');
  });
});
