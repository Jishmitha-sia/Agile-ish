import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationController } from './email-verification.controller.js';
import { EmailVerificationSubscriber } from './email-verification.subscriber.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PasswordResetController } from './password-reset.controller.js';
import { EmailTokenService } from './services/email-token.service.js';
import { EmailVerificationService } from './services/email-verification.service.js';
import { PasswordResetService } from './services/password-reset.service.js';
import { PasswordService } from './services/password.service.js';
import { RefreshTokenService } from './services/refresh-token.service.js';
import { TokenService } from './services/token.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt', session: false })],
  controllers: [AuthController, EmailVerificationController, PasswordResetController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    RefreshTokenService,
    EmailTokenService,
    EmailVerificationService,
    EmailVerificationSubscriber,
    PasswordResetService,
    JwtStrategy,
    JwtAuthGuard,
  ],
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    RefreshTokenService,
    EmailTokenService,
    EmailVerificationService,
    PasswordResetService,
    JwtAuthGuard,
  ],
})
export class AuthModule {}
