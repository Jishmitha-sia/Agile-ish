import { Module } from '@nestjs/common';

import { WorkspacesModule } from '../workspaces/workspaces.module.js';

import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

/**
 * Projects depend on WorkspaceRoleGuard for resolution + role gating,
 * so the WorkspacesModule must export it (it does). No other coupling
 * — the projects service talks directly to Prisma + EventBus.
 */
@Module({
  imports: [WorkspacesModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
