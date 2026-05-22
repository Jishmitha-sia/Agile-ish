import { defineConfig } from 'vitest/config';

/**
 * Unit-test config. Fast, parallel, no DB. Tests that need a real Postgres
 * (auth round-trips, RLS policies) go in `vitest.e2e.config.ts`, which uses
 * a real container and runs serially.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', '**/*.e2e-spec.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.e2e-spec.ts',
        'src/generated/**',
        'src/main.ts',
        'src/instrumentation.ts',
      ],
      thresholds: {
        // Phase 1 starts at 0 — tightens phase by phase. Keep the gate
        // honest: tracking coverage we don't enforce is worse than skipping.
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
});
