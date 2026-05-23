/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  // Relative path — ESLint 8's resolver doesn't always find pnpm-symlinked
  // workspace packages reliably via `@agile-ish/config-eslint/base.cjs`.
  extends: [require.resolve('@agile-ish/config-eslint/base.cjs')],
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  env: { node: true },
  ignorePatterns: ['dist', 'node_modules'],
};
