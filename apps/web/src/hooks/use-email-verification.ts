'use client';

import { useMutation } from '@tanstack/react-query';

import { getApiClient } from '../lib/api-client.js';

import type {
  ConfirmEmailVerificationRequest,
  RequestEmailVerificationRequest,
} from '@agile-ish/contracts';

export const useRequestEmailVerification = () =>
  useMutation({
    mutationFn: async (input: RequestEmailVerificationRequest): Promise<{ ok: true }> =>
      await getApiClient().post<{ ok: true }>('/auth/email-verification/request', input, {
        skipAuthRefresh: true,
      }),
  });

export const useConfirmEmailVerification = () =>
  useMutation({
    mutationFn: async (input: ConfirmEmailVerificationRequest): Promise<{ verified: true }> =>
      await getApiClient().post<{ verified: true }>('/auth/email-verification/confirm', input, {
        skipAuthRefresh: true,
      }),
  });
