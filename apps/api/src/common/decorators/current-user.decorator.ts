import { createParamDecorator, UnauthorizedException, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequest, RequestUser } from '../types/auth.types.js';

/**
 * Parameter decorator that extracts the authenticated principal from the
 * request. Throws 401 if no user is present — meaning callers can safely
 * assume `RequestUser` (non-nullable) in handler signatures.
 *
 * For optional access (public endpoints that adapt to logged-in users),
 * use `@OptionalCurrentUser()`.
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestUser => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }
    return req.user;
  },
);

export const OptionalCurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestUser | undefined => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.user;
  },
);
