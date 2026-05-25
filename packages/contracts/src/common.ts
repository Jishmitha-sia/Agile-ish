import { z } from 'zod';

/**
 * Branded ID schemas — all entity IDs in the system are CUIDs (Prisma default).
 * Branding gives compile-time safety against ID type mixups (passing a UserId
 * where a WorkspaceId is expected) without runtime cost.
 */
const cuid = () => z.string().cuid2().or(z.string().cuid());

export const UserId = cuid().brand<'UserId'>();
export const WorkspaceId = cuid().brand<'WorkspaceId'>();
export const ProjectId = cuid().brand<'ProjectId'>();
export const SprintId = cuid().brand<'SprintId'>();
export const IssueId = cuid().brand<'IssueId'>();
export const CommentId = cuid().brand<'CommentId'>();

export type UserId = z.infer<typeof UserId>;
export type WorkspaceId = z.infer<typeof WorkspaceId>;
export type ProjectId = z.infer<typeof ProjectId>;
export type SprintId = z.infer<typeof SprintId>;
export type IssueId = z.infer<typeof IssueId>;
export type CommentId = z.infer<typeof CommentId>;

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

/** Cursor-based pagination — the only style we accept for list endpoints. */
export const PaginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationQuery = z.infer<typeof PaginationQuery>;

export const paginatedResponse = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });

// ─────────────────────────────────────────────────────────────────────────────
// Error envelope — every non-2xx response conforms to this shape.
// Inspired by RFC 7807 (problem+json) but flattened for ergonomic client use.
// ─────────────────────────────────────────────────────────────────────────────

export const ApiErrorCode = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE_ENTITY',
  'TOO_MANY_REQUESTS',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export const ApiErrorResponse = z.object({
  code: ApiErrorCode,
  message: z.string(),
  // Field-level validation issues (Zod-shaped) for 400/422 responses.
  issues: z
    .array(
      z.object({
        path: z.array(z.union([z.string(), z.number()])),
        message: z.string(),
        code: z.string().optional(),
      }),
    )
    .optional(),
  requestId: z.string().optional(),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponse>;

// ─────────────────────────────────────────────────────────────────────────────
// Audit log envelope — emitted by every write operation.
// ─────────────────────────────────────────────────────────────────────────────

export const AuditAction = z.enum([
  // Auth
  'auth.signup',
  'auth.login',
  'auth.login.failed',
  'auth.logout',
  'auth.refresh',
  'auth.refresh.reused',
  'auth.password.changed',
  // Phase 1.5 — email verification + password reset
  'auth.email.verification_requested',
  'auth.email.verified',
  'auth.password.reset_requested',
  'auth.password.reset_completed',
  // Phase 1.5 — OAuth
  'auth.oauth.signin',
  'auth.oauth.signup',
  'auth.oauth.linked',
  // Workspaces
  'workspace.created',
  'workspace.updated',
  'workspace.deleted',
  'workspace.member.invited',
  'workspace.member.joined',
  'workspace.member.removed',
  'workspace.member.role_changed',
  // Projects
  'project.created',
  'project.updated',
  'project.deleted',
  // Workspace invitations (email-based)
  'workspace.invitation.created',
  'workspace.invitation.accepted',
  'workspace.invitation.revoked',
]);
export type AuditAction = z.infer<typeof AuditAction>;

// ─────────────────────────────────────────────────────────────────────────────
// Role / RBAC primitives — shared between auth claims and authorization checks.
// ─────────────────────────────────────────────────────────────────────────────

export const WorkspaceRole = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']);
export type WorkspaceRole = z.infer<typeof WorkspaceRole>;

/** Numeric rank for "at least this role" checks — higher = more privileged. */
export const workspaceRoleRank: Record<WorkspaceRole, number> = {
  GUEST: 0,
  MEMBER: 10,
  ADMIN: 20,
  OWNER: 30,
};

export const hasWorkspaceRole = (actual: WorkspaceRole, required: WorkspaceRole): boolean =>
  workspaceRoleRank[actual] >= workspaceRoleRank[required];
