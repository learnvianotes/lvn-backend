/** Tests live in test/unit and test/integration; src/ holds no tests. */
module.exports = { testEnvironment: 'node', testMatch: ['<rootDir>/test/**/*.test.ts?(x)'], transform: { '^.+\\.tsx?$': 'ts-jest' }, testTimeout: 60_000 }
