import type { UserId, WorkspaceId, WorkspaceRole } from '@agile-ish/contracts';
import type { Request } from 'express';

/**
 * The authenticated principal attached to `req.user` by the JWT strategy.
 * Minimal by design — memberships are looked up server-side per request
 * rather than embedded in the JWT, so token contents stay small and role
 * revocation is immediate.
 */
export interface RequestUser {
  id: UserId;
  email: string;
  sessionId: string;
}

/**
 * The workspace context derived for a request — resolved by
 * WorkspaceContextInterceptor from the route's :slug or :workspaceId param,
 * then verified against the caller's memberships.
 */
export interface RequestWorkspaceContext {
  id: WorkspaceId;
  slug: string;
  role: WorkspaceRole;
}

/** Augmented Express request the rest of the API depends on. */
export interface AuthenticatedRequest extends Request {
  user?: RequestUser;
  workspace?: RequestWorkspaceContext;
  requestId?: string;
}
