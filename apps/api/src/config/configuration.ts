import { Buffer } from 'node:buffer';

import type { AppEnv } from './env.schema.js';

/**
 * Strongly-typed, grouped configuration shape consumed by the rest of the
 * application. Built once at boot from a validated `AppEnv`. Modules read
 * from `ConfigService.get('jwt')` etc. — never from `process.env` directly.
 *
 * Grouping keys by concern (jwt, cookies, smtp) keeps test stubs small and
 * makes ownership obvious when a module needs a slice of config.
 */
export interface AppConfig {
  runtime: {
    nodeEnv: AppEnv['NODE_ENV'];
    isProduction: boolean;
    isTest: boolean;
    port: number;
    host: string;
    logLevel: AppEnv['LOG_LEVEL'];
    logPretty: boolean;
  };
  urls: {
    app: string;
    api: string;
    corsOrigins: readonly string[];
  };
  database: {
    url: string;
    directUrl: string;
  };
  redis: {
    url: string;
    namespace: string;
  };
  jwt: {
    privateKeyPem: string;
    publicKeyPem: string;
    issuer: string;
    audience: string;
    accessTtlSeconds: number;
    refreshTtlSeconds: number;
  };
  cookies: {
    domain: string;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    refreshName: string;
  };
  argon: {
    memoryKib: number;
    timeCost: number;
    parallelism: number;
  };
  rateLimit: {
    global: { ttlSeconds: number; max: number };
    auth: { ttlSeconds: number; max: number };
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
  };
  telemetry: {
    enabled: boolean;
    serviceName: string;
    endpoint: string;
    protocol: 'http/protobuf' | 'grpc';
  };
  ai: {
    provider: 'ollama' | 'openai-compatible';
    baseUrl: string;
    apiKey: string;
    model: string;
    embeddingModel: string;
  };
  vector: {
    backend: 'pgvector' | 'qdrant';
    qdrantUrl: string;
    qdrantApiKey: string;
  };
}

const decodeBase64Pem = (base64: string): string => Buffer.from(base64, 'base64').toString('utf8');

export const buildAppConfig = (env: AppEnv): AppConfig => ({
  runtime: {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    port: env.API_PORT,
    host: env.API_HOST,
    logLevel: env.LOG_LEVEL,
    logPretty: env.LOG_PRETTY,
  },
  urls: {
    app: env.APP_URL,
    api: env.API_URL,
    corsOrigins: env.CORS_ORIGINS,
  },
  database: {
    url: env.DATABASE_URL,
    directUrl: env.DIRECT_URL,
  },
  redis: {
    url: env.REDIS_URL,
    namespace: env.REDIS_NAMESPACE,
  },
  jwt: {
    privateKeyPem: decodeBase64Pem(env.JWT_PRIVATE_KEY_BASE64),
    publicKeyPem: decodeBase64Pem(env.JWT_PUBLIC_KEY_BASE64),
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
    refreshTtlSeconds: env.JWT_REFRESH_TTL_SECONDS,
  },
  cookies: {
    domain: env.COOKIE_DOMAIN,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    refreshName: env.REFRESH_COOKIE_NAME,
  },
  argon: {
    memoryKib: env.ARGON2_MEMORY_KIB,
    timeCost: env.ARGON2_TIME_COST,
    parallelism: env.ARGON2_PARALLELISM,
  },
  rateLimit: {
    global: { ttlSeconds: env.RATE_LIMIT_TTL_SECONDS, max: env.RATE_LIMIT_MAX },
    auth: { ttlSeconds: env.AUTH_RATE_LIMIT_TTL_SECONDS, max: env.AUTH_RATE_LIMIT_MAX },
  },
  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.MAIL_FROM,
  },
  telemetry: {
    enabled: env.OTEL_ENABLED,
    serviceName: env.OTEL_SERVICE_NAME,
    endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    protocol: env.OTEL_EXPORTER_OTLP_PROTOCOL,
  },
  ai: {
    provider: env.AI_PROVIDER,
    baseUrl: env.AI_BASE_URL,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
    embeddingModel: env.AI_EMBEDDING_MODEL,
  },
  vector: {
    backend: env.VECTOR_BACKEND,
    qdrantUrl: env.QDRANT_URL,
    qdrantApiKey: env.QDRANT_API_KEY,
  },
});
