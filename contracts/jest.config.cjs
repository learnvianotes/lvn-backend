/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', moduleResolution: 'node10', isolatedModules: true } }] },
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/domain/index.ts'],
  // Spec §17: 80 % lines on contracts/; the permission evaluator is held to 100 % branches.
  coverageThreshold: {
    global: { lines: 80 },
    './src/domain/permissions.ts': { branches: 100, lines: 100 },
  },
}
