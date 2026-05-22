import { z } from 'zod';

/**
 * Single source of truth for runtime configuration.
 *
 * Every variable is parsed and coerced via Zod at boot. A missing or
 * malformed value throws a friendly error listing every offending key,
 * and the process exits before any module is constructed. This is the
 * "fail-fast" contract — misconfigured environments are never allowed to
 * partially boot and corrupt state.
 */

const booleanString = z
  .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
  .transform((v) => v === 'true' || v === '1');

const base64NonEmpty = z
  .string()
  .min(1, 'must be a non-empty base64-encoded PEM')
  .refine((v) => /^[A-Za-z0-9+/=\r\n]+$/.test(v), 'must be valid base64');

export const envSchema = z
  .object({
    // ───── Runtime ─────
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    API_HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    LOG_PRETTY: booleanString.default('false'),

    // ───── Public URLs ─────
    APP_URL: z.string().url(),
    API_URL: z.string().url(),
    CORS_ORIGINS: z
      .string()
      .min(1)
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),

    // ───── Postgres ─────
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),

    // ───── Redis ─────
    REDIS_URL: z.string().url(),
    REDIS_NAMESPACE: z.string().default('agile-ish'),

    // ───── JWT ─────
    JWT_PRIVATE_KEY_BASE64: base64NonEmpty,
    JWT_PUBLIC_KEY_BASE64: base64NonEmpty,
    JWT_ISSUER: z.string().min(1),
    JWT_AUDIENCE: z.string().min(1),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().min(3600).max(31_536_000).default(2_592_000),

    // ───── Cookies ─────
    COOKIE_DOMAIN: z.string().min(1),
    COOKIE_SECURE: booleanString.default('false'),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    REFRESH_COOKIE_NAME: z.string().min(1).default('agile_rt'),

    // ───── Argon2id ─────
    ARGON2_MEMORY_KIB: z.coerce.number().int().min(8192).max(1_048_576).default(19_456),
    ARGON2_TIME_COST: z.coerce.number().int().min(1).max(10).default(2),
    ARGON2_PARALLELISM: z.coerce.number().int().min(1).max(8).default(1),

    // ───── Rate limiting ─────
    RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().min(1).default(60),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
    AUTH_RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().min(1).default(900),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),

    // ───── SMTP ─────
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535),
    SMTP_SECURE: booleanString.default('false'),
    SMTP_USER: z.string().optional().default(''),
    SMTP_PASSWORD: z.string().optional().default(''),
    MAIL_FROM: z.string().min(1),

    // ───── OpenTelemetry ─────
    OTEL_ENABLED: booleanString.default('false'),
    OTEL_SERVICE_NAME: z.string().default('agile-ish-api'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
    OTEL_EXPORTER_OTLP_PROTOCOL: z.enum(['http/protobuf', 'grpc']).default('http/protobuf'),

    // ───── AI (Phase 6) ─────
    AI_PROVIDER: z.enum(['ollama', 'openai-compatible']).default('ollama'),
    AI_BASE_URL: z.string().url().default('http://localhost:11434/v1'),
    AI_API_KEY: z.string().default('ollama'),
    AI_MODEL: z.string().default('llama3.1:8b'),
    AI_EMBEDDING_MODEL: z.string().default('nomic-embed-text'),

    // ───── Vector store (Phase 6) ─────
    VECTOR_BACKEND: z.enum(['pgvector', 'qdrant']).default('pgvector'),
    QDRANT_URL: z.string().url().default('http://localhost:6333'),
    QDRANT_API_KEY: z.string().default(''),
  })
  .superRefine((env, ctx) => {
    // In production, refuse insecure cookie configuration.
    if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true in production',
      });
    }
    if (env.NODE_ENV === 'production' && env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SAMESITE'],
        message: 'SameSite=None requires Secure=true',
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Parse and validate process.env. Called once at boot before Nest constructs
 * any module. On failure, prints every issue with its path and exits(1).
 */
export const parseEnv = (raw: NodeJS.ProcessEnv = process.env): AppEnv => {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ✗ ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`\n[config] Invalid environment configuration:\n${issues}\n`);
    process.exit(1);
  }
  return result.data;
};
