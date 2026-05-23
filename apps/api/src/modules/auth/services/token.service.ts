import { createHash, randomBytes } from 'node:crypto';

import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importPKCS8, importSPKI, jwtVerify, SignJWT, type JWTPayload, type KeyLike } from 'jose';

import { getAppConfig } from '../../../config/config.module.js';

import type { UserId } from '@agile-ish/contracts';

/**
 * Asymmetric (RS256) access-token issuance and verification.
 *
 * Why asymmetric over HS256:
 *   • Future Phase 1.5 OIDC interop — third-party verifiers (e.g. a
 *     dedicated socket-gateway service) can verify tokens with the public
 *     key alone, no shared secret distribution.
 *   • Compromising a verifier doesn't yield signing capability.
 *
 * We import the PEM-encoded keys once at module init and cache the
 * resulting `KeyLike` — `jose` uses native crypto under the hood, so this
 * is just an internal handle, not a hot-path import on every sign.
 *
 * The refresh token is a 256-bit random string (NOT a JWT). It carries no
 * claims; the server looks it up in `refresh_tokens` to decide what it
 * means. This is the standard "opaque refresh token" pattern — gives us
 * server-side revocation in O(1) and reuse-detection in O(family-size).
 */

export interface AccessTokenInput {
  userId: UserId;
  email: string;
  sessionId: string;
}

export interface AccessTokenResult {
  token: string;
  expiresAt: Date;
}

export interface RefreshTokenSecret {
  raw: string;
  hash: string; // sha256 hex — stored in DB
}

@Injectable()
export class TokenService implements OnModuleInit {
  private privateKey!: KeyLike;
  private publicKey!: KeyLike;
  private issuer!: string;
  private audience!: string;
  private accessTtlSeconds!: number;
  private refreshTtlSeconds!: number;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const { jwt } = getAppConfig(this.config);
    this.privateKey = await importPKCS8(jwt.privateKeyPem, 'RS256');
    this.publicKey = await importSPKI(jwt.publicKeyPem, 'RS256');
    this.issuer = jwt.issuer;
    this.audience = jwt.audience;
    this.accessTtlSeconds = jwt.accessTtlSeconds;
    this.refreshTtlSeconds = jwt.refreshTtlSeconds;
  }

  async signAccessToken(input: AccessTokenInput): Promise<AccessTokenResult> {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.accessTtlSeconds;
    const token = await new SignJWT({ email: input.email, sid: input.sessionId })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setSubject(input.userId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(this.privateKey);
    return { token, expiresAt: new Date(exp * 1000) };
  }

  async verifyAccessToken(token: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(token, this.publicKey, {
      issuer: this.issuer,
      audience: this.audience,
      algorithms: ['RS256'],
    });
    return payload;
  }

  /**
   * Generate a fresh refresh-token secret + its DB-storable hash.
   * The raw value lives only in the httpOnly cookie sent to the browser.
   */
  generateRefreshSecret(): RefreshTokenSecret {
    const raw = randomBytes(48).toString('base64url'); // 64-char URL-safe string
    const hash = createHash('sha256').update(raw).digest('hex');
    return { raw, hash };
  }

  /** Hash a raw refresh token presented by a client (cookie value). */
  hashRefreshSecret(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  get refreshTtl(): number {
    return this.refreshTtlSeconds;
  }
}
