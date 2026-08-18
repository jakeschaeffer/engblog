// ESLint flat config.
//
// Three layers:
//   1. typescript-eslint recommended — for .ts/.tsx and the script blocks
//      inside .astro files.
//   2. eslint-plugin-astro flat/recommended — Astro-specific correctness rules
//      (wires up astro-eslint-parser for .astro files).
//   3. eslint-plugin-astro flat/jsx-a11y-recommended — this is our automated
//      accessibility check for Astro templates. It runs eslint-plugin-jsx-a11y
//      rules against the Astro template AST, so missing alt text, unlabelled
//      controls, bad ARIA and non-interactive click handlers fail `npm run lint`.
//
// Note: `flat/jsx-a11y-recommended` covers .astro templates only. React island
// .tsx files are covered by the explicit jsx-a11y block at the bottom, which
// also turns on eslint-plugin-react-hooks: the Rules of Hooks are not
// enforceable by TypeScript, and an island that calls a hook conditionally
// fails at runtime in the browser, long after `npm run verify` said yes.

import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// `defineConfig` comes from ESLint core; `tseslint.config()` is deprecated in
// typescript-eslint 8.
export default defineConfig(
  globalIgnores(['dist/**', '.astro/**', 'node_modules/**', 'coverage/**', '.vercel/**']),

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Astro templates: parser, Astro rules, and accessibility rules.
  ...astro.configs['flat/recommended'],
  ...astro.configs['flat/jsx-a11y-recommended'],

  // React islands get the same accessibility rules against JSX.
  {
    files: ['**/*.{jsx,tsx}'],
    ...jsxA11y.flatConfigs.recommended,
    languageOptions: {
      ...jsxA11y.flatConfigs.recommended.languageOptions,
      globals: globals.browser,
    },
  },

  // …and the Rules of Hooks, plus the React Compiler's correctness lints
  // (purity, refs-in-render, state-in-render). Islands are the only React in
  // this codebase, so the plugin is scoped to JSX files rather than applied
  // globally.
  {
    files: ['**/*.{jsx,tsx}'],
    ...reactHooks.configs.flat.recommended,
  },

  // One jsx-a11y rule needs widening rather than disabling. A horizontally
  // scrolling container has to be focusable or a keyboard-only reader cannot
  // scroll it (WCAG 2.1.1), and the way to keep that tab stop from announcing
  // as nothing is to name it: `role="region"` with an `aria-labelledby`. The
  // rule already ships a `roles` allowlist for exactly this; `tabpanel` is its
  // default and `region` is the same shape of exception.
  {
    files: ['**/*.{jsx,tsx}'],
    rules: {
      'jsx-a11y/no-noninteractive-tabindex': [
        'error',
        { tags: [], roles: ['tabpanel', 'region'], allowExpressionValues: true },
      ],
    },
  },

  // Node-context files (build config, test config) may use Node globals.
  {
    files: ['*.config.{js,mjs,ts}', 'astro.config.mjs', 'vitest.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Project-wide rule tuning.
  {
    rules: {
      // Allow deliberately unused parameters/vars when prefixed with `_`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // `any` is banned by policy: this codebase is strict TypeScript.
      '@typescript-eslint/no-explicit-any': 'error',
      // Prefer `import type` — matches tsconfig's verbatimModuleSyntax.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);
