import { createHash, randomBytes } from 'node:crypto';

import {
  type InvitationLookupResponse,
  type UserId,
  type WorkspaceId,
  type WorkspaceInvitation,
  type WorkspaceRole,
} from '@agile-ish/contracts';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { getAppConfig } from '../../../config/config.module.js';
import { EventBus } from '../../../infra/events/events.module.js';
import { MailerService } from '../../../infra/mailer/mailer.service.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import {
  WorkspaceInvitationAcceptedEvent,
  WorkspaceInvitationCreatedEvent,
  WorkspaceInvitationRevokedEvent,
  WorkspaceMemberJoinedEvent,
} from '../events/workspace.events.js';
import { renderWorkspaceInvitationMessage } from '../templates/workspace-invitation.template.js';

const TTL_DAYS = 14;
const TTL_MS = TTL_DAYS * 24 * 3600 * 1000;

interface InvitationRow {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedById: string | null;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: {
    id: string;
    displayName: string;
    email: string;
  } | null;
}

/**
 * Email-based workspace invitations.
 *
 * Single-use + time-limited (14 days). The raw token only exists in the
 * emailed link; the DB stores SHA-256(token). Re-inviting the same email
 * to the same workspace updates the existing pending row in place — bumps
 * expiry, mints a new token, sends a new email. The partial-unique index
 * on `(workspaceId, email) WHERE pending` enforces that invariant at the
 * DB layer as a defense in depth.
 *
 * Acceptance is idempotent: an already-accepted invitation returns the
 * same workspace pointer. An already-revoked or expired token returns a
 * clear failure outcome (caller maps to 4xx for the API).
 */
@Injectable()
export class WorkspaceInvitationsService {
  private readonly logger = new Logger(WorkspaceInvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly events: EventBus,
    private readonly config: ConfigService,
  ) {}

