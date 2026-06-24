import { ProjectSlug as ProjectSlugSchema } from '@agile-ish/contracts';
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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ProjectsService } from '../projects/projects.service.js';
import { CurrentWorkspace } from '../workspaces/decorators/current-workspace.decorator.js';
import { RequireRole } from '../workspaces/decorators/require-role.decorator.js';
import { WorkspaceRoleGuard } from '../workspaces/guards/workspace-role.guard.js';

import { CreateSprintDto, ListSprintsQueryDto, UpdateSprintDto } from './dto/sprints.dto.js';
import { SprintsService } from './sprints.service.js';

import type { RequestUser, RequestWorkspaceContext } from '../../common/types/auth.types.js';

/**
 * Sprints are addressed under their parent project:
 *
 *   POST   /workspaces/:ws/projects/:p/sprints              — create  (MEMBER+)
 *   GET    /workspaces/:ws/projects/:p/sprints              — list    (member)
 *   GET    /workspaces/:ws/projects/:p/sprints/active       — get active sprint with issues (member)
 *   GET    /workspaces/:ws/projects/:p/sprints/:id          — get sprint with issues (member)
 *   PATCH  /workspaces/:ws/projects/:p/sprints/:id          — update (MEMBER+)
 *   DELETE /workspaces/:ws/projects/:p/sprints/:id          — delete (ADMIN+)
 */
@ApiTags('sprints')
@ApiBearerAuth()
@UseGuards(WorkspaceRoleGuard)
@Controller('workspaces/:workspaceSlug/projects/:projectSlug/sprints')
export class SprintsController {
  constructor(
    private readonly sprints: SprintsService,
    private readonly projects: ProjectsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRole('MEMBER')
  @ApiOperation({ summary: 'Create a sprint (MEMBER+)' })
  async create(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('projectSlug') projectSlugRaw: string,
    @Body() body: CreateSprintDto,
  ) {
    const projectSlug = ProjectSlugSchema.parse(projectSlugRaw);
    const project = await this.projects.getBySlug(ws.id, projectSlug);
    return await this.sprints.create(user.id, ws.id, project.id, body);
  }

  @Get()
  @SkipThrottle({ global: true, auth: true })
  @ApiOperation({ summary: 'List sprints for this project (member)' })
  async list(
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('projectSlug') projectSlugRaw: string,
    @Query() query: ListSprintsQueryDto,
  ) {
    const projectSlug = ProjectSlugSchema.parse(projectSlugRaw);
    const project = await this.projects.getBySlug(ws.id, projectSlug);
    return await this.sprints.listByProject(project.id, query.includeCompleted ?? false);
  }

  @Get('active')
  @SkipThrottle({ global: true, auth: true })
  @ApiOperation({ summary: 'Get the active sprint with issues (member)' })
  async getActive(
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('projectSlug') projectSlugRaw: string,
  ) {
    const projectSlug = ProjectSlugSchema.parse(projectSlugRaw);
    const project = await this.projects.getBySlug(ws.id, projectSlug);
    return await this.sprints.getActiveSprint(project.id);
  }

  @Get(':sprintId')
  @SkipThrottle({ global: true, auth: true })
  @ApiOperation({ summary: 'Get a sprint with its issues (member)' })
  async getOne(
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('projectSlug') projectSlugRaw: string,
    @Param('sprintId') sprintId: string,
  ) {
    const projectSlug = ProjectSlugSchema.parse(projectSlugRaw);
    const project = await this.projects.getBySlug(ws.id, projectSlug);
    return await this.sprints.getWithIssues(project.id, sprintId);
  }

  @Patch(':sprintId')
  @RequireRole('MEMBER')
  @ApiOperation({ summary: 'Update a sprint (MEMBER+)' })
  async update(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('projectSlug') projectSlugRaw: string,
    @Param('sprintId') sprintId: string,
    @Body() body: UpdateSprintDto,
  ) {
    const projectSlug = ProjectSlugSchema.parse(projectSlugRaw);
    const project = await this.projects.getBySlug(ws.id, projectSlug);
    return await this.sprints.update(user.id, ws.id, project.id, sprintId, body);
  }

  @Delete(':sprintId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole('ADMIN')
  @ApiOperation({ summary: 'Delete a sprint (ADMIN+)' })
  async remove(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('projectSlug') projectSlugRaw: string,
    @Param('sprintId') sprintId: string,
  ): Promise<void> {
    const projectSlug = ProjectSlugSchema.parse(projectSlugRaw);
    const project = await this.projects.getBySlug(ws.id, projectSlug);
    await this.sprints.deleteSprint(user.id, ws.id, project.id, sprintId);
  }
}
