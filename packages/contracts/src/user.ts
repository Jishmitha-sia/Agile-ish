import { z } from 'zod';

import { EmailSchema } from './auth.js';
import { UserId, WorkspaceId, WorkspaceRole } from './common.js';

export const UserPublicProfile = z.object({
  id: UserId,
  displayName: z.string(),
  avatarUrl: z.string().url().nullable(),
});
export type UserPublicProfile = z.infer<typeof UserPublicProfile>;

export const UserPrivateProfile = UserPublicProfile.extend({
  email: EmailSchema,
  emailVerifiedAt: z.string().datetime().nullable(),
  timezone: z.string().nullable(),
  locale: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type UserPrivateProfile = z.infer<typeof UserPrivateProfile>;

export const UpdateProfileRequest = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
  timezone: z.string().max(64).nullable().optional(),
  locale: z.string().max(16).nullable().optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

// ─────────────────────────────────────────────────────────────────────────────
// Membership (used in /workspaces/:id/members and /users/me responses).
// ─────────────────────────────────────────────────────────────────────────────

export const WorkspaceMembership = z.object({
  workspaceId: WorkspaceId,
  workspaceSlug: z.string(),
  workspaceName: z.string(),
  role: WorkspaceRole,
  joinedAt: z.string().datetime(),
});
export type WorkspaceMembership = z.infer<typeof WorkspaceMembership>;
