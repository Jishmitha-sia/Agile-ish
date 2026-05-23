import { Module, type Provider } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';


import { parseEnv } from '../../config/env.schema.js';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationController } from './email-verification.controller.js';
import { EmailVerificationSubscriber } from './email-verification.subscriber.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { OAuthController } from './oauth.controller.js';
import { PasswordResetController } from './password-reset.controller.js';
import { EmailTokenService } from './services/email-token.service.js';
import { EmailVerificationService } from './services/email-verification.service.js';
import { OAuthService } from './services/oauth.service.js';
import { PasswordResetService } from './services/password-reset.service.js';
import { PasswordService } from './services/password.service.js';
import { RefreshTokenService } from './services/refresh-token.service.js';
import { TokenService } from './services/token.service.js';
import { GitHubOAuthStrategy } from './strategies/github.strategy.js';
import { GoogleOAuthStrategy } from './strategies/google.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

import type { OAuthProvider } from '@agile-ish/contracts';

// ─────────────────────────────────────────────────────────────────────────────
// Conditional OAuth provider registration.
//
// Reading process.env at module-import time is intentional: the strategies
// throw at construction if their client ID/secret is empty, so we MUST
// avoid instantiating them when the operator hasn't configured creds. The
// `parseEnv()` call here is cheap (~ms) and runs only once per process.
//
// The same env signals are surfaced to the OAuthController via the
// 'OAUTH_ENABLED_PROVIDERS' token so the web client knows which buttons
// to render at /auth/oauth/providers.
// ─────────────────────────────────────────────────────────────────────────────
const env = parseEnv();
const googleEnabled = Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
const githubEnabled = Boolean(env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET);

const enabledProviders: readonly OAuthProvider[] = [
  ...(googleEnabled ? (['google'] as const) : []),
  ...(githubEnabled ? (['github'] as const) : []),
];

const oauthStrategyProviders: Provider[] = [
  ...(googleEnabled ? [GoogleOAuthStrategy] : []),
  ...(githubEnabled ? [GitHubOAuthStrategy] : []),
];

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt', session: false })],
  controllers: [
    AuthController,
    EmailVerificationController,
    PasswordResetController,
    OAuthController,
  ],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    RefreshTokenService,
    EmailTokenService,
    EmailVerificationService,
    EmailVerificationSubscriber,
    PasswordResetService,
    OAuthService,
    JwtStrategy,
    JwtAuthGuard,
    ...oauthStrategyProviders,
    {
      provide: 'OAUTH_ENABLED_PROVIDERS',
      useValue: enabledProviders,
    },
  ],
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    RefreshTokenService,
    EmailTokenService,
    EmailVerificationService,
    PasswordResetService,
    OAuthService,
    JwtAuthGuard,
  ],
})
export class AuthModule {}
