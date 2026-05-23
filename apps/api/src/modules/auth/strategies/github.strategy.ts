import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { OAuthProvider } from '@prisma/client';
import { Strategy } from 'passport-github2';

import { getAppConfig } from '../../../config/config.module.js';

import type { OAuthProfile } from '../services/oauth.service.js';

/**
 * Passport strategy for GitHub OAuth ("Sign in with GitHub").
 *
 * Scope is `read:user user:email` — needed because GitHub doesn't include
 * the user's primary email in the basic profile, and we need the `verified`
 * flag from `/user/emails` so we know whether GitHub has proven ownership.
 *
 * We do NOT trust passport-github2's `profile.emails` mapping for the
 * `verified` flag — it has been observed to drop it, which would silently
 * downgrade us into the email-collision path even for verified primary
 * emails. Instead we call `/user/emails` ourselves and read GitHub's
 * authoritative response. The verified flag gates auto-linking onto
 * existing accounts, so a false negative here is a real UX bug.
 */
@Injectable()
export class GitHubOAuthStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(config: ConfigService) {
    const cfg = getAppConfig(config);
    super({
      clientID: cfg.oauth.github.clientId,
      clientSecret: cfg.oauth.github.clientSecret,
      callbackURL: `${cfg.urls.api}/auth/oauth/github/callback`,
      scope: ['read:user', 'user:email'],
    });
  }

  async validate(
    accessToken: string,
    _refreshToken: string,
    profile: GitHubProfile,
    done: (err: unknown, user?: unknown) => void,
  ): Promise<void> {
    try {
      const primary = await this.fetchPrimaryVerifiedEmail(accessToken);
      if (!primary) {
        return done(
          new UnauthorizedException({
            code: 'UNAUTHORIZED',
            message:
              'GitHub did not return a verified primary email. Verify an email on GitHub before continuing.',
          }),
          false,
        );
      }

      const normalised: OAuthProfile = {
        provider: OAuthProvider.GITHUB,
        providerUserId: profile.id,
        email: primary.email.toLowerCase(),
        emailVerified: true,
        displayName:
          profile.displayName ?? profile.username ?? primary.email.split('@')[0] ?? 'User',
        handle: profile.username,
        accessToken,
      };
      done(null, normalised);
    } catch (err) {
      done(err);
    }
  }

  private async fetchPrimaryVerifiedEmail(
    accessToken: string,
  ): Promise<{ email: string } | null> {
    const res = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'agile-ish-oauth',
      },
    });
    if (!res.ok) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Could not read verified emails from GitHub.',
      });
    }
    const emails = (await res.json()) as {
      email: string;
      primary: boolean;
      verified: boolean;
    }[];
    const primary = emails.find((e) => e.primary && e.verified);
    if (primary) return { email: primary.email };
    // No primary verified — fall back to the first verified email.
    const anyVerified = emails.find((e) => e.verified);
    return anyVerified ? { email: anyVerified.email } : null;
  }
}

/** Subset of the passport-github2 profile we actually use. */
interface GitHubProfile {
  id: string;
  username?: string;
  displayName?: string;
}