  /**
   * Issue a fresh token for (workspaceId, email) or refresh an existing
   * pending row. The caller (WorkspaceMembersService) handles the
   * "existing user" branch separately and never reaches here.
   */
  async issueOrRefresh(
    actorId: UserId,
    workspaceId: WorkspaceId,
    email: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceInvitation> {
    const raw = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + TTL_MS);

    const existing = await this.prisma.workspaceInvitation.findFirst({
      where: { workspaceId, email, usedAt: null, revokedAt: null },
      select: { id: true },
    });

    const row = existing
      ? await this.prisma.workspaceInvitation.update({
          where: { id: existing.id },
          data: { role, invitedById: actorId, tokenHash, expiresAt },
          include: this.includeInviter(),
        })
      : await this.prisma.workspaceInvitation.create({
          data: { workspaceId, email, role, invitedById: actorId, tokenHash, expiresAt },
          include: this.includeInviter(),
        });

    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { name: true },
    });
    await this.sendInvitationEmail({
      workspaceName: workspace.name,
      inviterDisplayName: row.invitedBy?.displayName ?? null,
      role,
      email,
      rawToken: raw,
    });

    await this.events.publish(
      new WorkspaceInvitationCreatedEvent({
        invitationId: row.id,
        workspaceId,
        actorId,
        email,
        role,
        refreshed: Boolean(existing),
      }),
    );

    return this.toDto(row);
  }

  async listPending(workspaceId: WorkspaceId): Promise<WorkspaceInvitation[]> {
    const rows = await this.prisma.workspaceInvitation.findMany({
      where: { workspaceId, usedAt: null, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      include: this.includeInviter(),
    });
    return rows.map((r) => this.toDto(r));
  }

  async revoke(actorId: UserId, workspaceId: WorkspaceId, invitationId: string): Promise<void> {
    const inv = await this.prisma.workspaceInvitation.findFirst({
      where: { id: invitationId, workspaceId, usedAt: null, revokedAt: null },
    });
    if (!inv) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invitation not found' });
    }
    await this.prisma.workspaceInvitation.update({
      where: { id: inv.id },
      data: { revokedAt: new Date(), revokedById: actorId },
    });
    await this.events.publish(
      new WorkspaceInvitationRevokedEvent({
        invitationId: inv.id,
        workspaceId,
        actorId,
        email: inv.email,
      }),
    );
  }

  /**
   * Public lookup — what the accept-invite page renders before the
   * recipient has authenticated. Returns enough to confirm the invite is
   * real (workspace name, role, inviter). Never returns the token; the
   * caller passes the raw token in via query string and we hash + match.
   */
  async lookup(raw: string): Promise<InvitationLookupResponse> {
    const inv = await this.findActiveByToken(raw);
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: inv.workspaceId },
      select: { slug: true, name: true },
    });
    return {
      workspace: { slug: workspace.slug, name: workspace.name },
      email: inv.email,
      role: inv.role as Exclude<WorkspaceRole, 'OWNER'>,
      inviterDisplayName: inv.invitedBy?.displayName ?? null,
      expiresAt: inv.expiresAt.toISOString(),
    };
  }

  /**
   * Accept an invitation as the authenticated user. The user's email
   * MUST match the invitation's email (case-insensitively) — otherwise
   * forbidden. Adds the WorkspaceMember row, marks the invitation used,
   * and emits both an "invitation accepted" event and a "member joined"
   * event so audit + downstream subscribers stay consistent with the
   * direct-add path.
   */
  async accept(
    userId: UserId,
    raw: string,
  ): Promise<{ workspaceSlug: string; workspaceName: string }> {
    const inv = await this.findActiveByToken(raw);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    if (user.email.toLowerCase() !== inv.email.toLowerCase()) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'This invitation was sent to a different email address.',
      });
    }

    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: inv.workspaceId },
      select: { slug: true, name: true, deletedAt: true },
    });
    if (workspace.deletedAt) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'This workspace has been deleted.',
      });
    }

    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: inv.workspaceId } },
    });

    await this.prisma.$transaction(async (tx) => {
      // Atomic mark-used — if a parallel request beat us, fail loudly so
      // we don't end up with two members from a single token.
      const used = await tx.workspaceInvitation.updateMany({
        where: { id: inv.id, usedAt: null },
        data: { usedAt: new Date(), usedByUserId: userId },
      });
      if (used.count === 0) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Invitation has already been used.',
        });
      }
      if (!existingMember) {
        await tx.workspaceMember.create({
          data: {
            userId,
            workspaceId: inv.workspaceId,
            role: inv.role,
            invitedById: inv.invitedById,
          },
        });
      }
    });

    await this.events.publish(
      new WorkspaceInvitationAcceptedEvent({
        invitationId: inv.id,
        workspaceId: inv.workspaceId,
        userId,
        email: inv.email,
        role: inv.role,
      }),
    );
    if (!existingMember) {
      await this.events.publish(
        new WorkspaceMemberJoinedEvent({
          workspaceId: inv.workspaceId,
          userId,
          role: inv.role,
        }),
      );
    }

    return { workspaceSlug: workspace.slug, workspaceName: workspace.name };
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  private async findActiveByToken(raw: string): Promise<InvitationRow> {
    const tokenHash = this.hashToken(raw);
    const inv = await this.prisma.workspaceInvitation.findUnique({
      where: { tokenHash },
      include: this.includeInviter(),
    });
    if (!inv || inv.revokedAt) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Invitation not found.' });
    }
    if (inv.usedAt) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Invitation has already been used.',
      });
    }
    if (inv.expiresAt.getTime() < Date.now()) {
      throw new ConflictException({ code: 'CONFLICT', message: 'Invitation has expired.' });
    }
    return inv;
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private includeInviter() {
    return {
      invitedBy: { select: { id: true, displayName: true, email: true } },
    } as const;
  }

  private toDto(row: InvitationRow): WorkspaceInvitation {
    return {
      id: row.id,
      workspaceId: row.workspaceId as WorkspaceId,
      email: row.email,
      role: row.role as Exclude<WorkspaceRole, 'OWNER'>,
      invitedBy: row.invitedBy
        ? {
            id: row.invitedBy.id as UserId,
            displayName: row.invitedBy.displayName,
            email: row.invitedBy.email,
          }
        : null,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async sendInvitationEmail(input: {
    workspaceName: string;
    inviterDisplayName: string | null;
    role: WorkspaceRole;
    email: string;
    rawToken: string;
  }): Promise<void> {
    const acceptUrl = `${getAppConfig(this.config).urls.app}/invite/${encodeURIComponent(input.rawToken)}`;
    const message = renderWorkspaceInvitationMessage({
      workspaceName: input.workspaceName,
      inviterDisplayName: input.inviterDisplayName,
      role: input.role,
      acceptUrl,
      expiresInDays: TTL_DAYS,
    });
    try {
      await this.mailer.send({ to: input.email, ...message });
    } catch (err) {
      this.logger.error({ err, email: input.email }, 'Failed to send invitation email');
      // Don't fail the API call — the invitation row exists, the admin
      // can resend if delivery flaked.
    }
  }
}
