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
import { SkipThrottle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CurrentWorkspace } from '../workspaces/decorators/current-workspace.decorator.js';
import { RequireRole } from '../workspaces/decorators/require-role.decorator.js';
import { WorkspaceRoleGuard } from '../workspaces/guards/workspace-role.guard.js';

import { CommentsService } from './comments.service.js';
import { CreateCommentDto, UpdateCommentDto } from './dto/comments.dto.js';

import type { RequestUser, RequestWorkspaceContext } from '../../common/types/auth.types.js';

/**
 *   GET    /workspaces/:ws/issues/:issueId/comments          — list comments (member)
 *   POST   /workspaces/:ws/issues/:issueId/comments          — create (MEMBER+)
 *   PATCH  /workspaces/:ws/comments/:commentId               — update author only
 *   DELETE /workspaces/:ws/comments/:commentId               — delete author only
 */
@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(WorkspaceRoleGuard)
@Controller('workspaces/:workspaceSlug')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('issues/:issueId/comments')
  @SkipThrottle({ global: true, auth: true })
  @ApiOperation({ summary: 'List comments on an issue (member)' })
  async list(
    @Param('issueId') issueId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @CurrentWorkspace() _ws: RequestWorkspaceContext,
  ) {
    return await this.comments.listByIssue(issueId);
  }

  @Post('issues/:issueId/comments')
  @HttpCode(HttpStatus.CREATED)
  @RequireRole('MEMBER')
  @ApiOperation({ summary: 'Create a comment on an issue (MEMBER+)' })
  async create(
    @CurrentUser() user: RequestUser,
    @Param('issueId') issueId: string,
    @Body() body: CreateCommentDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @CurrentWorkspace() _ws: RequestWorkspaceContext,
  ) {
    return await this.comments.create(user.id, issueId, body);
  }

  @Patch('comments/:commentId')
  @RequireRole('MEMBER')
  @ApiOperation({ summary: 'Update a comment (author only)' })
  async update(
    @CurrentUser() user: RequestUser,
    @Param('commentId') commentId: string,
    @Body() body: UpdateCommentDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @CurrentWorkspace() _ws: RequestWorkspaceContext,
  ) {
    return await this.comments.update(user.id, commentId, body);
  }

  @Delete('comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole('MEMBER')
  @ApiOperation({ summary: 'Delete a comment (author only)' })
  async remove(
    @CurrentUser() user: RequestUser,
    @Param('commentId') commentId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @CurrentWorkspace() _ws: RequestWorkspaceContext,
  ): Promise<void> {
    await this.comments.deleteComment(user.id, commentId);
  }
}
