import { Module } from '@nestjs/common';

import { WorkspaceRoleGuard } from './guards/workspace-role.guard.js';
import { WorkspaceMembersService } from './services/workspace-members.service.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceMembersService, WorkspaceRoleGuard],
  exports: [WorkspacesService, WorkspaceMembersService, WorkspaceRoleGuard],
})
export class WorkspacesModule {}
