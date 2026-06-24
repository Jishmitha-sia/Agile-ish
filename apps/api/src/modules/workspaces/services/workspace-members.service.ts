import {
  hasWorkspaceRole,
  type InviteMemberRequest,
  type InviteMemberResponse,
  type UserId,
  type WorkspaceId,
  type WorkspaceMember,
  type WorkspaceRole,
} from '@agile-ish/contracts';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { EventBus } from '../../../infra/events/events.module.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import {
  WorkspaceMemberJoinedEvent,
  WorkspaceMemberRemovedEvent,
  WorkspaceMemberRoleChangedEvent,
} from '../events/workspace.events.js';

import { WorkspaceInvitationsService } from './workspace-invitations.service.js';

/**
 * Membership lifecycle.
 *
 * Phase 1 invite flow is "direct add" — if the invitee already has an
 * account, they're added as a member immediately. Email-based invite
 * tokens (for users who don't yet exist) are a Phase 1.5 enhancement.
 *
 * Role-change rules (enforced here, not only at the route):
 *   • Nobody can change the OWNER role through this API (ownership
 *     transfer is a dedicated future endpoint with safety checks).
 *   • Admins can promote/demote MEMBER ↔ GUEST and add/remove members.
 *   • The last OWNER cannot be removed.
 */
@Injectable()
export class WorkspaceMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBus,
    private readonly invitations: WorkspaceInvitationsService,
  ) {}

  async list(workspaceId: WorkspaceId): Promise<WorkspaceMember[]> {
    const rows = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((m) => ({
      userId: m.userId as UserId,
      workspaceId: m.workspaceId as WorkspaceId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      user: {
        id: m.user.id as UserId,
        displayName: m.user.displayName,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
      },
    }));
  }

  /**
   * Invite by email. Two-branch result:
   *   • existing user → membership created immediately, returned with the
   *     `member` discriminator so the UI can render the new row inline.
   *   • no user yet  → invitation token minted + email sent, returned with
   *     the `invitation` discriminator so the UI can list the pending row.
   *
   * Re-inviting an email that already has a pending invitation refreshes
   * the existing row (new token + expiry, resends email). Re-inviting an
   * existing member is a 409.
   */
  async invite(
    actorId: UserId,
    workspaceId: WorkspaceId,
    input: InviteMemberRequest,
  ): Promise<InviteMemberResponse> {
    if ((input.role as WorkspaceRole) === 'OWNER') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot invite a user as OWNER',
      });
    }

    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      const invitation = await this.invitations.issueOrRefresh(
        actorId,
        workspaceId,
        input.email,
        input.role,
      );
      return { kind: 'invitation', invitation };
    }

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId } },
    });
    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'User is already a member of this workspace',
      });
    }

    const created = await this.prisma.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId,
        role: input.role,
        invitedById: actorId,
      },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    await this.events.publish(
      new WorkspaceMemberJoinedEvent({
        workspaceId,
        userId: user.id,
        role: input.role,
      }),
    );

    return {
      kind: 'member',
      member: {
        userId: created.userId as UserId,
        workspaceId: created.workspaceId as WorkspaceId,
        role: created.role,
        joinedAt: created.joinedAt.toISOString(),
        user: {
          id: created.user.id as UserId,
          displayName: created.user.displayName,
          email: created.user.email,
          avatarUrl: created.user.avatarUrl,
        },
      },
    };
  }

  async changeRole(
    actorId: UserId,
    actorRole: WorkspaceRole,
    workspaceId: WorkspaceId,
    targetUserId: UserId,
    nextRole: WorkspaceRole,
  ): Promise<void> {
    if (nextRole === 'OWNER') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Use ownership transfer to assign OWNER role',
      });
    }

    const target = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });
    if (!target) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Member not found' });
    }
    if (target.role === 'OWNER') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot change the OWNER role here',
      });
    }
    // An actor cannot demote themselves while they are still an ADMIN —
    // would lock them out. They can be demoted by a peer or removed.
    if (target.userId === actorId && !hasWorkspaceRole(actorRole, 'ADMIN')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot change your own role',
      });
    }

    await this.prisma.workspaceMember.update({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      data: { role: nextRole },
    });

    await this.events.publish(
      new WorkspaceMemberRoleChangedEvent({
        workspaceId,
        actorId,
        userId: targetUserId,
        fromRole: target.role,
        toRole: nextRole,
      }),
    );
  }

  async remove(actorId: UserId, workspaceId: WorkspaceId, targetUserId: UserId): Promise<void> {
    const target = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });
    if (!target) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Member not found' });
    }
    if (target.role === 'OWNER') {
      const ownerCount = await this.prisma.workspaceMember.count({
        where: { workspaceId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Cannot remove the last OWNER',
        });
      }
    }
    await this.prisma.workspaceMember.delete({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });
    await this.events.publish(
      new WorkspaceMemberRemovedEvent({ workspaceId, actorId, userId: targetUserId }),
    );
  }
}
