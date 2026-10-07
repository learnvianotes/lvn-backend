/**
 * Tests live in test/unit, test/integration and test/e2e; src/ holds no tests. Integration and e2e tests share one
 * set of Testcontainers (Postgres, Redis, S3, Mailpit) started by test/support/global-setup.ts.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  globalSetup: '<rootDir>/test/support/global-setup.ts',
  globalTeardown: '<rootDir>/test/support/global-teardown.ts',
  testTimeout: 30_000,
}
