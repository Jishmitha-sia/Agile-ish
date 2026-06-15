import { z } from 'zod';

import { IssueId, ProjectId, UserId } from './common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Issue status + priority — fixed enum sets (Linear convention). We do NOT
// expose per-project customisable columns yet; if real demand surfaces,
// Phase 4+ can add a separate WorkflowStates table without breaking this
// contract (the API would accept the existing enum AND a custom-status-id
// in a discriminated union).
// ─────────────────────────────────────────────────────────────────────────────

export const IssueStatus = z.enum([
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'CANCELLED',
]);
export type IssueStatus = z.infer<typeof IssueStatus>;

/** Display-ordered status list — used by the board view + filter chips. */
export const ISSUE_STATUS_ORDER: readonly IssueStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'CANCELLED',
];

export const IssuePriority = z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export type IssuePriority = z.infer<typeof IssuePriority>;

export const ISSUE_PRIORITY_ORDER: readonly IssuePriority[] = [
  'URGENT',
  'HIGH',
  'MEDIUM',
  'LOW',
  'NONE',
];

// ─────────────────────────────────────────────────────────────────────────────
// Type — orthogonal to status. Identifies WHAT the work is, not where it is
// in the workflow. Fixed enum (no per-project custom types yet) — matches
// the simplicity gate. Free-form labels can come later when teams ask.
// ─────────────────────────────────────────────────────────────────────────────

export const IssueType = z.enum(['BUG', 'FEATURE', 'CHORE', 'TASK']);
export type IssueType = z.infer<typeof IssueType>;

export const ISSUE_TYPE_ORDER: readonly IssueType[] = [
  'FEATURE',
  'BUG',
  'CHORE',
  'TASK',
];

// ─────────────────────────────────────────────────────────────────────────────
// Issue DTO — what crosses the wire. `identifier` is the human-readable
// composite (e.g. "ENG-42") composed server-side from the parent project's
// `identifierPrefix` and the issue's `number`. We send it pre-formatted so
// the web doesn't have to re-fetch the project to render it.
// ─────────────────────────────────────────────────────────────────────────────

const IssueUserSummary = z.object({
  id: UserId,
  displayName: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().url().nullable(),
});
export type IssueUserSummary = z.infer<typeof IssueUserSummary>;

export const Issue = z.object({
  id: IssueId,
  projectId: ProjectId,
  number: z.number().int().positive(),
  identifier: z.string(), // e.g. "ENG-42"
  title: z.string().min(1).max(200),
  description: z.string().nullable(),
  type: IssueType,
  status: IssueStatus,
  priority: IssuePriority,
  assignee: IssueUserSummary.nullable(),
  createdBy: IssueUserSummary.nullable(),
  dueDate: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Issue = z.infer<typeof Issue>;

// ─────────────────────────────────────────────────────────────────────────────
// Create / update requests
// ─────────────────────────────────────────────────────────────────────────────

export const CreateIssueRequest = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20_000).optional(),
  type: IssueType.optional(),           // defaults to TASK server-side
  status: IssueStatus.optional(),       // defaults to BACKLOG server-side
  priority: IssuePriority.optional(),   // defaults to NONE server-side
  assigneeUserId: UserId.nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});
export type CreateIssueRequest = z.infer<typeof CreateIssueRequest>;

export const UpdateIssueRequest = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(20_000).nullable().optional(),
  type: IssueType.optional(),
  status: IssueStatus.optional(),
  priority: IssuePriority.optional(),
  assigneeUserId: UserId.nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});
export type UpdateIssueRequest = z.infer<typeof UpdateIssueRequest>;

// ─────────────────────────────────────────────────────────────────────────────
// List query — keep filters tight for Phase 3 Batch A; Batch B's board view
// only needs project-scoped reads. Sprints + search land in Batch C.
// ─────────────────────────────────────────────────────────────────────────────

export const ListIssuesQuery = z.object({
  status: IssueStatus.optional(),
  type: IssueType.optional(),
  assigneeUserId: UserId.optional(),
});
export type ListIssuesQuery = z.infer<typeof ListIssuesQuery>;
