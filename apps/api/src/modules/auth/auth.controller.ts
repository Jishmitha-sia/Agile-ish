import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';


import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { getAppConfig } from '../../config/config.module.js';

import { AuthService } from './auth.service.js';
import { LoginDto, SessionResponseDto, SignupDto } from './dto/auth.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

import type { AuthenticatedRequest, RequestUser } from '../../common/types/auth.types.js';
import type { CookieOptions, Response } from 'express';

/**
 * Auth HTTP surface.
 *
 *   POST /auth/signup    — public, throttled by 'auth' bucket
 *   POST /auth/login     — public, throttled by 'auth' bucket
 *   POST /auth/refresh   — public (carries cookie), throttled
 *   POST /auth/logout    — authenticated
 *   GET  /auth/me        — authenticated
 *
 * The refresh token never leaves the httpOnly cookie. Response bodies
 * contain only the access token + user profile.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────
  // POST /auth/signup
  // ──────────────────────────────────────────────────────────────────────
  @Public()
  @Throttle({ auth: { limit: 5, ttl: 900_000 } })
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an account + personal workspace' })
  async signup(
    @Body() body: SignupDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponseDto> {
    const { session, refreshSecret } = await this.auth.signup(body, this.flowContext(req));
    this.setRefreshCookie(res, refreshSecret);
    return session;
  }

  // ──────────────────────────────────────────────────────────────────────
  // POST /auth/login
  // ──────────────────────────────────────────────────────────────────────
  @Public()
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange credentials for a session' })
  async login(
    @Body() body: LoginDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponseDto> {
    const { session, refreshSecret } = await this.auth.login(body, this.flowContext(req));
    this.setRefreshCookie(res, refreshSecret);
    return session;
  }

  // ──────────────────────────────────────────────────────────────────────
  // POST /auth/refresh   (rotate refresh + issue new access token)
  // ──────────────────────────────────────────────────────────────────────
  @Public()
  @Throttle({ auth: { limit: 30, ttl: 900_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Rotate the refresh token and re-issue an access token' })
  async refresh(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponseDto> {
    const cookieName = getAppConfig(this.config).cookies.refreshName;
    const presented = (req.cookies as Record<string, string | undefined> | undefined)?.[cookieName];
    if (!presented) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Missing refresh cookie',
      });
    }
    try {
      const { session, refreshSecret } = await this.auth.refresh(presented, this.flowContext(req));
      this.setRefreshCookie(res, refreshSecret);
      return session;
    } catch (err) {
      // On any refresh failure, clear the cookie so the client doesn't
      // keep retrying with a known-bad value.
      this.clearRefreshCookie(res);
      throw err;
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // POST /auth/logout
  // ──────────────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: RequestUser,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const cookieName = getAppConfig(this.config).cookies.refreshName;
    const presented = (req.cookies as Record<string, string | undefined> | undefined)?.[cookieName];
    await this.auth.logout(presented, user.id);
    this.clearRefreshCookie(res);
  }

  // ──────────────────────────────────────────────────────────────────────
  // GET /auth/me — surfaced under /users/me too for symmetry; here so the
  // bootstrap UI can hit /auth/me as the very first call.
  // ──────────────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('me')
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: RequestUser) {
    return await this.auth.loadCurrentUser(user.id);
  }

  // ─── helpers ─────────────────────────────────────────────────────────

  private cookieOptions(): CookieOptions {
    const cfg = getAppConfig(this.config);
    return {
      httpOnly: true,
      secure: cfg.cookies.secure,
      sameSite: cfg.cookies.sameSite,
      domain: cfg.cookies.domain,
      path: '/',
      maxAge: cfg.jwt.refreshTtlSeconds * 1000,
    };
  }

  private setRefreshCookie(res: Response, raw: string): void {
    const { cookies } = getAppConfig(this.config);
    res.cookie(cookies.refreshName, raw, this.cookieOptions());
  }

  private clearRefreshCookie(res: Response): void {
    const { cookies } = getAppConfig(this.config);
    res.clearCookie(cookies.refreshName, { ...this.cookieOptions(), maxAge: 0 });
  }

  private flowContext(req: AuthenticatedRequest): { userAgent?: string; ipAddress?: string } {
    const ua = req.headers['user-agent'];
    const xff = req.headers['x-forwarded-for'];
    const ipFromHeader = Array.isArray(xff) ? xff[0] : xff?.split(',')[0]?.trim();
    const ip = ipFromHeader ?? req.ip;
    return {
      ...(typeof ua === 'string' ? { userAgent: ua.slice(0, 512) } : {}),
      ...(ip ? { ipAddress: ip.slice(0, 64) } : {}),
    };
  }
}
