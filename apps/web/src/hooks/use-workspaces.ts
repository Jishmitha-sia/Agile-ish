'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient } from '../lib/api-client.js';
import { useAuthStore } from '../stores/auth.store.js';

import type {
  AuthenticatedUser,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  Workspace,
} from '@agile-ish/contracts';

/**
 * TanStack Query hooks for the workspaces surface.
 *
 * Convention: write mutations refresh `/auth/me` so the auth store's
 * memberships list (used by the sidebar workspace switcher) reflects
 * the change immediately. Cheaper than maintaining a separate cache key.
 */

export const workspaceKeys = {
  all: ['workspaces'] as const,
  detail: (slug: string) => [...workspaceKeys.all, 'detail', slug] as const,
};

export const useWorkspace = (slug: string | undefined) => {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: workspaceKeys.detail(slug ?? ''),
    enabled: status === 'authenticated' && Boolean(slug),
    queryFn: async (): Promise<Workspace> => {
      return await getApiClient().get<Workspace>(`/workspaces/${slug ?? ''}`);
    },
  });
};

export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWorkspaceRequest): Promise<Workspace> => {
      const workspace = await getApiClient().post<Workspace>('/workspaces', input);
      // Synchronously add the new membership to the auth store BEFORE
      // returning. The caller will router.replace to /w/{slug} as soon
      // as we resolve; the workspace layout's `isMember` check reads
      // straight from this store and would otherwise race a follow-up
      // /auth/me fetch and bounce the user back to an old workspace.
      // The eventual /auth/me invalidation (in onSuccess) canonicalises
      // the rest of the user record.
      const current = useAuthStore.getState().user;
      if (current) {
        useAuthStore.getState().setUser({
          ...current,
          memberships: [
            ...current.memberships,
            {
              workspaceId: workspace.id,
              workspaceSlug: workspace.slug,
              workspaceName: workspace.name,
              role: 'OWNER',
            },
          ],
        });
      }
      return workspace;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      void refreshAuthStoreUser();
    },
  });
};

export const useUpdateWorkspace = (slug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateWorkspaceRequest): Promise<Workspace> => {
      const updated = await getApiClient().patch<Workspace>(`/workspaces/${slug}`, input);
      await refreshAuthStoreUser();
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(workspaceKeys.detail(slug), updated);
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
    },
  });
};

export const useDeleteWorkspace = (slug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await getApiClient().delete<void>(`/workspaces/${slug}`);
      // Synchronously drop the membership from the auth store. Same
      // race rationale as useCreateWorkspace — the sidebar re-renders
      // immediately and reads the store directly; relying on a follow-up
      // /auth/me fetch leaves a window where the dead workspace is still
      // in the switcher.
      const current = useAuthStore.getState().user;
      if (current) {
        useAuthStore.getState().setUser({
          ...current,
          memberships: current.memberships.filter((m) => m.workspaceSlug !== slug),
        });
      }
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: workspaceKeys.detail(slug) });
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      void refreshAuthStoreUser();
    },
  });
};

/**
 * Re-fetch /auth/me and push the result into the auth store so the
 * sidebar's memberships list updates without waiting for the user to
 * navigate or reload.
 */
async function refreshAuthStoreUser(): Promise<void> {
  try {
    // /auth/me is mounted as POST on the server (matches the bootstrap UI's
    // initial call — see auth.controller.ts) — using GET hits a 404.
    const me = await getApiClient().post<AuthenticatedUser>('/auth/me');
    useAuthStore.getState().setUser(me);
  } catch {
    // Non-fatal — the synchronous store update in each mutation has already
    // updated memberships; this background refresh is just a canonicalize.
  }
}
