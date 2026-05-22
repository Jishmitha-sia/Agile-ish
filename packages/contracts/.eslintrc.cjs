/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@agile-ish/config-eslint/base.cjs'],
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  env: { node: true },
  ignorePatterns: ['dist', 'node_modules'],
};
