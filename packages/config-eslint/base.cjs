/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: false,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import', 'promise', 'unicorn', 'unused-imports'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:promise/recommended',
    'prettier',
  ],
  settings: {
    'import/resolver': {
      typescript: { alwaysTryTypes: true },
      node: true,
    },
  },
  rules: {
    // TypeScript hygiene
    '@typescript-eslint/no-unused-vars': 'off', // handled by unused-imports
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/return-await': ['error', 'always'],
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',

    // Unused imports
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
    ],

    // Imports
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-default-export': 'warn',
    'import/no-cycle': 'error',
    'import/no-self-import': 'error',
    'import/no-useless-path-segments': 'error',

    // Promises
    'promise/always-return': 'off',
    'promise/catch-or-return': 'off',

    // Unicorn — pragmatic subset
    'unicorn/prefer-node-protocol': 'error',
    'unicorn/no-array-for-each': 'off',
    'unicorn/filename-case': ['error', { case: 'kebabCase', ignore: ['README.md'] }],
    'unicorn/prevent-abbreviations': 'off',

    // General
    eqeqeq: ['error', 'smart'],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-param-reassign': ['error', { props: false }],
    'prefer-const': 'error',
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '**/*.e2e-spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
  ],
};
