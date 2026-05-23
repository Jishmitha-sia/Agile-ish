import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infra/prisma/prisma.service.js';

import type { AuditAction } from '@agile-ish/contracts';


/**
 * Append-only audit log writer.
 *
 * Two calling conventions:
 *   • Direct: `auditService.log({ action, actorId, ... })` — used by
 *     synchronous code paths where the audit happens inside the same
 *     transaction as the audited operation.
 *   • Via event subscription: AuditSubscriber listens to a curated set of
 *     domain events and translates them to audit entries — used for
 *     side-effecty audits like "login failed" that don't have a clear
 *     synchronous host.
 *
 * Audit writes are non-blocking — a failure here logs a warning but
 * doesn't fail the caller's request. The trade-off: we may miss an audit
 * row during a DB outage. That's the right call: refusing a user's login
 * because the audit log is briefly slow is worse than a gap in the trail.
 */
export interface AuditInput {
  action: AuditAction;
  actorId?: string;
  workspaceId?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: input.action,
          ...(input.actorId ? { actorId: input.actorId } : {}),
          ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
          ...(input.targetType ? { targetType: input.targetType } : {}),
          ...(input.targetId ? { targetId: input.targetId } : {}),
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
          ...(input.userAgent ? { userAgent: input.userAgent } : {}),
          ...(input.requestId ? { requestId: input.requestId } : {}),
        },
      });
    } catch (err) {
      this.logger.warn({ err, input }, 'Audit write failed — continuing');
    }
  }
}
