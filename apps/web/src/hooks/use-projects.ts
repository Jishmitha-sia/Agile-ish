'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient } from '../lib/api-client.js';
import { useAuthStore } from '../stores/auth.store.js';

import type { CreateProjectRequest, Project, UpdateProjectRequest } from '@agile-ish/contracts';

/**
 * TanStack Query hooks for the projects surface.
 *
 * Project lists are workspace-scoped (cache key includes workspaceSlug).
 * Mutations invalidate the workspace's list so the sidebar's nested
 * Projects nav refetches after each change.
 *
 * Unlike workspaces, projects don't need to sync into the auth store —
 * memberships are workspace-level, not project-level (yet). React Query
 * cache is the single source of truth here.
 */

export const projectKeys = {
  all: ['projects'] as const,
  list: (workspaceSlug: string) => [...projectKeys.all, 'list', workspaceSlug] as const,
  detail: (workspaceSlug: string, projectSlug: string) =>
    [...projectKeys.all, 'detail', workspaceSlug, projectSlug] as const,
};

export const useProjects = (workspaceSlug: string | undefined) => {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: projectKeys.list(workspaceSlug ?? ''),
    enabled: status === 'authenticated' && Boolean(workspaceSlug),
    queryFn: async (): Promise<Project[]> => {
      return await getApiClient().get<Project[]>(`/workspaces/${workspaceSlug ?? ''}/projects`);
    },
  });
};

export const useProject = (workspaceSlug: string | undefined, projectSlug: string | undefined) => {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: projectKeys.detail(workspaceSlug ?? '', projectSlug ?? ''),
    enabled: status === 'authenticated' && Boolean(workspaceSlug) && Boolean(projectSlug),
    queryFn: async (): Promise<Project> => {
      return await getApiClient().get<Project>(
        `/workspaces/${workspaceSlug ?? ''}/projects/${projectSlug ?? ''}`,
      );
    },
  });
};

export const useCreateProject = (workspaceSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProjectRequest): Promise<Project> => {
      return await getApiClient().post<Project>(`/workspaces/${workspaceSlug}/projects`, input);
    },
    onSuccess: (project) => {
      queryClient.setQueryData<Project[] | undefined>(projectKeys.list(workspaceSlug), (prev) =>
        prev ? [project, ...prev] : [project],
      );
      queryClient.setQueryData(projectKeys.detail(workspaceSlug, project.slug), project);
    },
  });
};

export const useUpdateProject = (workspaceSlug: string, projectSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProjectRequest): Promise<Project> => {
      return await getApiClient().patch<Project>(
        `/workspaces/${workspaceSlug}/projects/${projectSlug}`,
        input,
      );
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(projectKeys.detail(workspaceSlug, projectSlug), updated);
      void queryClient.invalidateQueries({ queryKey: projectKeys.list(workspaceSlug) });
    },
  });
};

export const useDeleteProject = (workspaceSlug: string, projectSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await getApiClient().delete<void>(`/workspaces/${workspaceSlug}/projects/${projectSlug}`);
    },
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: projectKeys.detail(workspaceSlug, projectSlug),
      });
      queryClient.setQueryData<Project[] | undefined>(projectKeys.list(workspaceSlug), (prev) =>
        prev?.filter((p) => p.slug !== projectSlug),
      );
    },
  });
};
