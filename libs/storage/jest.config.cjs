/** Tests live in test/; integration tests start a Redis container (Testcontainers). */
module.exports = { testEnvironment: 'node', testMatch: ['<rootDir>/test/**/*.test.ts'], transform: { '^.+\\.ts$': 'ts-jest' }, testTimeout: 60_000 }
