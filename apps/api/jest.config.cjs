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
  // Restart a test worker once its heap passes 1 GB after a file. The e2e files each boot the whole API, and one
  // process running all of them in turn ran out of heap in CI (2 vCPUs, so Jest ran in band: ~2 GB after 16 of 75
  // files). Setting this also makes Jest use a worker even when it has only one CPU to spare.
  workerIdleMemoryLimit: '1GB',
}
