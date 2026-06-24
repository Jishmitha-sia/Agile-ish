import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';

import { buildAppConfig, type AppConfig } from './configuration.js';
import { parseEnv } from './env.schema.js';

/**
 * Centralised configuration provider.
 *
 * - Validates `process.env` once via Zod (parseEnv) — boot aborts on failure.
 * - Exposes the resulting `AppConfig` through `ConfigService.get<AppConfig>('app')`.
 * - Made global so every feature module can inject `ConfigService` without
 *   re-importing this module.
 */
export const APP_CONFIG = 'app';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      ignoreEnvFile: true, // .env loading is handled by docker compose / process manager
      load: [(): { [APP_CONFIG]: AppConfig } => ({ [APP_CONFIG]: buildAppConfig(parseEnv()) })],
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}

/**
 * Typed accessor — eliminates the `string` cache-key footgun.
 * Usage: `const cfg = getAppConfig(this.config);`
 */
export const getAppConfig = (config: ConfigService): AppConfig => {
  const cfg = config.get<AppConfig>(APP_CONFIG);
  if (!cfg) {
    throw new Error('AppConfig not loaded — ConfigModule must be imported first.');
  }
  return cfg;
};
