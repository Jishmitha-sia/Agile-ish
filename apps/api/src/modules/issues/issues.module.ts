import { Module } from '@nestjs/common';

import { ProjectsModule } from '../projects/projects.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';

import { IssuesController } from './issues.controller.js';
import { IssuesService } from './issues.service.js';

/**
 * Issues depend on:
 *   • WorkspacesModule — for `WorkspaceRoleGuard` (workspace context + RBAC).
 *   • ProjectsModule  — for `ProjectsService.getBySlug` (project ownership
 *     check + identifier-prefix lookup).
 * Talks directly to Prisma + EventBus for everything else.
 */
@Module({
  imports: [WorkspacesModule, ProjectsModule],
  controllers: [IssuesController],
  providers: [IssuesService],
  exports: [IssuesService],
})
export class IssuesModule {}
