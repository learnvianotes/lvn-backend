/** Tests live in test/unit and test/integration; integration tests start their own containers. */
module.exports = { testEnvironment: 'node', testMatch: ['<rootDir>/test/**/*.test.ts'], transform: { '^.+\\.ts$': 'ts-jest' }, testTimeout: 120_000 }
