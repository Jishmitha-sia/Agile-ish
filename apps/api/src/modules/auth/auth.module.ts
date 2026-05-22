import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PasswordService } from './services/password.service.js';
import { RefreshTokenService } from './services/refresh-token.service.js';
import { TokenService } from './services/token.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt', session: false })],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    RefreshTokenService,
    JwtStrategy,
    JwtAuthGuard,
  ],
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    RefreshTokenService,
    JwtAuthGuard,
  ],
})
export class AuthModule {}
