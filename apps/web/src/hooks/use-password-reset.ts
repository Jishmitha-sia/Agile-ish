'use client';

import { useMutation } from '@tanstack/react-query';

import { getApiClient } from '../lib/api-client.js';

import type {
  ConfirmPasswordResetRequest,
  RequestPasswordResetRequest,
} from '@agile-ish/contracts';

export const useRequestPasswordReset = () =>
  useMutation({
    mutationFn: async (input: RequestPasswordResetRequest): Promise<{ ok: true }> =>
      await getApiClient().post<{ ok: true }>('/auth/password-reset/request', input, {
        skipAuthRefresh: true,
      }),
  });

export const useConfirmPasswordReset = () =>
  useMutation({
    mutationFn: async (input: ConfirmPasswordResetRequest): Promise<{ reset: true }> =>
      await getApiClient().post<{ reset: true }>('/auth/password-reset/confirm', input, {
        skipAuthRefresh: true,
      }),
  });
