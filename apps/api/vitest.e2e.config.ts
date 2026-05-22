import { defineConfig } from 'vitest/config';

/**
 * E2E test config — talks to real Postgres + Redis (testcontainers in CI,
 * docker-compose locally). Runs serially because tests mutate the DB.
 * Coverage is off; coverage is the unit-test config's job.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts', 'src/**/*.e2e-spec.ts'],
    exclude: ['node_modules', 'dist'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
