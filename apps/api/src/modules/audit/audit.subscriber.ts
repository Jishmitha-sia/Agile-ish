import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';


import { EventBus, type SerialisedDomainEvent } from '../../infra/events/events.module.js';

import { AuditService } from './audit.service.js';

import type { AuditAction } from '@agile-ish/contracts';

/**
 * Bridges domain events to the audit log.
 *
 * Each entry in `AUDIT_MAP` declares: "when this event fires, write an
 * audit row with this action and metadata-extraction recipe". Keeping
 * the mapping centralised here means service code doesn't have to make
 * two parallel calls (`emit + audit`) — it just emits, and audit is
 * applied uniformly.
 *
 * Reuse-detection (`auth.refresh.reused`) is the most important event
 * to keep here: it's a security signal and we want it audited even if
 * the calling service forgot to do it explicitly.
 */
type AuditMapper = (e: SerialisedDomainEvent) => {
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

const AUDIT_MAP: Record<string, AuditMapper> = {
  'auth.user.signed-up': (e) => ({
    action: 'auth.signup',
    targetType: 'user',
    targetId: e.payload.userId as string,
    metadata: { email: e.payload.email },
  }),
  'auth.user.logged-in': (e) => ({
    action: 'auth.login',
    targetType: 'user',
    targetId: e.payload.userId as string,
    metadata: { sessionId: e.payload.sessionId },
  }),
  'auth.user.logged-out': (e) => ({
    action: 'auth.logout',
    targetType: 'user',
    targetId: e.payload.userId as string,
    metadata: { sessionId: e.payload.sessionId },
  }),
  'auth.login.failed': (e) => ({
    action: 'auth.login.failed',
    metadata: { email: e.payload.email, reason: e.payload.reason },
  }),
  'auth.refresh.reused': (e) => ({
    action: 'auth.refresh.reused',
    targetType: 'user',
    targetId: e.payload.userId as string,
    metadata: { familyId: e.payload.familyId },
  }),

  // ─── Phase 1.5 ───
  'auth.email-verification.requested': (e) => ({
    action: 'auth.email.verification_requested',
    targetType: 'user',
    targetId: e.payload.userId as string,
    metadata: { email: e.payload.email },
  }),
  'auth.email-verification.confirmed': (e) => ({
    action: 'auth.email.verified',
    targetType: 'user',
    targetId: e.payload.userId as string,
    metadata: { email: e.payload.email },
  }),
  'auth.password-reset.requested': (e) => ({
    action: 'auth.password.reset_requested',
    targetType: 'user',
    targetId: e.payload.userId as string,
    metadata: { email: e.payload.email },
  }),
  'auth.password-reset.completed': (e) => ({
    action: 'auth.password.reset_completed',
    targetType: 'user',
    targetId: e.payload.userId as string,
  }),

  // ─── OAuth ───
  'auth.oauth.signin': (e) => ({
    action: 'auth.oauth.signin',
    targetType: 'user',
    targetId: e.payload.userId as string,
    metadata: { provider: e.payload.provider },
  }),
  'auth.oauth.signup': (e) => ({
    action: 'auth.oauth.signup',
    targetType: 'user',
    targetId: e.payload.userId as string,
    metadata: { provider: e.payload.provider, email: e.payload.email },
  }),
  'auth.oauth.linked': (e) => ({
    action: 'auth.oauth.linked',
    targetType: 'user',
    targetId: e.payload.userId as string,
    metadata: { provider: e.payload.provider },
  }),

  'workspace.created': (e) => ({
    action: 'workspace.created',
    targetType: 'workspace',
    targetId: e.payload.workspaceId as string,
    metadata: { slug: e.payload.slug, name: e.payload.name },
  }),
  'workspace.updated': (e) => ({
    action: 'workspace.updated',
    targetType: 'workspace',
    targetId: e.payload.workspaceId as string,
    metadata: { changes: e.payload.changes },
  }),
  'workspace.deleted': (e) => ({
    action: 'workspace.deleted',
    targetType: 'workspace',
    targetId: e.payload.workspaceId as string,
  }),
  'workspace.member.invited': (e) => ({
    action: 'workspace.member.invited',
    targetType: 'workspace',
    targetId: e.payload.workspaceId as string,
    metadata: { invitedEmail: e.payload.email, role: e.payload.role },
  }),
  'workspace.member.joined': (e) => ({
    action: 'workspace.member.joined',
    targetType: 'workspace',
    targetId: e.payload.workspaceId as string,
    metadata: { userId: e.payload.userId, role: e.payload.role },
  }),
  'workspace.member.removed': (e) => ({
    action: 'workspace.member.removed',
    targetType: 'workspace',
    targetId: e.payload.workspaceId as string,
    metadata: { userId: e.payload.userId },
  }),
  'workspace.member.role_changed': (e) => ({
    action: 'workspace.member.role_changed',
    targetType: 'workspace',
    targetId: e.payload.workspaceId as string,
    metadata: {
      userId: e.payload.userId,
      fromRole: e.payload.fromRole,
      toRole: e.payload.toRole,
    },
  }),

  // ─── Workspace invitations ───
  'workspace.invitation.created': (e) => ({
    action: 'workspace.invitation.created',
    targetType: 'workspace',
    targetId: e.payload.workspaceId as string,
    metadata: {
      invitationId: e.payload.invitationId,
      invitedEmail: e.payload.email,
      role: e.payload.role,
      refreshed: e.payload.refreshed,
    },
  }),
  'workspace.invitation.accepted': (e) => ({
    action: 'workspace.invitation.accepted',
    targetType: 'workspace',
    targetId: e.payload.workspaceId as string,
    metadata: {
      invitationId: e.payload.invitationId,
      userId: e.payload.userId,
      email: e.payload.email,
      role: e.payload.role,
    },
  }),
  'workspace.invitation.revoked': (e) => ({
    action: 'workspace.invitation.revoked',
    targetType: 'workspace',
    targetId: e.payload.workspaceId as string,
    metadata: {
      invitationId: e.payload.invitationId,
      email: e.payload.email,
    },
  }),

  // ─── Projects ───
  'project.created': (e) => ({
    action: 'project.created',
    targetType: 'project',
    targetId: e.payload.projectId as string,
    metadata: {
      slug: e.payload.slug,
      name: e.payload.name,
      identifierPrefix: e.payload.identifierPrefix,
    },
  }),
  'project.updated': (e) => ({
    action: 'project.updated',
    targetType: 'project',
    targetId: e.payload.projectId as string,
    metadata: { changes: e.payload.changes },
  }),
  'project.deleted': (e) => ({
    action: 'project.deleted',
    targetType: 'project',
    targetId: e.payload.projectId as string,
  }),
};

@Injectable()
export class AuditSubscriber implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuditSubscriber.name);
  private unsubscribers: (() => void)[] = [];

  constructor(
    private readonly events: EventBus,
    private readonly audit: AuditService,
  ) {}

  onApplicationBootstrap(): void {
    for (const [eventName, mapper] of Object.entries(AUDIT_MAP)) {
      const off = this.events.subscribe(eventName, async (event) => {
        const serialised = event.toJSON();
        const entry = mapper(serialised);
        await this.audit.log({
          action: entry.action,
          ...(serialised.actorId ? { actorId: serialised.actorId } : {}),
          ...(serialised.workspaceId ? { workspaceId: serialised.workspaceId } : {}),
          ...(entry.targetType ? { targetType: entry.targetType } : {}),
          ...(entry.targetId ? { targetId: entry.targetId } : {}),
          metadata: entry.metadata ?? {},
        });
      });
      this.unsubscribers.push(off);
    }
    this.logger.log(`AuditSubscriber bound to ${Object.keys(AUDIT_MAP).length} event names`);
  }
}
