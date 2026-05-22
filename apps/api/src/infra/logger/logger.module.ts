import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { getAppConfig } from '../../config/config.module.js';
import { REQUEST_ID_HEADER } from '../../common/interceptors/request-id.interceptor.js';

/**
 * Structured logging via pino. Every request gets a child logger bound to
 * `requestId` so downstream log lines automatically carry the correlation
 * id without callers having to thread it manually.
 *
 * In development we render with pino-pretty (colourised, single-line).
 * In production we emit newline-delimited JSON for Loki / log aggregators.
 *
 * The header-based `requestId` reads the same header that
 * RequestIdInterceptor writes — pino-http runs first in the middleware
 * chain so the value is available even if the interceptor hasn't fired yet.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const cfg = getAppConfig(config);
        return {
          pinoHttp: {
            level: cfg.runtime.logLevel,
            genReqId: (req, res) => {
              const incoming = req.headers[REQUEST_ID_HEADER];
              if (typeof incoming === 'string' && incoming.length > 0) return incoming;
              return res.getHeader(REQUEST_ID_HEADER)?.toString() ?? '';
            },
            customProps: (req) => {
              const user = (req as unknown as { user?: { id?: string } }).user;
              return user?.id ? { userId: user.id } : {};
            },
            serializers: {
              req: (req: { id: string; method: string; url: string }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
              res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["set-cookie"]',
                'res.headers["set-cookie"]',
              ],
              censor: '[REDACTED]',
            },
            transport: cfg.runtime.logPretty
              ? {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
                }
              : undefined,
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
