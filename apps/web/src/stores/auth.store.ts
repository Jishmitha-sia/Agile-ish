import type { AuthenticatedUser, SessionResponse } from '@agile-ish/contracts';
import { create } from 'zustand';

/**
 * Auth store — in-memory only.
 *
 * The access token NEVER touches localStorage / sessionStorage. Keeping
 * it in memory means:
 *   • XSS that runs JS can't lift the token from storage.
 *   • A page reload requires a /auth/refresh call to re-acquire it
 *     using the httpOnly refresh cookie. The refresh cookie itself is
 *     never readable by JS — that's the whole point of `HttpOnly`.
 *
 * Status semantics:
 *   • 'initializing' — first paint, refresh hasn't completed yet.
 *   • 'authenticated' — have a valid access token and user profile.
 *   • 'unauthenticated' — refresh failed or user logged out.
 *
 * Components that need to render auth-gated UI MUST handle 'initializing'
 * (e.g. show a skeleton) — otherwise a brief logged-out flash appears on
 * every reload.
 */

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  accessToken: string | null;
  accessTokenExpiresAt: number | null; // epoch ms

  setSession: (session: SessionResponse) => void;
  clearSession: () => void;
  setUser: (user: AuthenticatedUser) => void;
  setStatus: (status: AuthStatus) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'initializing',
  user: null,
  accessToken: null,
  accessTokenExpiresAt: null,

  setSession: (session) =>
    set({
      status: 'authenticated',
      user: session.user,
      accessToken: session.accessToken,
      accessTokenExpiresAt: Date.parse(session.accessTokenExpiresAt),
    }),

  clearSession: () =>
    set({
      status: 'unauthenticated',
      user: null,
      accessToken: null,
      accessTokenExpiresAt: null,
    }),

  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
}));

/**
 * Non-React accessor for the api client. The store's `getState()` returns
 * the current snapshot synchronously — exactly what the fetch wrapper needs
 * before issuing a request.
 */
export const getAuthTokenSync = (): string | null => useAuthStore.getState().accessToken;
