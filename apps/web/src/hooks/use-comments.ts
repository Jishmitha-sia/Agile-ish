'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient } from '../lib/api-client.js';
import { useAuthStore } from '../stores/auth.store.js';

import type {
  CreateCommentRequest,
  IssueComment,
  UpdateCommentRequest,
} from '@agile-ish/contracts';

export const commentKeys = {
  all: ['comments'] as const,
  list: (workspaceSlug: string, issueId: string) =>
    [...commentKeys.all, 'list', workspaceSlug, issueId] as const,
};

export const useComments = (workspaceSlug: string | undefined, issueId: string | undefined) => {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: commentKeys.list(workspaceSlug ?? '', issueId ?? ''),
    enabled: status === 'authenticated' && Boolean(workspaceSlug) && Boolean(issueId),
    queryFn: async (): Promise<IssueComment[]> => {
      const api = getApiClient();
      const res = await api.get(`/workspaces/${workspaceSlug}/issues/${issueId}/comments`);
      return res as IssueComment[];
    },
  });
};

export const useCreateComment = (workspaceSlug: string, issueId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCommentRequest) => {
      const api = getApiClient();
      return (await api.post(`/workspaces/${workspaceSlug}/issues/${issueId}/comments`, input)) as IssueComment;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: commentKeys.list(workspaceSlug, issueId) });
    },
  });
};

export const useUpdateComment = (workspaceSlug: string, issueId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      commentId,
      patch,
    }: {
      commentId: string;
      patch: UpdateCommentRequest;
    }) => {
      const api = getApiClient();
      return (await api.patch(`/workspaces/${workspaceSlug}/comments/${commentId}`, patch)) as IssueComment;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: commentKeys.list(workspaceSlug, issueId) });
    },
  });
};

export const useDeleteComment = (workspaceSlug: string, issueId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const api = getApiClient();
      await api.delete(`/workspaces/${workspaceSlug}/comments/${commentId}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: commentKeys.list(workspaceSlug, issueId) });
    },
  });
};
