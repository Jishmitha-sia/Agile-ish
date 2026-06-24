import {
  BadRequestException,
  Body,
  Controller,
  GoneException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator.js';

import { ConfirmPasswordResetDto, RequestPasswordResetDto } from './dto/password-reset.dto.js';
import { PasswordResetService } from './services/password-reset.service.js';

import type { AuthenticatedRequest } from '../../common/types/auth.types.js';

@ApiTags('auth')
@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private readonly service: PasswordResetService) {}

  /**
   * POST /auth/password-reset/request
   *
   * Returns 200 regardless of whether the email is registered.
   */
  @Public()
  @Throttle({ auth: { limit: 5, ttl: 900_000 } })
  @Post('request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password-reset email' })
  async request(
    @Body() body: RequestPasswordResetDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ ok: true }> {
    await this.service.request({
      email: body.email,
      ...flowContext(req),
    });
    return { ok: true };
  }

  /**
   * POST /auth/password-reset/confirm
   *
   * On success, EVERY refresh-token family for the user is revoked.
   * The client should treat this as a forced logout — redirect to /login.
   */
  @Public()
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a password reset' })
  async confirm(
    @Body() body: ConfirmPasswordResetDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ reset: true }> {
    const ctx = flowContext(req);
    const result = await this.service.confirm({
      token: body.token,
      newPassword: body.newPassword,
      ipAddress: ctx.ipAddress,
    });
    switch (result.kind) {
      case 'reset':
        return { reset: true };
      case 'expired':
        throw new GoneException({
          code: 'CONFLICT',
          message: 'This reset link has expired. Request a new one.',
        });
      case 'already_used':
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'This reset link has already been used.',
        });
      case 'invalid':
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'Invalid reset link.',
        });
    }
  }
}

const flowContext = (req: AuthenticatedRequest): { ipAddress?: string; userAgent?: string } => {
  const ua = req.headers['user-agent'];
  const xff = req.headers['x-forwarded-for'];
  const ipFromHeader = Array.isArray(xff) ? xff[0] : xff?.split(',')[0]?.trim();
  const ip = ipFromHeader ?? req.ip;
  return {
    ...(typeof ua === 'string' ? { userAgent: ua.slice(0, 512) } : {}),
    ...(ip ? { ipAddress: ip.slice(0, 64) } : {}),
  };
};
