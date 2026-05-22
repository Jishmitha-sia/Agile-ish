'use client';

import type { SessionResponse } from '@agile-ish/contracts';
import { useEffect, useRef, type ReactNode } from 'react';

import { ApiError } from '../lib/api-error.js';
import { createApiClient } from '../lib/api-client.js';
import { useAuthStore } from '../stores/auth.store.js';

/**
 * Initialises the API client + attempts a single /auth/refresh on first
 * mount to bootstrap the session.
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

  // Wire the API client once. Subsequent calls return the same instance.
  useEffect(() => {
    createApiClient({
      getAccessToken: () => useAuthStore.getState().accessToken,
      onRefreshed: (session) => setSession(session),
      onUnauthenticated: () => clearSession(),
    });
  }, [setSession, clearSession]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const apiBase = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? '';
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
