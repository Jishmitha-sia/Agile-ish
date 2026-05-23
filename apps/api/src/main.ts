// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: instrumentation must be the very first import. The OTel SDK
// patches `require` for auto-instrumentation; anything loaded earlier
// escapes tracing for the lifetime of the process.
// ─────────────────────────────────────────────────────────────────────────────
import './instrumentation.js';
import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';


import { AppModule } from './app.module.js';
import { applyBootstrap, nestLogLevels } from './bootstrap.js';
import { getAppConfig } from './config/config.module.js';
import { parseEnv } from './config/env.schema.js';

import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap(): Promise<void> {
  // Fail-fast: validate process.env before Nest constructs anything.
  const env = parseEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: nestLogLevels(env.LOG_LEVEL),
  });

  applyBootstrap(app);

  const cfg = getAppConfig(app.get(ConfigService));
  await app.listen(cfg.runtime.port, cfg.runtime.host);

  // eslint-disable-next-line no-console
  console.log(
    `[api] Listening on http://${cfg.runtime.host}:${cfg.runtime.port}  (env=${cfg.runtime.nodeEnv})`,
  );
}

bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[api] Fatal bootstrap error', err);
  process.exit(1);
});
