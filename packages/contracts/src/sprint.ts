import { z } from 'zod';

import { ProjectId } from './common.js';
import { Issue } from './issue.js';

// ─────────────────────────────────────────────────────────────────────────────
// Sprint
// ─────────────────────────────────────────────────────────────────────────────

export const SprintStatus = z.enum(['PLANNED', 'ACTIVE', 'COMPLETED']);
export type SprintStatus = z.infer<typeof SprintStatus>;

export const Sprint = z.object({
  id: z.string().cuid(),
  projectId: ProjectId,
  name: z.string().min(1).max(100),
  goal: z.string().max(500).nullable(),
  startDate: z.string().datetime().nullable(),
  endDate: z.string().datetime().nullable(),
  status: SprintStatus,
  issueCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Sprint = z.infer<typeof Sprint>;

export const SprintWithIssues = Sprint.extend({
  issues: z.array(Issue),
});
export type SprintWithIssues = z.infer<typeof SprintWithIssues>;

export const CreateSprintRequest = z.object({
  name: z.string().trim().min(1).max(100),
  goal: z.string().max(500).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});
export type CreateSprintRequest = z.infer<typeof CreateSprintRequest>;

export const UpdateSprintRequest = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  goal: z.string().max(500).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  status: SprintStatus.optional(),
});
export type UpdateSprintRequest = z.infer<typeof UpdateSprintRequest>;
