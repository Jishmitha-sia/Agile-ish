import { z } from 'zod';

import { UserId, WorkspaceId, WorkspaceRole } from './common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Slug rules — used in URLs (agile-ish.com/[workspaceSlug]/...).
// Lowercase alphanumeric + hyphens, no leading/trailing hyphens, 3-32 chars.
// ─────────────────────────────────────────────────────────────────────────────

export const WorkspaceSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');
export type WorkspaceSlug = z.infer<typeof WorkspaceSlug>;

// ─────────────────────────────────────────────────────────────────────────────
// Workspace entity (DTO, not DB row — `deletedAt` etc. never crosses the wire).
// ─────────────────────────────────────────────────────────────────────────────

export const Workspace = z.object({
  id: WorkspaceId,
  slug: WorkspaceSlug,
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullable(),
  avatarUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Workspace = z.infer<typeof Workspace>;

// ─────────────────────────────────────────────────────────────────────────────
// Create / update requests
// ─────────────────────────────────────────────────────────────────────────────

export const CreateWorkspaceRequest = z.object({
  name: z.string().trim().min(1).max(80),
  // Slug is server-derived if omitted; user can override.
  slug: WorkspaceSlug.optional(),
  description: z.string().max(500).optional(),
});
export type CreateWorkspaceRequest = z.infer<typeof CreateWorkspaceRequest>;

export const UpdateWorkspaceRequest = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
});
export type UpdateWorkspaceRequest = z.infer<typeof UpdateWorkspaceRequest>;

// ─────────────────────────────────────────────────────────────────────────────
// Members
// ─────────────────────────────────────────────────────────────────────────────

export const WorkspaceMember = z.object({
  userId: UserId,
  workspaceId: WorkspaceId,
  role: WorkspaceRole,
  joinedAt: z.string().datetime(),
  user: z.object({
    id: UserId,
    displayName: z.string(),
    email: z.string().email(),
    avatarUrl: z.string().url().nullable(),
  }),
});
export type WorkspaceMember = z.infer<typeof WorkspaceMember>;

export const InviteMemberRequest = z.object({
  email: z.string().email().toLowerCase(),
  role: WorkspaceRole.exclude(['OWNER']),
});
export type InviteMemberRequest = z.infer<typeof InviteMemberRequest>;

export const ChangeMemberRoleRequest = z.object({
  role: WorkspaceRole.exclude(['OWNER']),
});
export type ChangeMemberRoleRequest = z.infer<typeof ChangeMemberRoleRequest>;

// ─────────────────────────────────────────────────────────────────────────────
// Invitations — email-based, for users who do not yet have an account.
//
// `InviteMemberResponse` is a discriminated union — the same POST endpoint
// either creates a membership outright (existing user, returned with the
// `member` discriminator) or creates a pending invitation (new user, the
// `invitation` discriminator). The web client switches on this to toast
// the right message.
// ─────────────────────────────────────────────────────────────────────────────

export const WorkspaceInvitation = z.object({
  id: z.string(),
  workspaceId: WorkspaceId,
  email: z.string().email(),
  role: WorkspaceRole.exclude(['OWNER']),
  invitedBy: z
    .object({
      id: UserId,
      displayName: z.string(),
      email: z.string().email(),
    })
    .nullable(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type WorkspaceInvitation = z.infer<typeof WorkspaceInvitation>;

export const InviteMemberResponse = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('member'), member: WorkspaceMember }),
  z.object({ kind: z.literal('invitation'), invitation: WorkspaceInvitation }),
]);
export type InviteMemberResponse = z.infer<typeof InviteMemberResponse>;

/**
 * Public lookup — what the accept-invite page renders before the user has
 * authenticated. Returns only what's needed to confirm the invite is real
 * (workspace name, role, inviter handle). Token comes in via query string;
 * not in this shape.
 */
export const InvitationLookupResponse = z.object({
  workspace: z.object({
    slug: z.string(),
    name: z.string(),
  }),
  email: z.string().email(),
  role: WorkspaceRole.exclude(['OWNER']),
  inviterDisplayName: z.string().nullable(),
  expiresAt: z.string().datetime(),
});
export type InvitationLookupResponse = z.infer<typeof InvitationLookupResponse>;

export const AcceptInvitationRequest = z.object({
  token: z.string().min(1),
});
export type AcceptInvitationRequest = z.infer<typeof AcceptInvitationRequest>;

export const AcceptInvitationResponse = z.object({
  workspace: z.object({
    slug: z.string(),
    name: z.string(),
  }),
});
export type AcceptInvitationResponse = z.infer<typeof AcceptInvitationResponse>;
