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

import {
  ConfirmEmailVerificationDto,
  RequestEmailVerificationDto,
} from './dto/email-verification.dto.js';
import { EmailVerificationService } from './services/email-verification.service.js';

import type { AuthenticatedRequest } from '../../common/types/auth.types.js';

@ApiTags('auth')
@Controller('auth/email-verification')
export class EmailVerificationController {
  constructor(private readonly service: EmailVerificationService) {}

  /**
   * POST /auth/email-verification/request
   *
   * Returns 200 regardless of whether the email exists or is already
   * verified — prevents enumeration of registered accounts.
   */
  @Public()
  @Throttle({ auth: { limit: 5, ttl: 900_000 } })
  @Post('request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send (or resend) a verification email' })
  async request(
    @Body() body: RequestEmailVerificationDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ ok: true }> {
    await this.service.request({
      email: body.email,
      ...flowContext(req),
    });
    return { ok: true };
  }

  /**
   * POST /auth/email-verification/confirm
   *
   * Validates the token from the email link. Distinguishes between
   * expired/invalid/already-used so the UI can render the right message.
   */
  @Public()
  @Throttle({ auth: { limit: 30, ttl: 900_000 } })
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a verification token' })
  async confirm(@Body() body: ConfirmEmailVerificationDto): Promise<{ verified: true }> {
    const result = await this.service.confirm(body.token);
    switch (result.kind) {
      case 'verified':
        return { verified: true };
      case 'already_used':
        // 200 — idempotent: the email IS verified.
        return { verified: true };
      case 'expired':
        throw new GoneException({
          code: 'CONFLICT',
          message: 'This verification link has expired. Request a new one.',
        });
      case 'invalid':
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'Invalid verification link.',
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
