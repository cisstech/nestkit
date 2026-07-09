import { FlatCompat } from '@eslint/eslintrc'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import js from '@eslint/js'
import nx from '@nx/eslint-plugin'
import typescriptEslintEslintPlugin from '@typescript-eslint/eslint-plugin'
import eslintPluginPrettier from 'eslint-plugin-prettier'
import typescriptEslintParser from '@typescript-eslint/parser'

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
})

export default [
  js.configs.recommended,
  ...compat.extends(
    'plugin:prettier/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'prettier'
  ),
  ...nx.configs['flat/base'],
  {
    plugins: {
      '@typescript-eslint': typescriptEslintEslintPlugin,
      prettier: eslintPluginPrettier,
    },
  },
  { languageOptions: { parser: typescriptEslintParser } },
  {
    rules: {},
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  ...nx.configs['flat/typescript'],
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-extra-semi': 'off',
    },
  },
  ...nx.configs['flat/javascript'],
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {
      'no-extra-semi': 'off',
    },
  },
  ...compat
    .config({
      env: {
        jest: true,
      },
    })
    .map((config) => ({
      ...config,
      files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx'],
      rules: {
        ...config.rules,
      },
    })),
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/prefer-standalone': 'off',
    },
  },
  {
    ignores: [
      '*',
      '!*/',
      '!**/*.js',
      '!**/*.ts',
      '!**/*.json',
      'dist',
      'umd',
      '.cache',
      'tmp',
      'CODEOWNERS',
      'backups',
    ],
  },
]
