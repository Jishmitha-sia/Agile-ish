/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  // Sibling file — relative path avoids pnpm symlink resolution quirks.
  extends: [require.resolve('./base.cjs')],
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  env: { node: true, jest: true },
  rules: {
    // NestJS uses class-based decorators heavily; default-exports stay rare.
    'import/no-default-export': 'off',
    // Constructor parameter properties are idiomatic in Nest.
    '@typescript-eslint/no-parameter-properties': 'off',
    // Nest controllers/services frequently use empty constructors via DI metadata.
    '@typescript-eslint/no-extraneous-class': 'off',
  },
  ignorePatterns: ['dist', 'node_modules', 'src/generated', 'prisma/migrations'],
};
