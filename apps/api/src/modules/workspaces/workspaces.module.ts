import { Module } from '@nestjs/common';

import { WorkspaceRoleGuard } from './guards/workspace-role.guard.js';
import { WorkspaceInvitationsService } from './services/workspace-invitations.service.js';
import { WorkspaceMembersService } from './services/workspace-members.service.js';
import { WorkspaceInvitationsController } from './workspace-invitations.controller.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';

// MailerModule is @Global, so no explicit import needed for the
// invitations service's mailer dependency.

@Module({
  controllers: [WorkspacesController, WorkspaceInvitationsController],
  providers: [
    WorkspacesService,
    WorkspaceMembersService,
    WorkspaceInvitationsService,
    WorkspaceRoleGuard,
  ],
  exports: [
    WorkspacesService,
    WorkspaceMembersService,
    WorkspaceInvitationsService,
    WorkspaceRoleGuard,
  ],
})
export class WorkspacesModule {}
