'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient } from '../lib/api-client.js';
import { useAuthStore } from '../stores/auth.store.js';

import type {
  CreateSprintRequest,
  Sprint,
  SprintWithIssues,
  UpdateSprintRequest,
} from '@agile-ish/contracts';

export const sprintKeys = {
  all: ['sprints'] as const,
  list: (workspaceSlug: string, projectSlug: string) =>
    [...sprintKeys.all, 'list', workspaceSlug, projectSlug] as const,
  active: (workspaceSlug: string, projectSlug: string) =>
    [...sprintKeys.all, 'active', workspaceSlug, projectSlug] as const,
  detail: (workspaceSlug: string, projectSlug: string, sprintId: string) =>
    [...sprintKeys.all, 'detail', workspaceSlug, projectSlug, sprintId] as const,
};

const sprintsPath = (workspaceSlug: string, projectSlug: string) =>
  `/workspaces/${workspaceSlug}/projects/${projectSlug}/sprints`;

export const useSprints = (
  workspaceSlug: string | undefined,
  projectSlug: string | undefined,
  includeCompleted = false,
) => {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: sprintKeys.list(workspaceSlug ?? '', projectSlug ?? ''),
    enabled: status === 'authenticated' && Boolean(workspaceSlug) && Boolean(projectSlug),
    queryFn: async (): Promise<Sprint[]> => {
      const api = getApiClient();
      const qs = includeCompleted ? '?includeCompleted=true' : '';
      const res = await api.get(`${sprintsPath(workspaceSlug!, projectSlug!)}${qs}`);
      return res as Sprint[];
    },
  });
};

export const useActiveSprint = (
  workspaceSlug: string | undefined,
  projectSlug: string | undefined,
) => {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: sprintKeys.active(workspaceSlug ?? '', projectSlug ?? ''),
    enabled: status === 'authenticated' && Boolean(workspaceSlug) && Boolean(projectSlug),
    queryFn: async (): Promise<SprintWithIssues | null> => {
      const api = getApiClient();
      const res = await api.get(`${sprintsPath(workspaceSlug!, projectSlug!)}/active`);
      return res as SprintWithIssues | null;
    },
  });
};

export const useCreateSprint = (workspaceSlug: string, projectSlug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSprintRequest) => {
      const api = getApiClient();
      return (await api.post(sprintsPath(workspaceSlug, projectSlug), input)) as Sprint;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sprintKeys.list(workspaceSlug, projectSlug) });
    },
  });
};

export const useUpdateSprint = (workspaceSlug: string, projectSlug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sprintId, patch }: { sprintId: string; patch: UpdateSprintRequest }) => {
      const api = getApiClient();
      return (await api.patch(`${sprintsPath(workspaceSlug, projectSlug)}/${sprintId}`, patch)) as Sprint;
    },
    onSuccess: () => {
      // refetchType:'active' forces mounted queries to re-fetch immediately
      // (not just mark stale). This ensures the active-sprint page updates
      // when a sprint is completed or started from the backlog page.
      void qc.invalidateQueries({ queryKey: sprintKeys.all, refetchType: 'active' });
      // Invalidate issues list too — completing a sprint may change which
      // issues appear on the board / backlog.
      void qc.invalidateQueries({
        queryKey: ['issues', 'list', workspaceSlug, projectSlug],
        refetchType: 'active',
      });
    },
  });
};

export const useDeleteSprint = (workspaceSlug: string, projectSlug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sprintId: string) => {
      const api = getApiClient();
      await api.delete(`${sprintsPath(workspaceSlug, projectSlug)}/${sprintId}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: sprintKeys.all });
    },
  });
};
