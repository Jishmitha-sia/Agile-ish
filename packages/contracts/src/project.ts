import { z } from 'zod';

import { ProjectId, UserId, WorkspaceId } from './common.js';

// ─────────────────────────────────────────────────────────────────────────────
// Slug rules — unique within a workspace. Lowercase alphanumeric + hyphens.
// Mirrors WorkspaceSlug shape so URL paths read uniformly.
// ─────────────────────────────────────────────────────────────────────────────

export const ProjectSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(32)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');
export type ProjectSlug = z.infer<typeof ProjectSlug>;

// ─────────────────────────────────────────────────────────────────────────────
// Identifier prefix — seeds the per-project issue numbering (ENG-1, ENG-2…).
// Uppercase letters + digits; must start with a letter. Unique per workspace
// so an issue's prefix unambiguously names its project at a glance.
// ─────────────────────────────────────────────────────────────────────────────

export const ProjectIdentifierPrefix = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(8)
  .regex(/^[A-Z][A-Z0-9]*$/, 'Prefix must be uppercase letters (with optional trailing digits)');
export type ProjectIdentifierPrefix = z.infer<typeof ProjectIdentifierPrefix>;

// ─────────────────────────────────────────────────────────────────────────────
// Visibility — present in the schema for Phase 3+ RBAC. Phase 2 always PUBLIC.
// ─────────────────────────────────────────────────────────────────────────────

export const ProjectVisibility = z.enum(['PUBLIC', 'PRIVATE']);
export type ProjectVisibility = z.infer<typeof ProjectVisibility>;

// ─────────────────────────────────────────────────────────────────────────────
// Project DTO — what crosses the wire. `issueCounter`, `archivedAt`,
// `leadUserId` are present in the schema but exposed here so the web can
// render them once Phase 3 starts emitting issues.
// ─────────────────────────────────────────────────────────────────────────────

export const Project = z.object({
  id: ProjectId,
  workspaceId: WorkspaceId,
  slug: ProjectSlug,
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullable(),
  identifierPrefix: ProjectIdentifierPrefix,
  issueCounter: z.number().int().nonnegative(),
  visibility: ProjectVisibility,
  leadUserId: UserId.nullable(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Project = z.infer<typeof Project>;

// ─────────────────────────────────────────────────────────────────────────────
// Create / update requests
// ─────────────────────────────────────────────────────────────────────────────

export const CreateProjectRequest = z.object({
  name: z.string().trim().min(1).max(80),
  // Slug is server-derived if omitted; user can override.
  slug: ProjectSlug.optional(),
  // Identifier prefix is auto-derived from the name (first letters uppercased)
  // when omitted; user can override.
  identifierPrefix: ProjectIdentifierPrefix.optional(),
  description: z.string().max(500).optional(),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequest>;

export const UpdateProjectRequest = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
});
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequest>;
