import { createParamDecorator, type ExecutionContext, NotFoundException } from '@nestjs/common';

import type { AuthenticatedRequest, RequestWorkspaceContext } from '../../../common/types/auth.types.js';

/**
 * Parameter decorator that returns the workspace context resolved by
 * WorkspaceRoleGuard. Throws 404 if used on a route where the guard
 * hasn't run — a programming error, not a runtime user condition.
 */
export const CurrentWorkspace = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestWorkspaceContext => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.workspace) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Workspace context not resolved — is the route gated by WorkspaceRoleGuard?',
      });
    }
    return req.workspace;
  },
);
