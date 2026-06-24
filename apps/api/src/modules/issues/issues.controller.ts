import { ProjectSlug as ProjectSlugSchema } from '@agile-ish/contracts';
import {
  BadRequestException,
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

import { CreateIssueDto, ListIssuesQueryDto, UpdateIssueDto } from './dto/issues.dto.js';
import { IssuesService } from './issues.service.js';

import type { RequestUser, RequestWorkspaceContext } from '../../common/types/auth.types.js';

/**
 * Issues are addressed under their parent project:
 *
 *   POST   /workspaces/:ws/projects/:p/issues                — create  (MEMBER+)
 *   GET    /workspaces/:ws/projects/:p/issues                — list    (member)
 *   GET    /workspaces/:ws/projects/:p/issues/:number        — get     (member)
 *   PATCH  /workspaces/:ws/projects/:p/issues/:number        — update  (MEMBER+)
 *   DELETE /workspaces/:ws/projects/:p/issues/:number        — soft-delete (ADMIN+)
 *
 * `:number` is the per-project monotonic issue number (the `42` in
 * `ENG-42`), NOT the cuid id. Addressable URLs match the identifier users
 * see in the UI.
 *
 * Workspace membership is enforced by `WorkspaceRoleGuard` on the
 * workspace slug; project ownership is enforced by `ProjectsService.getBySlug`
 * (returns 404 for cross-workspace project access). The issue service
 * then enforces `(projectId, issue)` ownership on every read/write.
 */
@ApiTags('issues')
@ApiBearerAuth()
@UseGuards(WorkspaceRoleGuard)
@Controller('workspaces/:workspaceSlug/projects/:projectSlug/issues')
export class IssuesController {
  constructor(
    private readonly issues: IssuesService,
    private readonly projects: ProjectsService,
  ) {}

  @RequireRole('MEMBER')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an issue (MEMBER+)' })
  async create(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('projectSlug') projectSlugRaw: string,
    @Body() body: CreateIssueDto,
  ) {
    const projectSlug = ProjectSlugSchema.parse(projectSlugRaw);
    const project = await this.projects.getBySlug(ws.id, projectSlug);
    return await this.issues.create(user.id, ws.id, project.id, body);
  }

  @Get()
  @SkipThrottle({ global: true, auth: true })
  @ApiOperation({ summary: 'List issues in this project (member)' })
  async list(
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('projectSlug') projectSlugRaw: string,
    @Query() query: ListIssuesQueryDto,
  ) {
    const projectSlug = ProjectSlugSchema.parse(projectSlugRaw);
    const project = await this.projects.getBySlug(ws.id, projectSlug);
    return await this.issues.listByProject(project.id, query);
  }

  @Get(':number')
  @SkipThrottle({ global: true, auth: true })
  @ApiOperation({ summary: 'Get an issue by its per-project number (member)' })
  async getOne(
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('projectSlug') projectSlugRaw: string,
    @Param('number') numberRaw: string,
  ) {
    const projectSlug = ProjectSlugSchema.parse(projectSlugRaw);
    const number = this.parseIssueNumber(numberRaw);
    const project = await this.projects.getBySlug(ws.id, projectSlug);
    return await this.issues.getByNumber(project.id, number);
  }

  @RequireRole('MEMBER')
  @Patch(':number')
  @ApiOperation({ summary: 'Update an issue (MEMBER+)' })
  async update(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('projectSlug') projectSlugRaw: string,
    @Param('number') numberRaw: string,
    @Body() body: UpdateIssueDto,
  ) {
    const projectSlug = ProjectSlugSchema.parse(projectSlugRaw);
    const number = this.parseIssueNumber(numberRaw);
    const project = await this.projects.getBySlug(ws.id, projectSlug);
    const issue = await this.issues.getByNumber(project.id, number);
    return await this.issues.update(user.id, ws.id, project.id, issue.id, body);
  }

  @RequireRole('ADMIN')
  @Delete(':number')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an issue (ADMIN+)' })
  async remove(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('projectSlug') projectSlugRaw: string,
    @Param('number') numberRaw: string,
  ): Promise<void> {
    const projectSlug = ProjectSlugSchema.parse(projectSlugRaw);
    const number = this.parseIssueNumber(numberRaw);
    const project = await this.projects.getBySlug(ws.id, projectSlug);
    const issue = await this.issues.getByNumber(project.id, number);
    await this.issues.deleteIssue(user.id, ws.id, project.id, issue.id);
  }

  private parseIssueNumber(raw: string): number {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Issue number must be a positive integer.',
      });
    }
    return n;
  }
}
