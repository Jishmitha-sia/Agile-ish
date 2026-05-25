'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { createApiClient } from '../lib/api-client.js';
import { ApiError } from '../lib/api-error.js';
import { useAuthStore } from '../stores/auth.store.js';

import type { SessionResponse } from '@agile-ish/contracts';

/**
 * Initialise the API client at module load so the very first React render
 * already has it. Doing this in a useEffect leaves a window where any
 * useQuery firing during the first render hits "ApiClient not initialised"
 * — that surfaces as a swallowed query error and pages that depend on
 * unauthenticated lookups (like /invite/[token]) render as if the data
 * failed to load. The store getters used below are stable references, so
 * eager init is safe.
 */
if (typeof window !== 'undefined') {
  createApiClient({
    getAccessToken: () => useAuthStore.getState().accessToken,
    onRefreshed: (session) => useAuthStore.getState().setSession(session),
    onUnauthenticated: () => useAuthStore.getState().clearSession(),
  });
}

/**
 * Bootstraps the session on first mount.
 *
 * Flow on page load:
 *   1. Auth status starts as 'initializing'.
 *   2. We call /auth/refresh blindly. The refresh cookie is sent
 *      automatically (`credentials: 'include'`).
 *   3a. Success → store fills with session, status='authenticated'.
 *   3b. Failure → status='unauthenticated' (the API clears the cookie).
 *   4. Children render with a deterministic status.
 *
 * The `bootstrapped` ref ensures we only refresh once per mount even
 * under React Strict Mode's double-effect.
 */
export const AuthBootstrap = ({ children }: { children: ReactNode }) => {
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setStatus = useAuthStore((s) => s.setStatus);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
    void (async () => {
      try {
        const res = await fetch(`${apiBase}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          clearSession();
          return;
        }
        const data = (await res.json()) as SessionResponse;
        setSession(data);
      } catch {
        // Network error during bootstrap — treat as unauthenticated and
        // let the user manually sign in. Don't blow up the page.
        setStatus('unauthenticated');
      }
    })();
  }, [setSession, clearSession, setStatus]);

  return <>{children}</>;
};

// Re-export for ergonomics: callers can import ApiError from one place.
export { ApiError };
