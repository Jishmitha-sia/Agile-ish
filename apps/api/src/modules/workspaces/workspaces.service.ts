import {
  type CreateWorkspaceRequest,
  type UpdateWorkspaceRequest,
  type UserId,
  type Workspace,
  type WorkspaceId,
  type WorkspaceSlug,
} from '@agile-ish/contracts';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { EventBus } from '../../infra/events/events.module.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

import {
  WorkspaceCreatedEvent,
  WorkspaceDeletedEvent,
  WorkspaceUpdatedEvent,
} from './events/workspace.events.js';
import { deriveSlug, findAvailableSlug } from './utils/slug.js';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBus,
  ) {}

  async create(actorId: UserId, input: CreateWorkspaceRequest): Promise<Workspace> {
    const baseSlug = input.slug ?? deriveSlug(input.name);

    const workspace = await this.prisma.$transaction(async (tx) => {
      const slug = await findAvailableSlug(tx, baseSlug);
      const created = await tx.workspace.create({
        data: {
          slug,
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
          ownerId: actorId,
        },
      });
      await tx.workspaceMember.create({
        data: { userId: actorId, workspaceId: created.id, role: 'OWNER' },
      });
      return created;
    });

    await this.events.publish(
      new WorkspaceCreatedEvent({
        workspaceId: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
        ownerId: actorId,
      }),
    );

    return this.toDto(workspace);
  }

  async getBySlug(slug: WorkspaceSlug): Promise<Workspace> {
    const ws = await this.prisma.workspace.findFirst({ where: { slug, deletedAt: null } });
    if (!ws) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Workspace not found' });
    }
    return this.toDto(ws);
  }

  async update(
    actorId: UserId,
    workspaceId: WorkspaceId,
    patch: UpdateWorkspaceRequest,
  ): Promise<Workspace> {
    // Refuse to mutate a soft-deleted workspace — return 404 to match the
    // outward-facing "this workspace doesn't exist" view that reads enforce.
    const existing = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Workspace not found' });
    }
    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
      },
    });
    await this.events.publish(
      new WorkspaceUpdatedEvent({
        workspaceId,
        actorId,
        changes: patch,
      }),
    );
    return this.toDto(updated);
  }

  /**
   * Soft-delete a workspace.
   *
   * Hard-coded guard: only the OWNER can delete. The WorkspaceRoleGuard
   * already checks role≥ADMIN; we add this extra OWNER check here because
   * deletion has user-visible consequences (members lose access, the slug
   * stays reserved) and we want a service-layer assertion regardless of
   * how guards are configured.
   *
   * Stamps `deletedAt = now()` — the row stays in the DB so:
   *   • the workspace_members rows are not cascade-deleted (FK was CASCADE
   *     on hard delete; soft delete just leaves them alone),
   *   • the audit_logs FK stays satisfied (otherwise the `workspace.deleted`
   *     audit row's INSERT would race the workspace's hard removal),
   *   • a future "restore within 30 days" flow has a row to flip back.
   * Reads everywhere else filter by `deletedAt IS NULL` so a soft-deleted
   * workspace stops appearing in `/auth/me`, `/users/me/memberships`,
   * `/workspaces/:slug`, and `WorkspaceRoleGuard`'s membership lookup.
   */
  async deleteWorkspace(actorId: UserId, workspaceId: WorkspaceId): Promise<void> {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Workspace not found' });
    }
    if (ws.ownerId !== actorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only the workspace owner can delete it',
      });
    }
    if (ws.deletedAt) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Workspace is already deleted',
      });
    }
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: new Date() },
    });
    await this.events.publish(new WorkspaceDeletedEvent({ workspaceId, actorId }));
  }

  private toDto(ws: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    avatarUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Workspace {
    return {
      id: ws.id as WorkspaceId,
      slug: ws.slug,
      name: ws.name,
      description: ws.description,
      avatarUrl: ws.avatarUrl,
      createdAt: ws.createdAt.toISOString(),
      updatedAt: ws.updatedAt.toISOString(),
    };
  }
}
