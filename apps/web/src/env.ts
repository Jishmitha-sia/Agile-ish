import { z } from 'zod';

/**
 * Web-side env validation.
 *
 * Two split schemas because Next.js distinguishes server-only and
 * client-bundled env vars by the `NEXT_PUBLIC_` prefix. Anything you
 * want to read from a `'use client'` component must be public.
 *
 * Validation runs at module load — bad config makes the page fail to
 * render, not silently degrade.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_REFRESH_COOKIE_NAME: z.string().min(1).default('agile_rt'),
});

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parseClient = (): z.infer<typeof clientSchema> => {
  // `process.env.NEXT_PUBLIC_*` references are statically replaced by the
  // Next.js build — they MUST be referenced directly, not via dynamic key.
  const result = clientSchema.safeParse({
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_REFRESH_COOKIE_NAME: process.env.NEXT_PUBLIC_REFRESH_COOKIE_NAME,
  });
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ✗ ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`[env] Invalid client environment:\n${issues}`);
  }
  return result.data;
};

const parseServer = (): z.infer<typeof serverSchema> => {
  return serverSchema.parse({ NODE_ENV: process.env.NODE_ENV });
};

export const clientEnv = parseClient();
export const serverEnv = parseServer();
