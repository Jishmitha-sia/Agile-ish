import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './api-error.js';

/**
 * Centralised query client config.
 *
 * - `staleTime: 30s` — most reads are eventually consistent; the realtime
 *   layer (Phase 4) will push invalidations, so a generous staleTime here
 *   avoids redundant refetches in the interim.
 * - `retry`: don't retry 4xx (they're caller errors). Retry 5xx + network
 *   errors twice with exponential backoff.
 * - `refetchOnWindowFocus: false` for now. Linear-style UX prefers
 *   deterministic state — invalidations come from realtime or user action,
 *   not focus.
 */
export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: 'always',
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        retry: false,
      },
    },
  });
