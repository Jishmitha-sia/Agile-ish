'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient } from '../lib/api-client.js';
import { useAuthStore } from '../stores/auth.store.js';

import type {
  ChangeMemberRoleRequest,
  InviteMemberRequest,
  InviteMemberResponse,
  WorkspaceMember,
} from '@agile-ish/contracts';

/**
 * TanStack Query hooks for workspace members.
 *
 * Members live one level inside a workspace (the workspaceSlug is part
 * of the cache key). Mutations update the cache directly so the UI
 * reflects changes without an immediate refetch.
 */

export const memberKeys = {
  all: ['members'] as const,
  list: (workspaceSlug: string) => [...memberKeys.all, 'list', workspaceSlug] as const,
};

export const useMembers = (workspaceSlug: string | undefined) => {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: memberKeys.list(workspaceSlug ?? ''),
    enabled: status === 'authenticated' && Boolean(workspaceSlug),
    queryFn: async (): Promise<WorkspaceMember[]> => {
      return await getApiClient().get<WorkspaceMember[]>(
        `/workspaces/${workspaceSlug ?? ''}/members`,
      );
    },
  });
};

export const useInviteMember = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteMemberRequest): Promise<InviteMemberResponse> => {
      return await getApiClient().post<InviteMemberResponse>(
        `/workspaces/${workspaceSlug}/members`,
        input,
      );
    },
    onSuccess: (result) => {
      if (result.kind === 'member') {
        queryClient.setQueryData<WorkspaceMember[] | undefined>(
          memberKeys.list(workspaceSlug),
          (prev) => (prev ? [...prev, result.member] : [result.member]),
        );
      } else {
        // Pending invitation — refetch the invitations list.
        void queryClient.invalidateQueries({
          queryKey: ['invitations', 'list', workspaceSlug],
        });
      }
    },
  });
};

export const useChangeMemberRole = (workspaceSlug: string, userId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ChangeMemberRoleRequest): Promise<void> => {
      await getApiClient().patch<void>(`/workspaces/${workspaceSlug}/members/${userId}`, input);
    },
    onSuccess: (_, input) => {
      queryClient.setQueryData<WorkspaceMember[] | undefined>(
        memberKeys.list(workspaceSlug),
        (prev) => prev?.map((m) => (m.userId === userId ? { ...m, role: input.role } : m)),
      );
    },
  });
};

export const useRemoveMember = (workspaceSlug: string, userId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await getApiClient().delete<void>(`/workspaces/${workspaceSlug}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.setQueryData<WorkspaceMember[] | undefined>(
        memberKeys.list(workspaceSlug),
        (prev) => prev?.filter((m) => m.userId !== userId),
      );
    },
  });
};
