/** Tests live in test/unit, test/integration and test/e2e; src/ holds no tests. */
module.exports = { testEnvironment: 'node', testMatch: ['<rootDir>/test/**/*.test.ts'], transform: { '^.+\\.ts$': 'ts-jest' } }
