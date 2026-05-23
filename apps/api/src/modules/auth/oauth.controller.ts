import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { OAuthProvider } from '@prisma/client';


import { Public } from '../../common/decorators/public.decorator.js';
import { getAppConfig } from '../../config/config.module.js';

import { OAuthService, type OAuthProfile } from './services/oauth.service.js';
import { RefreshTokenService } from './services/refresh-token.service.js';

import type { OAuthProvider as OAuthProviderType } from '@agile-ish/contracts';
import type { CookieOptions, Request, Response } from 'express';

/**
 * OAuth HTTP surface — start + callback for each enabled provider, plus a
 * meta endpoint the web client uses to know which buttons to render.
 *
 *   GET /auth/oauth/providers           — { providers: ['google', 'github'] }
 *   GET /auth/oauth/google/start         — 302 redirect to Google
 *   GET /auth/oauth/google/callback      — Google calls this back, we set
 *                                          the refresh cookie + redirect
 *                                          to the web app
 *   GET /auth/oauth/github/{start,callback}  — same shape
 *
 * The actual OAuth dance is handled by Passport. The `validate()` hooks
 * on each strategy attach a normalised `OAuthProfile` to `req.user`; this
 * controller consumes it, runs `OAuthService.upsertFromProfile`, then
 * issues a session and redirects to the web origin.
 */
@ApiTags('auth')
@Controller('auth/oauth')
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly config: ConfigService,
    @Inject('OAUTH_ENABLED_PROVIDERS')
    private readonly enabledProviders: readonly OAuthProviderType[],
  ) {}

  @Public()
  @SkipThrottle({ global: true, auth: true })
  @Get('providers')
  @ApiOperation({ summary: 'Which OAuth providers are configured server-side' })
  providers(): { providers: readonly OAuthProviderType[] } {
    return { providers: this.enabledProviders };
  }

  // ─────────────── Google ───────────────

  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google/start')
  @ApiOperation({ summary: 'Start the Google OAuth flow' })
  googleStart(): void {
    // The AuthGuard issues the 302 to Google; nothing to do here.
  }

  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.completeOAuthFlow(req, res, OAuthProvider.GOOGLE);
  }

  // ─────────────── GitHub ───────────────

  @Public()
  @UseGuards(AuthGuard('github'))
  @Get('github/start')
  @ApiOperation({ summary: 'Start the GitHub OAuth flow' })
  githubStart(): void {
    // AuthGuard issues the 302 to GitHub; nothing to do here.
  }

  @Public()
  @UseGuards(AuthGuard('github'))
  @Get('github/callback')
  async githubCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.completeOAuthFlow(req, res, OAuthProvider.GITHUB);
  }

  // ─────────────── shared flow ───────────────

  private async completeOAuthFlow(
    req: Request,
    res: Response,
    expectedProvider: OAuthProvider,
  ): Promise<void> {
    const profile = req.user as OAuthProfile | undefined;
    if (profile?.provider !== expectedProvider) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'OAuth callback did not produce a valid profile.',
      });
    }

    const cfg = getAppConfig(this.config);
    const result = await this.oauth.upsertFromProfile(profile);

    if (result.kind === 'email_collision') {
      // Send the user back to login with a friendly explanation.
      res.redirect(`${cfg.urls.app}/login?error=oauth_email_collision`);
      return;
    }

    // Issue a fresh refresh-token family and set the cookie before
    // redirecting to the web origin. Same cookie config as password flow.
    const family = await this.refreshTokens.createFamily({
      userId: result.userId,
      ...(req.headers['user-agent']
        ? { userAgent: String(req.headers['user-agent']).slice(0, 512) }
        : {}),
      ...(req.ip ? { ipAddress: req.ip.slice(0, 64) } : {}),
    });
    res.cookie(cfg.cookies.refreshName, family.secret.raw, this.cookieOptions());

    // The web's auth-bootstrap will call /auth/refresh on first paint and
    // pick up the new session.
    res.redirect(`${cfg.urls.app}/`);
  }

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
}
