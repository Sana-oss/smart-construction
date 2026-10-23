import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

const L1 = ['identity', 'projects'];
const L2 = ['finance', 'materials', 'quality', 'documents', 'knowledge'];
const L3 = ['decisions', 'trades', 'dashboard', 'notifications'];
const ALL_MODULES = [...L1, ...L2, ...L3];
const BASE = ['shared-kernel', 'platform'];

// Architecture rule R2: a module depends only on lower levels, never sideways or upward.
// Sideways communication between L2 modules goes through events (outbox), not imports.
const policy = (from, allowed) => ({
  from: { element: { type: from } },
  allow: { to: { element: { types: { anyOf: allowed } } } },
});

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app' },
        { type: 'platform', pattern: 'src/platform' },
        { type: 'shared-kernel', pattern: 'src/shared-kernel' },
        ...ALL_MODULES.map((m) => ({ type: m, pattern: `src/modules/${m}` })),
      ],
    },
    rules: {
      'boundaries/dependencies': ['error', {
        default: 'disallow',
        policies: [
          policy('app', [...ALL_MODULES, ...BASE]),
          policy('platform', ['shared-kernel']),
          ...L1.map((m) => policy(m, BASE)),
          ...L2.map((m) => policy(m, [...L1, ...BASE])),
          ...L3.map((m) => policy(m, [...L1, ...L2, ...BASE])),
        ],
      }],
      // Cross-module imports must go through the module's public API: "@/modules/<name>".
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/modules/*/*'],
          message: 'Import from the module public API ("@/modules/<name>"), not from its internals (rule R1).',
        }],
      }],
    },
  },
  {
    // Domain code is pure: no framework, database, or infrastructure imports (rule R4).
    files: ['src/modules/*/domain/**/*.ts', 'src/shared-kernel/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@supabase/*', 'next', 'next/*', 'react', 'react-dom'], message: 'Domain code must stay pure (rule R4).' },
          { group: ['**/infra/**', '**/application/**', '@/platform', '@/platform/*'], message: 'Domain must not depend on infra, application, or platform (rule R4).' },
          { group: ['@/modules/*/*'], message: 'Use the module public API only (rule R1).' },
        ],
      }],
    },
  },
);
