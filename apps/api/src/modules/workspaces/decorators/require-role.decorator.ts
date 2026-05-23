import { type WorkspaceRole } from '@agile-ish/contracts';
import { SetMetadata } from '@nestjs/common';

/**
 * Declare the minimum workspace role required for a handler.
 *
 *   @RequireRole('ADMIN')
 *   @Patch(':workspaceSlug/settings')
 *   updateSettings() { ... }
 *
 * Routes annotated with this decorator are gated by WorkspaceRoleGuard,
 * which resolves `:workspaceSlug` (or `:workspaceId`) to a membership row
 * for the current user and ensures the role meets or exceeds the minimum.
 */
export const REQUIRE_ROLE_KEY = 'requireRole';
export const RequireRole = (role: WorkspaceRole): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_ROLE_KEY, role);
