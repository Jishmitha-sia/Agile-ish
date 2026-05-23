import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { getAppConfig } from '../../../config/config.module.js';

import type { RequestUser } from '../../../common/types/auth.types.js';
import type { UserId } from '@agile-ish/contracts';
import type { Request } from 'express';

interface RawJwtPayload {
  sub: string;
  email: string;
  sid: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string | string[];
}

/**
 * Passport JWT strategy that verifies RS256 access tokens.
 *
 * The strategy returns the `RequestUser` shape consumed by guards,
 * decorators, and controllers — keeping the wire format (JWT payload) and
 * the application object distinct lets us evolve either side without
 * cascading changes.
 *
 * `passReqToCallback` is on so we can attach the requestId to the auth
 * error message if needed (currently unused but cheap to keep open).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const cfg = getAppConfig(config);
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.jwt.publicKeyPem,
      algorithms: ['RS256'],
      issuer: cfg.jwt.issuer,
      audience: cfg.jwt.audience,
      passReqToCallback: true,
    });
  }

  validate(_req: Request, payload: RawJwtPayload): RequestUser {
    if (!payload.sub || !payload.sid || !payload.email) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Malformed access token',
      });
    }
    return {
      id: payload.sub as UserId,
      email: payload.email,
      sessionId: payload.sid,
    };
  }
}
