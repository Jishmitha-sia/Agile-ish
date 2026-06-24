import {
  type CreateIssueRequest,
  type Issue,
  type IssueId,
  type ListIssuesQuery,
  type ProjectId,
  type UpdateIssueRequest,
  type UserId,
  type WorkspaceId,
} from '@agile-ish/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';

import { EventBus } from '../../infra/events/events.module.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

import {
  IssueCreatedEvent,
  IssueDeletedEvent,
  IssueStatusChangedEvent,
  IssueUpdatedEvent,
} from './events/issue.events.js';

/**
 * Issues are the unit of work inside a Project.
 *
 * Identifier minting: each Project carries a monotonically increasing
 * `issueCounter`. Creating an issue runs `project.update({ data: {
 * issueCounter: { increment: 1 } } })` inside a transaction — the row
 * lock that Postgres acquires for the UPDATE serialises concurrent
 * inserts naturally, so two parallel creates can never mint the same
 * number. We use the returned `issueCounter` value as the issue's
 * `number` and format the wire identifier as `${prefix}-${number}`.
 *
 * Soft-delete from day one. All reads filter `deletedAt: null`. The
 * RLS policy joins through the parent project to discover the workspace,
 * but the service layer enforces project ownership explicitly so we
 * return clean 404s for cross-project ID guessing.
 */
@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBus,
  ) {}

  async create(
    actorId: UserId,
    workspaceId: WorkspaceId,
    projectId: ProjectId,
    input: CreateIssueRequest,
  ): Promise<Issue> {
    const issue = await this.prisma.$transaction(async (tx) => {
      // Atomic increment + read of the new counter value. Concurrent
      // requests serialise here because Postgres takes a row lock on
      // the projects row for the duration of the UPDATE.
      const project = await tx.project.update({
        where: { id: projectId },
        data: { issueCounter: { increment: 1 } },
        select: { issueCounter: true, identifierPrefix: true },
      });

      return await tx.issue.create({
        data: {
          projectId,
          number: project.issueCounter,
          title: input.title,
          ...(input.description ? { description: input.description } : {}),
          ...(input.type ? { type: input.type } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.priority ? { priority: input.priority } : {}),
          ...(input.assigneeUserId !== undefined ? { assigneeUserId: input.assigneeUserId } : {}),
          ...(input.dueDate !== undefined
            ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
            : {}),
          createdByUserId: actorId,
        },
        include: this.includeUsers(),
      });
    });

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { identifierPrefix: true },
    });
    const dto = this.toDto(issue, project.identifierPrefix);

    await this.events.publish(
      new IssueCreatedEvent({
        issueId: dto.id,
        projectId,
        workspaceId,
        actorId,
        identifier: dto.identifier,
        title: dto.title,
        type: dto.type,
      }),
    );

    return dto;
  }

  async listByProject(projectId: ProjectId, query: ListIssuesQuery): Promise<Issue[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { identifierPrefix: true },
    });
    if (!project) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Project not found' });
    }

    const rows = await this.prisma.issue.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.assigneeUserId ? { assigneeUserId: query.assigneeUserId } : {}),
      },
      orderBy: [
        // BACKLOG/TODO/IN_PROGRESS/IN_REVIEW first, DONE/CANCELLED last —
        // active work surfaces by default.
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
      include: this.includeUsers(),
    });

    return rows.map((r) => this.toDto(r, project.identifierPrefix));
  }

  async getByNumber(projectId: ProjectId, number: number): Promise<Issue> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { identifierPrefix: true },
    });
    if (!project) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Project not found' });
    }

    const issue = await this.prisma.issue.findFirst({
      where: { projectId, number, deletedAt: null },
      include: this.includeUsers(),
    });
    if (!issue) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Issue not found' });
    }
    return this.toDto(issue, project.identifierPrefix);
  }

  async update(
    actorId: UserId,
    workspaceId: WorkspaceId,
    projectId: ProjectId,
    issueId: IssueId,
    patch: UpdateIssueRequest,
  ): Promise<Issue> {
    const existing = await this.prisma.issue.findFirst({
      where: { id: issueId, projectId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Issue not found' });
    }

    const updated = await this.prisma.issue.update({
      where: { id: issueId },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.sprintId !== undefined ? { sprintId: patch.sprintId } : {}),
        ...(patch.assigneeUserId !== undefined ? { assigneeUserId: patch.assigneeUserId } : {}),
        ...(patch.dueDate !== undefined
          ? { dueDate: patch.dueDate ? new Date(patch.dueDate) : null }
          : {}),
      },
      include: this.includeUsers(),
    });

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { identifierPrefix: true },
    });
    const dto = this.toDto(updated, project.identifierPrefix);

    // Status transitions ride a dedicated event so the board view (and
    // future automations / notifications) can subscribe without filtering.
    if (patch.status !== undefined && patch.status !== existing.status) {
      await this.events.publish(
        new IssueStatusChangedEvent({
          issueId,
          projectId,
          workspaceId,
          actorId,
          identifier: dto.identifier,
          fromStatus: existing.status,
          toStatus: patch.status,
        }),
      );
    }

    await this.events.publish(
      new IssueUpdatedEvent({
        issueId,
        projectId,
        workspaceId,
        actorId,
        identifier: dto.identifier,
        changes: patch,
      }),
    );

    return dto;
  }

  async deleteIssue(
    actorId: UserId,
    workspaceId: WorkspaceId,
    projectId: ProjectId,
    issueId: IssueId,
  ): Promise<void> {
    const existing = await this.prisma.issue.findFirst({
      where: { id: issueId, projectId, deletedAt: null },
      include: { project: { select: { identifierPrefix: true } } },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Issue not found' });
    }

    await this.prisma.issue.update({
      where: { id: issueId },
      data: { deletedAt: new Date() },
    });

    await this.events.publish(
      new IssueDeletedEvent({
        issueId,
        projectId,
        workspaceId,
        actorId,
        identifier: `${existing.project.identifierPrefix}-${existing.number}`,
      }),
    );
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  private includeUsers() {
    return {
      assignee: {
        select: { id: true, displayName: true, email: true, avatarUrl: true },
      },
      createdBy: {
        select: { id: true, displayName: true, email: true, avatarUrl: true },
      },
    } as const;
  }

  private toDto(
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
    identifierPrefix: string,
  ): Issue {
    return {
      id: row.id as IssueId,
      projectId: row.projectId as ProjectId,
      number: row.number,
      identifier: `${identifierPrefix}-${row.number}`,
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
