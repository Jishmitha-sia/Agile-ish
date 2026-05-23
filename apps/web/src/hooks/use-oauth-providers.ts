'use client';

import { useQuery } from '@tanstack/react-query';

import { clientEnv } from '../env.js';

import type { OAuthProvider, OAuthProvidersResponse } from '@agile-ish/contracts';

/**
 * Fetches which OAuth providers the API has configured. The response
 * drives the visibility of "Continue with X" buttons on /login + /signup —
 * a provider with no env-configured client ID stays hidden.
 *
 * Uses bare fetch (not the api-client) because this endpoint is public
 * and we don't want the auto-refresh dance to fire when nobody's logged in.
 */
export const useOAuthProviders = () =>
  useQuery({
    queryKey: ['auth', 'oauth-providers'],
    staleTime: Infinity, // server-config — doesn't change at runtime
    queryFn: async (): Promise<readonly OAuthProvider[]> => {
      const res = await fetch(`${clientEnv.NEXT_PUBLIC_API_BASE_URL}/auth/oauth/providers`);
      if (!res.ok) return [];
      const body = (await res.json()) as OAuthProvidersResponse;
      return body.providers;
    },
  });

/** Build the URL that kicks off the OAuth flow for a given provider. */
export const oauthStartUrl = (provider: OAuthProvider): string =>
  `${clientEnv.NEXT_PUBLIC_API_BASE_URL}/auth/oauth/${provider}/start`;
