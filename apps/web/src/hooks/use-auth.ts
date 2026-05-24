'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient } from '../lib/api-client.js';
import { useAuthStore } from '../stores/auth.store.js';

import type {
  AuthenticatedUser,
  LoginRequest,
  SessionResponse,
  SignupRequest,
} from '@agile-ish/contracts';

/**
 * TanStack Query hooks for the auth surface.
 *
 * Mutations write to the auth store via the same callback the API client
 * uses — keeps the store the single source of truth.
 *
 * The `me` query is gated by `status === 'authenticated'` so we don't
 * blast the server during the initial refresh boot.
 */

export const useLogin = () => {
  return useMutation({
    mutationFn: async (input: LoginRequest): Promise<SessionResponse> => {
      return await getApiClient().post<SessionResponse>('/auth/login', input);
    },
    onSuccess: (session) => {
      useAuthStore.getState().setSession(session);
    },
  });
};

export const useSignup = () => {
  return useMutation({
    mutationFn: async (input: SignupRequest): Promise<SessionResponse> => {
      return await getApiClient().post<SessionResponse>('/auth/signup', input);
    },
    onSuccess: (session) => {
      useAuthStore.getState().setSession(session);
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await getApiClient().post<void>('/auth/logout');
    },
    onSettled: () => {
      useAuthStore.getState().clearSession();
      queryClient.clear();
    },
  });
};

export const useCurrentUser = () => {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: ['users', 'me'],
    enabled: status === 'authenticated',
    queryFn: async (): Promise<AuthenticatedUser> => {
      // /auth/me is mounted as POST on the server — see auth.controller.ts.
      return await getApiClient().post<AuthenticatedUser>('/auth/me');
    },
  });
};
