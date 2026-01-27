# Archived: RevenueCat Integration

These files were archived on 2026-01-27 to defer monetization implementation for pre-seed startup phase.

## Files

- `revenuecat.ts` - RevenueCat SDK wrapper for iOS IAP
- `subscriptionSync.ts` - Syncs RevenueCat purchases to Supabase
- `subscriptionSync.test.ts` - Tests for subscription sync

## To Re-enable

1. Move these files back to their original locations:
   - `revenuecat.ts` → `src/services/revenuecat.ts`
   - `subscriptionSync.ts` → `src/services/subscriptionSync.ts`
   - `subscriptionSync.test.ts` → `src/__tests__/subscriptionSync.test.ts`

2. Restore dependencies in `package.json`:
   ```json
   "react-native-purchases": "^9.7.1",
   "react-native-purchases-ui": "^9.7.1"
   ```

3. Restore API key in `app.json` extra:
   ```json
   "revenueCatApiKey": "appl_iWiJYqhMXWRafzSqHZCdsuCdagJ"
   ```

4. Re-integrate into `AccessContext.tsx` and `SettingsScreen.tsx`

## RevenueCat Configuration

- API Key: `appl_iWiJYqhMXWRafzSqHZCdsuCdagJ`
- Entitlement: `Delta Health Intelligence Pro`
- Products: `monthly`, `yearly`
