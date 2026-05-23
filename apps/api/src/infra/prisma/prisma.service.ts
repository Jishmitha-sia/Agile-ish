import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';

import { getAppConfig } from '../../config/config.module.js';

/**
 * Prisma client wrapper.
 *
 * Responsibilities right now:
 *   • Manage the connection lifecycle (connect on module init, disconnect on
 *     destroy).
 *   • Provide `withRequestContext(ctx, fn)` — wraps `fn` in a transaction and
 *     sets the `app.user_id` / `app.workspace_id` Postgres session variables
 *     used by RLS policies. Every authenticated request opens such a scope;
 *     system jobs (seed, migrations, scheduled cleanups) skip it and
 *     therefore see the RLS bypass branch in policies.
 *
 * Soft-delete (Phase 2): the `deletedAt` columns exist on User + Workspace
 * but are NOT auto-filtered by a client extension. When a Phase-2 feature
 * needs soft-delete semantics, add it at the service layer with explicit
 * `deletedAt: null` filters and an `Archive` action that updates instead of
 * deleting. A client extension was tried in Phase 1 but Prisma's generated
 * extension types are too strict for the generic-over-all-models pattern
 * to typecheck cleanly — service-layer enforcement is more transparent and
 * easier to audit anyway.
 */

export interface RequestContext {
  userId?: string;
  workspaceId?: string;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    const cfg = getAppConfig(config);
    super({
      datasources: { db: { url: cfg.database.url } },
      log: cfg.runtime.isProduction
        ? [{ level: 'error', emit: 'event' }, { level: 'warn', emit: 'event' }]
        : [
            { level: 'error', emit: 'event' },
            { level: 'warn', emit: 'event' },
            { level: 'query', emit: 'event' },
          ],
      errorFormat: 'minimal',
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Run `fn` inside a transaction with Postgres session variables set so
   * that RLS policies enforce the caller's tenant scope. All queries within
   * `fn` see only rows the caller is authorised for at the DB layer.
   *
   * Note: we use a transaction (not a connection pin) because pooled
   * connections cycle, but `SET LOCAL` is transaction-scoped — it's the
   * safe primitive across pgbouncer transaction-mode pooling.
   */
  async withRequestContext<T>(
    ctx: RequestContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      if (ctx.userId) {
        await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${escapeSqlIdent(ctx.userId)}'`);
      }
      if (ctx.workspaceId) {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.workspace_id = '${escapeSqlIdent(ctx.workspaceId)}'`,
        );
      }
      return fn(tx);
    });
  }
}

/**
 * Defence-in-depth: the only ids that ever flow into this helper come from
 * verified JWT claims or DB lookups (CUIDs). We still strip anything outside
 * the CUID character set as a belt-and-suspenders measure — `SET LOCAL`
 * does not accept parameter binding, so the literal must be safe.
 */
const escapeSqlIdent = (raw: string): string => raw.replace(/[^A-Za-z0-9_-]/g, '');
