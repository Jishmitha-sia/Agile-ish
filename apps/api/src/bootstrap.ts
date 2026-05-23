import { type LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet, { type HelmetOptions } from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';

import { getAppConfig } from './config/config.module.js';

import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Apply cross-cutting middleware and server settings.
 *
 * Order matters:
 *   1. Pino logger replacement — so subsequent log lines are structured.
 *   2. Helmet — security headers (CSP, X-Frame-Options, etc.).
 *   3. Body limits — protect against memory-exhaustion uploads.
 *   4. Cookie parser — must run before any route reads cookies.
 *   5. CORS — must be configured BEFORE the global validation pipe so
 *      preflight responses get the right headers.
 *   6. Graceful shutdown hooks — wire SIGTERM/SIGINT to the Nest lifecycle.
 */
export const applyBootstrap = (app: NestExpressApplication): void => {
  const config = app.get(ConfigService);
  const cfg = getAppConfig(config);

  // Replace Nest's default logger with the structured pino instance.
  app.useLogger(app.get(PinoLogger));

  // Build helmet options conditionally — `exactOptionalPropertyTypes` forbids
  // assigning `undefined` to optional props; we must omit the key instead.
  const helmetOpts: HelmetOptions = { crossOriginEmbedderPolicy: false };
  if (!cfg.runtime.isProduction) {
    helmetOpts.contentSecurityPolicy = false;
  }
  app.use(helmet(helmetOpts));
  app.use(cookieParser());

  // Global validation: nestjs-zod's pipe inspects controller parameters whose
  // type extends `createZodDto(...)` and validates them against the embedded
  // Zod schema. Non-DTO parameters pass through unchanged.
  app.useGlobalPipes(new ZodValidationPipe());

  app.enableCors({
    origin: [...cfg.urls.corsOrigins],
    credentials: true,
    maxAge: 600,
    exposedHeaders: ['x-request-id'],
  });

  app.enableShutdownHooks(); // wires SIGTERM/SIGINT → onModuleDestroy
  app.set('trust proxy', cfg.runtime.isProduction ? 1 : 'loopback');

  // OpenAPI is served in non-production for developer convenience. In
  // production, gate behind an internal endpoint or strip from the build.
  if (!cfg.runtime.isProduction) {
    const doc = new DocumentBuilder()
      .setTitle('Agile-ish API')
      .setVersion(process.env.npm_package_version ?? '0.0.0')
      .addCookieAuth(cfg.cookies.refreshName)
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  }
};

export const nestLogLevels = (logLevel: string): LogLevel[] => {
  switch (logLevel) {
    case 'trace':
    case 'debug':
      return ['error', 'warn', 'log', 'debug', 'verbose'];
    case 'info':
      return ['error', 'warn', 'log'];
    case 'warn':
      return ['error', 'warn'];
    case 'error':
    case 'fatal':
      return ['error'];
    default:
      return ['error', 'warn', 'log'];
  }
};
