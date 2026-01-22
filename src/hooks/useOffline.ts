/**
 * useOffline hook - Provides network status and offline caching utilities.
 */

import { useState, useEffect, useCallback } from 'react';
import * as offlineCache from '../services/offlineCache';

export interface UseOfflineOptions {
  resource: string;
  userId?: string;
}

export interface UseOfflineResult<T> {
  isOnline: boolean;
  data: T | null;
  fromCache: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: (forceRefresh?: boolean) => Promise<void>;
}

/**
 * Hook for network status monitoring.
 */
export function useNetworkStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState<boolean>(offlineCache.checkIsOnline());

  useEffect(() => {
    const unsubscribe = offlineCache.addConnectionListener((online) => {
      setIsOnline(online);
    });

    return unsubscribe;
  }, []);

  return { isOnline };
}

/**
 * Hook for fetching data with offline cache support.
 */
export function useOfflineData<T>(
  fetchFn: () => Promise<T>,
  options: UseOfflineOptions
): UseOfflineResult<T> {
  const { resource, userId } = options;
  const { isOnline } = useNetworkStatus();

  const [data, setData] = useState<T | null>(null);
  const [fromCache, setFromCache] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (forceRefresh: boolean = false): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await offlineCache.fetchWithCache(
        resource,
        fetchFn,
        userId,
        { forceRefresh }
      );

      if (result !== null) {
        setData(result.data);
        setFromCache(result.fromCache);
      } else {
        setError('No data available');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [resource, userId, fetchFn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch when coming back online
  useEffect(() => {
    if (isOnline && fromCache) {
      fetchData(true);
    }
  }, [isOnline, fromCache, fetchData]);

  const refetch = useCallback(async (forceRefresh: boolean = true): Promise<void> => {
    await fetchData(forceRefresh);
  }, [fetchData]);

  return {
    isOnline,
    data,
    fromCache,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for caching data manually.
 */
export function useCache() {
  const cache = useCallback(async <T>(
    resource: string,
    data: T,
    userId?: string
  ): Promise<void> => {
    await offlineCache.cacheData(resource, data, userId);
  }, []);

  const getCache = useCallback(async <T>(
    resource: string,
    userId?: string
  ): Promise<T | null> => {
    return offlineCache.getCachedData<T>(resource, userId);
  }, []);

  const clearCache = useCallback(async (
    resource: string,
    userId?: string
  ): Promise<void> => {
    await offlineCache.clearCache(resource, userId);
  }, []);

  const clearAllCache = useCallback(async (): Promise<void> => {
    await offlineCache.clearAllCache();
  }, []);

  return {
    cache,
    getCache,
    clearCache,
    clearAllCache,
  };
}
