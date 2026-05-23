import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

import { getAppConfig } from '../../../config/config.module.js';

/**
 * Password hashing with Argon2id.
 *
 * Tuning knobs live in env (ARGON2_MEMORY_KIB / ARGON2_TIME_COST /
 * ARGON2_PARALLELISM) so operators can tighten on faster hardware without
 * a code change. The defaults follow OWASP 2024 guidance: 19 MiB memory,
 * 2 iterations, 1 lane — ~250ms on a modern server CPU.
 *
 * `verifyAndUpgrade` returns the new hash when the stored hash uses
 * weaker parameters than current config — callers persist it transparently
 * so the user's password gets re-hashed at the new cost on next login.
 */
@Injectable()
export class PasswordService {
  private readonly hashOptions: argon2.Options;

  constructor(config: ConfigService) {
    const { argon } = getAppConfig(config);
    this.hashOptions = {
      type: argon2.argon2id,
      memoryCost: argon.memoryKib,
      timeCost: argon.timeCost,
      parallelism: argon.parallelism,
    };
  }

  async hash(plain: string): Promise<string> {
    return await argon2.hash(plain, this.hashOptions);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // argon2.verify throws on malformed hashes — treat as auth failure.
      return false;
    }
  }

  /**
   * Verify a password. If verification succeeds AND the stored hash uses
   * weaker parameters than current config, return the new hash so the
   * caller can persist the upgrade. Returns null otherwise.
   */
  async verifyAndUpgrade(hash: string, plain: string): Promise<string | null> {
    const ok = await this.verify(hash, plain);
    if (!ok) return null;
    if (argon2.needsRehash(hash, this.hashOptions)) {
      return await this.hash(plain);
    }
    return null;
  }
}
