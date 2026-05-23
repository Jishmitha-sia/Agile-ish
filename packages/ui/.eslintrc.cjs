/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: [require.resolve('@agile-ish/config-eslint/base.cjs')],
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  env: { browser: true, node: true },
  ignorePatterns: ['dist', 'node_modules'],
};
