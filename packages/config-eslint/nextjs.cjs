/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ['@agile-ish/config-eslint/base.cjs', 'next/core-web-vitals'],
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  env: { browser: true, node: true },
  rules: {
    // Pages/layouts in App Router must default-export.
    'import/no-default-export': 'off',
    // React 19 doesn't need React in scope.
    'react/react-in-jsx-scope': 'off',
  },
  ignorePatterns: ['.next', 'node_modules', 'next-env.d.ts'],
};
