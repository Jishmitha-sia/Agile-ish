import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { getAppConfig } from '../../config/config.module.js';
import { Prisma, PrismaClient } from '../../generated/prisma/index.js';

/**
 * Extended Prisma client.
 *
 * Two extensions are layered on top of the vanilla client:
 *
 * 1. **Soft delete** — calls to `delete()` / `deleteMany()` on models that
 *    have a `deletedAt` column are rewritten to UPDATE statements setting
 *    `deletedAt = now()`. Reads on those models automatically filter
 *    `deletedAt = null` unless an explicit `withDeleted` flag is passed.
 *
 * 2. **Request context** — provides `prisma.withRequestContext(ctx, fn)`
 *    that wraps `fn` in a transaction and sets the `app.user_id` and
 *    `app.workspace_id` Postgres session variables used by RLS policies.
 *    Every authenticated request opens such a scope; system jobs that need
 *    to bypass tenant scoping must explicitly use the raw client.
 */

const SOFT_DELETE_MODELS = new Set<string>(['User', 'Workspace']);

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

    this.$extends(softDeleteExtension);
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

/**
 * Prisma client extension implementing soft-delete semantics.
 * Applies to models in SOFT_DELETE_MODELS only — append-only tables
 * (audit_logs) and join tables (workspace_members) keep hard-delete.
 */
const softDeleteExtension = Prisma.defineExtension({
  name: 'soft-delete',
  query: {
    $allModels: {
      async delete({ model, args, query }) {
        if (model && SOFT_DELETE_MODELS.has(model)) {
          return (await (
            this as unknown as { update: (a: unknown) => Promise<unknown> }
          ).update({ ...args, data: { deletedAt: new Date() } })) as never;
        }
        return query(args);
      },
      async deleteMany({ model, args, query }) {
        if (model && SOFT_DELETE_MODELS.has(model)) {
          return (await (
            this as unknown as { updateMany: (a: unknown) => Promise<unknown> }
          ).updateMany({ ...args, data: { deletedAt: new Date() } })) as never;
        }
        return query(args);
      },
      async findFirst({ model, args, query }) {
        if (model && SOFT_DELETE_MODELS.has(model) && !hasIncludeDeletedFlag(args)) {
          return query({ ...args, where: mergeDeletedAtFilter(args.where) }) as never;
        }
        return query(args);
      },
      async findFirstOrThrow({ model, args, query }) {
        if (model && SOFT_DELETE_MODELS.has(model) && !hasIncludeDeletedFlag(args)) {
          return query({ ...args, where: mergeDeletedAtFilter(args.where) }) as never;
        }
        return query(args);
      },
      async findMany({ model, args, query }) {
        if (model && SOFT_DELETE_MODELS.has(model) && !hasIncludeDeletedFlag(args)) {
          return query({ ...args, where: mergeDeletedAtFilter(args.where) }) as never;
        }
        return query(args);
      },
      async findUnique({ model, args, query }) {
        if (model && SOFT_DELETE_MODELS.has(model) && !hasIncludeDeletedFlag(args)) {
          // findUnique by unique key cannot be combined with extra where —
          // upgrade to findFirst with the soft-delete filter applied.
          return (
            this as unknown as { findFirst: (a: unknown) => Promise<unknown> }
          ).findFirst({ ...args, where: { ...args.where, deletedAt: null } }) as never;
        }
        return query(args);
      },
    },
  },
});

const INCLUDE_DELETED_FLAG = '__includeDeleted';
const hasIncludeDeletedFlag = (args: { where?: Record<string, unknown> } | undefined): boolean =>
  Boolean(args?.where?.[INCLUDE_DELETED_FLAG]);

const mergeDeletedAtFilter = (
  where: Record<string, unknown> | undefined,
): Record<string, unknown> => ({ ...(where ?? {}), deletedAt: null });
