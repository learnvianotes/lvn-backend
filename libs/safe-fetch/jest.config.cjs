/** Tests live in test/; they start local HTTP servers, never reach the internet. */
module.exports = { testEnvironment: 'node', testMatch: ['<rootDir>/test/**/*.test.ts'], transform: { '^.+\\.ts$': 'ts-jest' }, testTimeout: 20_000 }
