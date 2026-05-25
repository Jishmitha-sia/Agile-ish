import { AcceptInvitationRequest } from '@agile-ish/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

import { WorkspaceInvitationsService } from './services/workspace-invitations.service.js';

import type { RequestUser } from '../../common/types/auth.types.js';

class AcceptInvitationDto extends createZodDto(AcceptInvitationRequest) {}

/**
 * Public surface for accepting workspace invitations.
 *
 *   GET  /workspace-invitations/lookup?token=…  — public, used by the
 *        accept-invite page to confirm the invite is real before showing
 *        the signup or accept form.
 *   POST /workspace-invitations/accept          — authenticated, consumes
 *        the token and adds the caller as a member of the invited workspace.
 *
 * Lookup is unauthenticated because the recipient clicks the email link
 * before they've signed in. The token itself is the auth — possessing it
 * proves the invitation reached the intended inbox.
 */
@ApiTags('workspace-invitations')
@Controller('workspace-invitations')
export class WorkspaceInvitationsController {
  constructor(private readonly invitations: WorkspaceInvitationsService) {}

  @Public()
  @Get('lookup')
  @ApiOperation({ summary: 'Resolve an invitation token to public-safe metadata' })
  async lookup(@Query('token') token: string | undefined) {
    if (!token) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Missing token query parameter.',
      });
    }
    return await this.invitations.lookup(token);
  }

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an invitation as the authenticated user' })
  async accept(@CurrentUser() user: RequestUser, @Body() body: AcceptInvitationDto) {
    const result = await this.invitations.accept(user.id, body.token);
    return {
      workspace: {
        slug: result.workspaceSlug,
        name: result.workspaceName,
      },
    };
  }
}
