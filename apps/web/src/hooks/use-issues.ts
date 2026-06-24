'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient } from '../lib/api-client.js';
import { useAuthStore } from '../stores/auth.store.js';
import { sprintKeys } from './use-sprints.js';

import type {
  CreateIssueRequest,
  Issue,
  ListIssuesQuery,
  UpdateIssueRequest,
} from '@agile-ish/contracts';

/**
 * TanStack Query hooks for the issues surface.
 *
 * Cache keys are scoped to `(workspaceSlug, projectSlug)` so multiple
 * projects coexist in the cache cleanly. Mutations update the list cache
 * in place (no extra fetch needed for the common "create → see it appear"
 * and "drag → see status update" flows). Optimistic mutations for status
 * changes land in Batch B alongside the DnD board.
 */

export const issueKeys = {
  all: ['issues'] as const,
  list: (workspaceSlug: string, projectSlug: string, query?: ListIssuesQuery) =>
    [...issueKeys.all, 'list', workspaceSlug, projectSlug, query ?? {}] as const,
  detail: (workspaceSlug: string, projectSlug: string, number: number) =>
    [...issueKeys.all, 'detail', workspaceSlug, projectSlug, number] as const,
};

const issuesBasePath = (workspaceSlug: string, projectSlug: string): string =>
  `/workspaces/${workspaceSlug}/projects/${projectSlug}/issues`;

export const useIssues = (
  workspaceSlug: string | undefined,
  projectSlug: string | undefined,
  query?: ListIssuesQuery,
) => {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: issueKeys.list(workspaceSlug ?? '', projectSlug ?? '', query),
    enabled: status === 'authenticated' && Boolean(workspaceSlug) && Boolean(projectSlug),
    queryFn: async (): Promise<Issue[]> => {
      const qs = new URLSearchParams();
      if (query?.status) qs.set('status', query.status);
      if (query?.type) qs.set('type', query.type);
      if (query?.assigneeUserId) qs.set('assigneeUserId', query.assigneeUserId);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return await getApiClient().get<Issue[]>(
        `${issuesBasePath(workspaceSlug ?? '', projectSlug ?? '')}${suffix}`,
      );
    },
  });
};

export const useIssue = (
  workspaceSlug: string | undefined,
  projectSlug: string | undefined,
  number: number | undefined,
) => {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: issueKeys.detail(workspaceSlug ?? '', projectSlug ?? '', number ?? 0),
    enabled:
      status === 'authenticated' &&
      Boolean(workspaceSlug) &&
      Boolean(projectSlug) &&
      Boolean(number),
    queryFn: async (): Promise<Issue> => {
      return await getApiClient().get<Issue>(
        `${issuesBasePath(workspaceSlug ?? '', projectSlug ?? '')}/${number ?? 0}`,
      );
    },
  });
};

/**
 * The no-filter ("All") list key. We patch this one directly on every
 * mutation so the currently-visible page reflects the change immediately.
 * Filtered variants get invalidated instead — they may include or exclude
 * the changed row depending on the filter, and re-deriving membership in
 * the client is error-prone (e.g. status change shifts which filter
 * applies). Letting the server be the source of truth for filtered views
 * is simpler and stays correct.
 */
function noFilterListKey(workspaceSlug: string, projectSlug: string) {
  return issueKeys.list(workspaceSlug, projectSlug, undefined);
}

/**
 * Invalidate every CACHED filtered list variant for this (ws, project),
 * skipping the no-filter list (which the caller patched directly). Active
 * filter views will refetch on next render; cached-but-inactive ones get
 * marked stale and refetch lazily.
 */
function invalidateFilteredLists(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  projectSlug: string,
): void {
  const noFilterStr = JSON.stringify({});
  void queryClient.invalidateQueries({
    queryKey: [...issueKeys.all, 'list', workspaceSlug, projectSlug],
    predicate: (q) => {
      const filter = q.queryKey[4];
      // The no-filter variant's key entry is `{}` (from `query ?? {}` in
      // the key builder). Anything else is a filtered variant.
      return JSON.stringify(filter ?? {}) !== noFilterStr;
    },
  });
}

