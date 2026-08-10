import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'supabase/functions/**',
    'supabase/.temp/**',
    'src/lib/supabase/database.types.ts',
  ]),

  ...nextVitals,
  ...nextTs,
  // `next/core-web-vitals` already registers the jsx-a11y plugin instance; re-declaring it
  // via `jsxA11y.flatConfigs.recommended` throws a "cannot redefine plugin" error, so only
  // the rule set is added here, reusing the plugin next.js already wired up.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: jsxA11y.flatConfigs.recommended.rules,
  },

  // Type-aware linting for our own source only. See docs/06-CONVENTIONS.md §2.
  {
    files: ['src/**/*.{ts,tsx}', 'e2e/**/*.ts', 'scripts/**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Server Actions and event handlers legitimately return promises to JSX props.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: false, allowNullish: false },
      ],
    },
  },

  // Project invariants. Money must never touch floating point outside the money module,
  // and infrastructure must stay behind its wrapper. See docs/02-DATA-MODEL.md §1.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/money/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'parseFloat',
          message: 'Money is bigint minor units. Use @/lib/money instead of parseFloat.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Number',
          property: 'parseFloat',
          message: 'Money is bigint minor units. Use @/lib/money instead.',
        },
        {
          property: 'toFixed',
          message: 'Money is bigint minor units. Use formatMoney from @/lib/money instead.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/charts/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'recharts',
              message: 'Import chart primitives from @/components/charts instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/supabase/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message: 'Use the clients in @/lib/supabase instead of creating your own.',
            },
            {
              name: '@supabase/ssr',
              message: 'Use the clients in @/lib/supabase instead of creating your own.',
            },
          ],
        },
      ],
    },
  },

  // Tests and config files are allowed to be looser.
  {
    files: ['**/*.test.{ts,tsx}', '**/*.config.{ts,mts,mjs}', 'scripts/**'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Next typed routes: with `.next/types` present, `Route` is a literal union and the cast
  // in `route()` is required for `next build`. Without those generated types (fresh CI lint),
  // ESLint widens `Route` to `string` and flags the cast as unnecessary. Keep the cast for
  // build correctness and silence the rule only in this one helper.
  {
    files: ['src/lib/routes.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },

  prettier,
]);

export default eslintConfig;
