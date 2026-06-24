import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service.js';

import type {
  CreateSprintRequest,
  Issue,
  ProjectId,
  Sprint,
  SprintStatus,
  SprintWithIssues,
  UpdateSprintRequest,
  UserId,
  WorkspaceId,
} from '@agile-ish/contracts';

/**
 * SprintsService manages time-boxed iterations within a project.
 *
 * Business rules:
 *   - Only ONE sprint per project can be ACTIVE at a time.
 *   - Starting a sprint when another is ACTIVE is rejected with 400.
 *   - Completing a sprint moves its uncompleted issues back to BACKLOG.
 *   - Soft-delete via deletedAt (service layer enforces, no RLS yet for sprints).
 */
@Injectable()
export class SprintsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByProject(projectId: ProjectId, includeCompleted: boolean): Promise<Sprint[]> {
    const rows = await this.prisma.sprint.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(includeCompleted ? {} : { status: { not: 'COMPLETED' } }),
      },
      include: { _count: { select: { issues: { where: { deletedAt: null } } } } },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((r) => this.toDto(r));
  }

  async getWithIssues(projectId: ProjectId, sprintId: string): Promise<SprintWithIssues> {
    const row = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId, deletedAt: null },
      include: {
        issues: {
          where: { deletedAt: null },
          include: this.issueInclude(),
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        },
        _count: { select: { issues: { where: { deletedAt: null } } } },
      },
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sprint not found' });

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { identifierPrefix: true },
    });

    return {
      ...this.toDto(row),
      issues: row.issues.map((i) => this.issueToDto(i, project.identifierPrefix)),
    };
  }

  async getActiveSprint(projectId: ProjectId): Promise<SprintWithIssues | null> {
    const row = await this.prisma.sprint.findFirst({
      where: { projectId, status: 'ACTIVE', deletedAt: null },
      include: {
        issues: {
          where: { deletedAt: null },
          include: this.issueInclude(),
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        },
        _count: { select: { issues: { where: { deletedAt: null } } } },
      },
    });
    if (!row) return null;

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { identifierPrefix: true },
    });

    return {
      ...this.toDto(row),
      issues: row.issues.map((i) => this.issueToDto(i, project.identifierPrefix)),
    };
  }

  async create(
    _actorId: UserId,
    _workspaceId: WorkspaceId,
    projectId: ProjectId,
    input: CreateSprintRequest,
  ): Promise<Sprint> {
    const row = await this.prisma.sprint.create({
      data: {
        projectId,
        name: input.name,
        ...(input.goal !== undefined ? { goal: input.goal } : {}),
        ...(input.startDate ? { startDate: new Date(input.startDate) } : {}),
        ...(input.endDate ? { endDate: new Date(input.endDate) } : {}),
      },
      include: { _count: { select: { issues: { where: { deletedAt: null } } } } },
    });
    return this.toDto(row);
  }

  async update(
    _actorId: UserId,
    _workspaceId: WorkspaceId,
    projectId: ProjectId,
    sprintId: string,
    patch: UpdateSprintRequest,
  ): Promise<Sprint> {
    const existing = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sprint not found' });

    // Starting a sprint: ensure no other sprint is currently ACTIVE
    if (patch.status === 'ACTIVE' && existing.status !== 'ACTIVE') {
      const active = await this.prisma.sprint.findFirst({
        where: { projectId, status: 'ACTIVE', deletedAt: null },
      });
      if (active) {
        throw new BadRequestException({
          code: 'SPRINT_ALREADY_ACTIVE',
          message: 'Another sprint is already active in this project. Complete it first.',
        });
      }
    }

    // Completing a sprint: move unfinished issues back to backlog without a sprint
    if (patch.status === 'COMPLETED' && existing.status === 'ACTIVE') {
      await this.prisma.issue.updateMany({
        where: {
          sprintId,
          deletedAt: null,
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
        data: { sprintId: null },
      });
    }

    const row = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.goal !== undefined ? { goal: patch.goal } : {}),
        ...(patch.startDate !== undefined
          ? { startDate: patch.startDate ? new Date(patch.startDate) : null }
          : {}),
        ...(patch.endDate !== undefined
          ? { endDate: patch.endDate ? new Date(patch.endDate) : null }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      },
      include: { _count: { select: { issues: { where: { deletedAt: null } } } } },
    });
    return this.toDto(row);
  }

  async deleteSprint(
    _actorId: UserId,
    _workspaceId: WorkspaceId,
    projectId: ProjectId,
    sprintId: string,
  ): Promise<void> {
    const existing = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sprint not found' });

    // Move all sprint issues back to backlog
    await this.prisma.issue.updateMany({
      where: { sprintId, deletedAt: null },
      data: { sprintId: null },
    });

    await this.prisma.sprint.update({
      where: { id: sprintId },
      data: { deletedAt: new Date() },
    });
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private toDto(row: {
    id: string;
    projectId: string;
    name: string;
    goal: string | null;
    startDate: Date | null;
    endDate: Date | null;
    status: SprintStatus;
    createdAt: Date;
    updatedAt: Date;
    _count: { issues: number };
  }): Sprint {
    return {
      id: row.id,
      projectId: row.projectId as ProjectId,
      name: row.name,
      goal: row.goal,
      startDate: row.startDate?.toISOString() ?? null,
      endDate: row.endDate?.toISOString() ?? null,
      status: row.status,
      issueCount: row._count.issues,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private issueInclude() {
    return {
      assignee: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      createdBy: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
    } as const;
  }

  private issueToDto(
    row: {
      id: string;
      projectId: string;
      number: number;
      title: string;
      description: string | null;
      type: Issue['type'];
      status: Issue['status'];
      priority: Issue['priority'];
      sprintId: string | null;
      assignee: { id: string; displayName: string; email: string; avatarUrl: string | null } | null;
      createdBy: {
        id: string;
        displayName: string;
        email: string;
        avatarUrl: string | null;
      } | null;
      dueDate: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    prefix: string,
  ): Issue {
    return {
      id: row.id as Issue['id'],
      projectId: row.projectId as ProjectId,
      number: row.number,
      identifier: `${prefix}-${row.number}`,
      title: row.title,
      description: row.description,
      type: row.type,
      status: row.status,
      priority: row.priority,
      sprintId: row.sprintId,
      assignee: row.assignee
        ? {
            id: row.assignee.id as UserId,
            displayName: row.assignee.displayName,
            email: row.assignee.email,
            avatarUrl: row.assignee.avatarUrl,
          }
        : null,
      createdBy: row.createdBy
        ? {
            id: row.createdBy.id as UserId,
            displayName: row.createdBy.displayName,
            email: row.createdBy.email,
            avatarUrl: row.createdBy.avatarUrl,
          }
        : null,
      dueDate: row.dueDate?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
