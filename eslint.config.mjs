import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'libs/prisma-base/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      // Contexts never read process.env directly; config comes from libs/config (§16.1).
      'no-restricted-properties': ['error', { object: 'process', property: 'env', message: 'Read configuration through @lvn-backend/config.' }],
    },
  },
  { files: ['libs/config/**', '**/*.test.ts', 'prisma.config.ts'], rules: { 'no-restricted-properties': 'off' } },
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs', globals: globals.node } },
)