export const useCreateIssue = (workspaceSlug: string, projectSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateIssueRequest): Promise<Issue> => {
      return await getApiClient().post<Issue>(issuesBasePath(workspaceSlug, projectSlug), input);
    },
    onSuccess: (issue) => {
      // Prepend to the no-filter list so the user sees the new issue
      // immediately if they're on the All view.
      queryClient.setQueryData<Issue[] | undefined>(
        noFilterListKey(workspaceSlug, projectSlug),
        (prev) => (prev ? [issue, ...prev] : [issue]),
      );
      // Seed the detail cache so clicking the new row is instant.
      queryClient.setQueryData(issueKeys.detail(workspaceSlug, projectSlug, issue.number), issue);
      // Filtered variants may or may not include the new issue (depends
      // on its default status vs the filter). Refetch them lazily so we
      // don't accidentally put a BACKLOG issue in the IN_PROGRESS list.
      invalidateFilteredLists(queryClient, workspaceSlug, projectSlug);
    },
  });
};

export const useUpdateIssue = (workspaceSlug: string, projectSlug: string, number: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateIssueRequest): Promise<Issue> => {
      return await getApiClient().patch<Issue>(
        `${issuesBasePath(workspaceSlug, projectSlug)}/${number}`,
        input,
      );
    },

    /**
     * Optimistic update — fires immediately when `mutate()` is called (e.g.
     * on drag-and-drop). We snapshot the no-filter list so we can roll back
     * on error, then apply the patch locally so the board reflects the change
     * without waiting for the server.
     */
    onMutate: async (input) => {
      // Cancel any in-flight refetches so they don't stomp the optimistic data.
      await queryClient.cancelQueries({
        queryKey: noFilterListKey(workspaceSlug, projectSlug),
      });

      // Snapshot — returned as context for rollback in onError.
      const snapshot = queryClient.getQueryData<Issue[]>(
        noFilterListKey(workspaceSlug, projectSlug),
      );

      // Optimistically update the no-filter list.
      queryClient.setQueryData<Issue[] | undefined>(
        noFilterListKey(workspaceSlug, projectSlug),
        (prev) =>
          prev?.map(
            (i): Issue =>
              i.number === number
                ? {
                    ...i,
                    // Only override fields that were actually provided in the patch.
                    ...(input.title !== undefined ? { title: input.title } : {}),
                    ...(input.description !== undefined ? { description: input.description } : {}),
                    ...(input.status !== undefined ? { status: input.status } : {}),
                    ...(input.priority !== undefined ? { priority: input.priority } : {}),
                    ...(input.type !== undefined ? { type: input.type } : {}),
                    ...(input.sprintId !== undefined ? { sprintId: input.sprintId } : {}),
                    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
                  }
                : i,
          ),
      );

      return { snapshot };
    },

    onSuccess: (updated) => {
      // Replace the optimistic row with the server-confirmed row (gets the
      // real updatedAt, identifier, etc.).
      queryClient.setQueryData(issueKeys.detail(workspaceSlug, projectSlug, number), updated);
      queryClient.setQueryData<Issue[] | undefined>(
        noFilterListKey(workspaceSlug, projectSlug),
        (prev) => prev?.map((i) => (i.id === updated.id ? updated : i)),
      );
    },

    onError: (_err, _input, context) => {
      // Roll back the optimistic change so the board snaps back.
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(noFilterListKey(workspaceSlug, projectSlug), context.snapshot);
      }
    },

    onSettled: () => {
      // Always invalidate filtered variants (on success OR error) so any
      // status-filter views stay consistent with the server.
      invalidateFilteredLists(queryClient, workspaceSlug, projectSlug);
      // Also invalidate sprint queries: the active-sprint kanban reads from
      // sprintKeys.active, not from the issues list cache. Invalidating here
      // ensures the sprint board re-fetches after a status/sprintId change.
      void queryClient.invalidateQueries({
        queryKey: sprintKeys.all,
        refetchType: 'active',
      });
    },
  });
};

export const useDeleteIssue = (workspaceSlug: string, projectSlug: string, number: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await getApiClient().delete<void>(`${issuesBasePath(workspaceSlug, projectSlug)}/${number}`);
    },
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: issueKeys.detail(workspaceSlug, projectSlug, number),
      });
      // Delete is unambiguous — the issue is gone from every list
      // regardless of filter. Drop the row from every cached variant in
      // place; no refetch needed.
      queryClient.setQueriesData<Issue[] | undefined>(
        { queryKey: [...issueKeys.all, 'list', workspaceSlug, projectSlug] },
        (prev) => prev?.filter((i) => i.number !== number),
      );
    },
  });
};
