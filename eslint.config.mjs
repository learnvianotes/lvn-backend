import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'libs/prisma-base/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      // Nest injects constructor parameters by their runtime class (decorator metadata), so type-only imports of
      // injected classes would break DI; telling the parser lets consistent-type-imports leave them alone.
      parserOptions: { emitDecoratorMetadata: true, experimentalDecorators: true },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      // Contexts never read process.env directly; config comes from libs/config (§16.1).
      'no-restricted-properties': ['error', { object: 'process', property: 'env', message: 'Read configuration through @lvn-backend/config.' }],
    },
  },
  // Config loading, test tooling and scripts are where the environment is read.
  { files: ['libs/config/**', 'libs/testing/**', '**/test/**', 'prisma.config.ts', 'apps/scanner/**'], rules: { 'no-restricted-properties': 'off' } },
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs', globals: globals.node } },
)
