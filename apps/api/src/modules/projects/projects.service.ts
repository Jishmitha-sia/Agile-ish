import {
  type CreateProjectRequest,
  type Project,
  type ProjectId,
  type ProjectSlug,
  type UpdateProjectRequest,
  type UserId,
  type WorkspaceId,
} from '@agile-ish/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';

import { EventBus } from '../../infra/events/events.module.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

import {
  ProjectCreatedEvent,
  ProjectDeletedEvent,
  ProjectUpdatedEvent,
} from './events/project.events.js';
import {
  deriveIdentifierPrefix,
  deriveProjectSlug,
  findAvailableIdentifierPrefix,
  findAvailableProjectSlug,
} from './utils/slug.js';

/**
 * Projects live one level inside a Workspace. Slug + identifier prefix are
 * unique per-workspace (composite unique in the schema). All mutations
 * publish a domain event so the audit log + future read-model projections
 * stay in sync without coupling.
 *
 * Soft-delete from day one — `deletedAt` filters everywhere reads happen.
 * Mirrors the workspace pattern we just converted to in Batch A's bugfix.
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBus,
  ) {}

  async create(
    actorId: UserId,
    workspaceId: WorkspaceId,
    input: CreateProjectRequest,
  ): Promise<Project> {
    const baseSlug = input.slug ?? deriveProjectSlug(input.name);
    const basePrefix = input.identifierPrefix ?? deriveIdentifierPrefix(input.name);

    const project = await this.prisma.$transaction(async (tx) => {
      const slug = await findAvailableProjectSlug(tx, workspaceId, baseSlug);
      const identifierPrefix = await findAvailableIdentifierPrefix(tx, workspaceId, basePrefix);
      return await tx.project.create({
        data: {
          workspaceId,
          slug,
          identifierPrefix,
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
        },
      });
    });

    await this.events.publish(
      new ProjectCreatedEvent({
        projectId: project.id,
        workspaceId,
        actorId,
        slug: project.slug,
        name: project.name,
        identifierPrefix: project.identifierPrefix,
      }),
    );

    return this.toDto(project);
  }

  async listByWorkspace(workspaceId: WorkspaceId): Promise<Project[]> {
    const rows = await this.prisma.project.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: [{ archivedAt: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((p) => this.toDto(p));
  }

  async getBySlug(workspaceId: WorkspaceId, slug: ProjectSlug): Promise<Project> {
    const project = await this.prisma.project.findFirst({
      where: { workspaceId, slug, deletedAt: null },
    });
    if (!project) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Project not found' });
    }
    return this.toDto(project);
  }

  async update(
    actorId: UserId,
    workspaceId: WorkspaceId,
    projectId: ProjectId,
    patch: UpdateProjectRequest,
  ): Promise<Project> {
    const existing = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Project not found' });
    }
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
      },
    });
    await this.events.publish(
      new ProjectUpdatedEvent({
        projectId,
        workspaceId,
        actorId,
        changes: patch,
      }),
    );
    return this.toDto(updated);
  }

  async deleteProject(
    actorId: UserId,
    workspaceId: WorkspaceId,
    projectId: ProjectId,
  ): Promise<void> {
    const existing = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Project not found' });
    }
    await this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
    await this.events.publish(new ProjectDeletedEvent({ projectId, workspaceId, actorId }));
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  private toDto(p: {
    id: string;
    workspaceId: string;
    slug: string;
    name: string;
    description: string | null;
    identifierPrefix: string;
    issueCounter: number;
    visibility: 'PUBLIC' | 'PRIVATE';
    leadUserId: string | null;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Project {
    return {
      id: p.id as Project['id'],
      workspaceId: p.workspaceId as Project['workspaceId'],
      slug: p.slug,
      name: p.name,
      description: p.description,
      identifierPrefix: p.identifierPrefix,
      issueCounter: p.issueCounter,
      visibility: p.visibility,
      leadUserId: (p.leadUserId as Project['leadUserId']) ?? null,
      archivedAt: p.archivedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
