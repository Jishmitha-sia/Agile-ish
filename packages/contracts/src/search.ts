import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Workspace-scoped search result shapes
// ─────────────────────────────────────────────────────────────────────────────

export const SearchResultIssue = z.object({
  kind: z.literal('issue'),
  id: z.string(),
  identifier: z.string(), // e.g. "KT-3"
  title: z.string(),
  status: z.string(),
  projectSlug: z.string(),
  workspaceSlug: z.string(),
});
export type SearchResultIssue = z.infer<typeof SearchResultIssue>;

export const SearchResultProject = z.object({
  kind: z.literal('project'),
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  identifierPrefix: z.string(),
  workspaceSlug: z.string(),
});
export type SearchResultProject = z.infer<typeof SearchResultProject>;

export const SearchResultMember = z.object({
  kind: z.literal('member'),
  id: z.string(),
  displayName: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
});
export type SearchResultMember = z.infer<typeof SearchResultMember>;

export const SearchResult = z.discriminatedUnion('kind', [
  SearchResultIssue,
  SearchResultProject,
  SearchResultMember,
]);
export type SearchResult = z.infer<typeof SearchResult>;

export const SearchResponse = z.object({
  results: z.array(SearchResult),
});
export type SearchResponse = z.infer<typeof SearchResponse>;
