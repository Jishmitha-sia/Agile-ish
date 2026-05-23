import { type UserId } from '@agile-ish/contracts';
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


import { CurrentWorkspace } from './decorators/current-workspace.decorator.js';
import { RequireRole } from './decorators/require-role.decorator.js';
import {
  ChangeMemberRoleDto,
  CreateWorkspaceDto,
  InviteMemberDto,
  UpdateWorkspaceDto,
} from './dto/workspaces.dto.js';
import { WorkspaceRoleGuard } from './guards/workspace-role.guard.js';
import { WorkspaceMembersService } from './services/workspace-members.service.js';
import { WorkspacesService } from './workspaces.service.js';

import type { RequestUser , RequestWorkspaceContext } from '../../common/types/auth.types.js';

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly members: WorkspaceMembersService,
  ) {}

  // ─── Workspace CRUD ──────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new workspace owned by the current user' })
  async create(@CurrentUser() user: RequestUser, @Body() body: CreateWorkspaceDto) {
    return await this.workspaces.create(user.id, body);
  }

  @UseGuards(WorkspaceRoleGuard)
  @Get(':workspaceSlug')
  @ApiOperation({ summary: 'Get a workspace by slug (must be a member)' })
  async getOne(@CurrentWorkspace() ws: RequestWorkspaceContext) {
    return await this.workspaces.getBySlug(ws.slug);
  }

  @UseGuards(WorkspaceRoleGuard)
  @RequireRole('ADMIN')
  @Patch(':workspaceSlug')
  @ApiOperation({ summary: 'Update workspace settings (ADMIN+)' })
  async update(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Body() body: UpdateWorkspaceDto,
  ) {
    return await this.workspaces.update(user.id, ws.id, body);
  }

  @UseGuards(WorkspaceRoleGuard)
  @RequireRole('OWNER')
  @Delete(':workspaceSlug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a workspace (OWNER only)' })
  async remove(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: RequestWorkspaceContext,
  ): Promise<void> {
    await this.workspaces.deleteWorkspace(user.id, ws.id);
  }

  // ─── Members ─────────────────────────────────────────────────────────

  @UseGuards(WorkspaceRoleGuard)
  @Get(':workspaceSlug/members')
  @ApiOperation({ summary: 'List members of a workspace' })
  async listMembers(@CurrentWorkspace() ws: RequestWorkspaceContext) {
    return await this.members.list(ws.id);
  }

  @UseGuards(WorkspaceRoleGuard)
  @RequireRole('ADMIN')
  @Post(':workspaceSlug/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite or add a member to a workspace (ADMIN+)' })
  async invite(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Body() body: InviteMemberDto,
  ) {
    return await this.members.invite(user.id, ws.id, body);
  }

  @UseGuards(WorkspaceRoleGuard)
  @RequireRole('ADMIN')
  @Patch(':workspaceSlug/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change a member\'s role (ADMIN+)' })
  async changeRole(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('userId') targetUserId: string,
    @Body() body: ChangeMemberRoleDto,
  ): Promise<void> {
    await this.members.changeRole(user.id, ws.role, ws.id, targetUserId as UserId, body.role);
  }

  @UseGuards(WorkspaceRoleGuard)
  @RequireRole('ADMIN')
  @Delete(':workspaceSlug/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from a workspace (ADMIN+)' })
  async removeMember(
    @CurrentUser() user: RequestUser,
    @CurrentWorkspace() ws: RequestWorkspaceContext,
    @Param('userId') targetUserId: string,
  ): Promise<void> {
    await this.members.remove(user.id, ws.id, targetUserId as UserId);
  }
}
