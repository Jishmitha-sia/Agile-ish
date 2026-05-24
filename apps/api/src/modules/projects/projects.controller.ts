import {
  ProjectSlug as ProjectSlugSchema,
} from '@agile-ish/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CurrentWorkspace } from '../workspaces/decorators/current-workspace.decorator.js';
import { RequireRole } from '../workspaces/decorators/require-role.decorator.js';
import { WorkspaceRoleGuard } from '../workspaces/guards/workspace-role.guard.js';

import { CreateProjectDto, UpdateProjectDto } from './dto/projects.dto.js';
import { ProjectsService } from './projects.service.js';

import type {
  RequestUser,
  RequestWorkspaceContext,
} from '../../common/types/auth.types.js';

/**
 * Projects are addressed under the workspace they belong to:
 *
 *   POST   /workspaces/:wsSlug/projects                       — create   (ADMIN+)
 *   GET    /workspaces/:wsSlug/projects                       — list     (member)
 *   GET    /workspaces/:wsSlug/projects/:projectSlug          — get      (member)
 *   PATCH  /workspaces/:wsSlug/projects/:projectSlug          — update   (ADMIN+)
 *   DELETE /workspaces/:wsSlug/projects/:projectSlug          — soft-del (ADMIN+)
 *
 * The WorkspaceRoleGuard resolves the workspace from the URL, attaches it
 * to the request as `CurrentWorkspace`, and enforces the role minimum.
 * Per-project lookups happen inside the handler (no separate project
 * guard yet — Phase 3 introduces one once issues need it).
 */
@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(WorkspaceRoleGuard)
@Controller('workspaces/:workspaceSlug/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @RequireRole('ADMIN')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a project in this workspace (ADMIN+)' })
  async create(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Body() body: CreateProjectDto,
  ) {
    return await this.projects.create(user.id, ws.id, body);
  }

  @Get()
  @ApiOperation({ summary: 'List projects in this workspace' })
  async list(@CurrentWorkspace() ws: RequestWorkspaceContext) {
    return await this.projects.listByWorkspace(ws.id);
  }

  @Get(':projectSlug')
  @ApiOperation({ summary: 'Get a project by slug' })
  async getOne(
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('projectSlug') projectSlugRaw: string,
  ) {
    const projectSlug = ProjectSlugSchema.parse(projectSlugRaw);
    return await this.projects.getBySlug(ws.id, projectSlug);
  }

  @RequireRole('ADMIN')
  @Patch(':projectSlug')
  @ApiOperation({ summary: 'Update a project (ADMIN+)' })
  async update(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('projectSlug') projectSlugRaw: string,
    @Body() body: UpdateProjectDto,
  ) {
    const projectSlug = ProjectSlugSchema.parse(projectSlugRaw);
    const project = await this.projects.getBySlug(ws.id, projectSlug);
    return await this.projects.update(user.id, ws.id, project.id, body);
  }

  @RequireRole('ADMIN')
  @Delete(':projectSlug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a project (ADMIN+)' })
  async remove(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('projectSlug') projectSlugRaw: string,
  ): Promise<void> {
    const projectSlug = ProjectSlugSchema.parse(projectSlugRaw);
    const project = await this.projects.getBySlug(ws.id, projectSlug);
    await this.projects.deleteProject(user.id, ws.id, project.id);
  }
}
