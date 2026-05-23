import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { OAuthProvider } from '@prisma/client';
import { Strategy, type VerifyCallback } from 'passport-google-oauth20';

import { getAppConfig } from '../../../config/config.module.js';

import type { OAuthProfile } from '../services/oauth.service.js';

/**
 * Passport strategy for Google OAuth 2.0 ("Sign in with Google").
 *
 * Scope is `email` + `profile` — the minimum needed to identify the user
 * and create / link an account. We do NOT request offline access, so no
 * refresh token is returned; the access token is discarded after the
 * callback completes its lookup.
 *
 * The `verify` callback runs after Google's redirect — it normalises the
 * provider profile into our internal `OAuthProfile` shape, which the
 * controller hands to `OAuthService.upsertFromProfile`.
 */
@Injectable()
export class GoogleOAuthStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const cfg = getAppConfig(config);
    super({
      clientID: cfg.oauth.google.clientId,
      clientSecret: cfg.oauth.google.clientSecret,
      callbackURL: `${cfg.urls.api}/auth/oauth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    _refreshToken: string,
    profile: GoogleProfile,
    done: VerifyCallback,
  ): void {
    const primaryEmail = profile.emails?.[0];
    if (!primaryEmail?.value) {
      return done(
        new UnauthorizedException({
          code: 'UNAUTHORIZED',
          message: 'Google did not return an email for this account.',
        }),
        false,
      );
    }

    const normalised: OAuthProfile = {
      provider: OAuthProvider.GOOGLE,
      providerUserId: profile.id,
      email: primaryEmail.value.toLowerCase(),
      emailVerified: primaryEmail.verified === 'true' || primaryEmail.verified === true,
      displayName: profile.displayName ?? primaryEmail.value.split('@')[0] ?? 'User',
      accessToken,
    };
    done(null, normalised);
  }
}

/** Subset of the passport-google-oauth20 profile we actually use. */
interface GoogleProfile {
  id: string;
  displayName?: string;
  emails?: { value: string; verified?: string | boolean }[];
}
