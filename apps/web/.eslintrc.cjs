/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@agile-ish/config-eslint/nextjs.cjs'],
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
};
