'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient } from '../lib/api-client.js';
import { useAuthStore } from '../stores/auth.store.js';

import type {
  AcceptInvitationResponse,
  AuthenticatedUser,
  InvitationLookupResponse,
  WorkspaceInvitation,
} from '@agile-ish/contracts';

/**
 * TanStack Query hooks for workspace invitations.
 *
 * `useInvitationLookup` runs unauthenticated (the accept-invite page is
 * public) — no `enabled` gate on auth status.
 */

export const invitationKeys = {
  all: ['invitations'] as const,
  list: (workspaceSlug: string) => [...invitationKeys.all, 'list', workspaceSlug] as const,
  lookup: (token: string) => [...invitationKeys.all, 'lookup', token] as const,
};

export const useInvitations = (workspaceSlug: string | undefined) => {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: invitationKeys.list(workspaceSlug ?? ''),
    enabled: status === 'authenticated' && Boolean(workspaceSlug),
    queryFn: async (): Promise<WorkspaceInvitation[]> => {
      return await getApiClient().get<WorkspaceInvitation[]>(
        `/workspaces/${workspaceSlug ?? ''}/invitations`,
      );
    },
  });
};

export const useRevokeInvitation = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string): Promise<void> => {
      await getApiClient().delete<void>(`/workspaces/${workspaceSlug}/invitations/${invitationId}`);
    },
    onSuccess: (_, invitationId) => {
      queryClient.setQueryData<WorkspaceInvitation[] | undefined>(
        invitationKeys.list(workspaceSlug),
        (prev) => prev?.filter((i) => i.id !== invitationId),
      );
    },
  });
};

export const useInvitationLookup = (token: string | undefined) => {
  return useQuery({
    queryKey: invitationKeys.lookup(token ?? ''),
    enabled: Boolean(token),
    retry: false,
    queryFn: async (): Promise<InvitationLookupResponse> => {
      return await getApiClient().get<InvitationLookupResponse>(
        `/workspace-invitations/lookup?token=${encodeURIComponent(token ?? '')}`,
      );
    },
  });
};

export const useAcceptInvitation = () => {
  return useMutation({
    mutationFn: async (token: string): Promise<AcceptInvitationResponse> => {
      const result = await getApiClient().post<AcceptInvitationResponse>(
        '/workspace-invitations/accept',
        { token },
      );
      // Refresh the auth store BEFORE returning so the new membership is
      // present by the time the caller navigates to /w/{slug}. Otherwise
      // the workspace layout's client-side `isMember` check races the
      // refresh and bounces the user back to their first membership.
      try {
        const me = await getApiClient().post<AuthenticatedUser>('/auth/me');
        useAuthStore.getState().setUser(me);
      } catch {
        // Non-fatal — the next /auth/me query will canonicalise.
      }
      return result;
    },
  });
};
