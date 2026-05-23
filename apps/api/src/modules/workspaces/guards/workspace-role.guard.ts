import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasWorkspaceRole, type WorkspaceId, type WorkspaceRole } from '@agile-ish/contracts';

import type { AuthenticatedRequest } from '../../../common/types/auth.types.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';

import { REQUIRE_ROLE_KEY } from '../decorators/require-role.decorator.js';

/**
 * Resolves the request's workspace (from `:workspaceSlug` or `:workspaceId`
 * route param), looks up the caller's membership, attaches a
 * `RequestWorkspaceContext` to the request, and enforces the role minimum
 * declared by `@RequireRole()`.
 *
 * One guard, one DB round-trip. We don't split resolution and authorization
 * into separate guards because both need the same membership row.
 */
@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<WorkspaceRole | undefined>(
      REQUIRE_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!req.user) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const { slug, id } = this.extractWorkspaceParam(req.params as Record<string, string | undefined>);
    if (!slug && !id) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Workspace identifier missing from route',
      });
    }

    // Build the workspace filter narrowly so Prisma doesn't see an `id: undefined`
    // (which `exactOptionalPropertyTypes` would reject).
    const workspaceFilter = slug
      ? { slug, deletedAt: null }
      : { id: id as string, deletedAt: null };

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        userId: req.user.id,
        workspace: workspaceFilter,
      },
      include: { workspace: { select: { id: true, slug: true } } },
    });

    if (!membership) {
      // 404 (not 403) so we don't leak whether a workspace exists for non-members.
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Workspace not found' });
    }

    req.workspace = {
      id: membership.workspace.id as WorkspaceId,
      slug: membership.workspace.slug,
      role: membership.role as WorkspaceRole,
    };

    if (required && !hasWorkspaceRole(membership.role as WorkspaceRole, required)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Requires role ${required} or higher`,
      });
    }

    return true;
  }

  private extractWorkspaceParam(params: Record<string, string | undefined>): {
    slug?: string;
    id?: string;
  } {
    const slug = params['workspaceSlug'];
    const id = params['workspaceId'];
    return {
      ...(slug ? { slug } : {}),
      ...(id ? { id } : {}),
    };
  }
}
