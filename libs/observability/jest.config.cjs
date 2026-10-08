/** Unit tests only; the API's e2e suite covers the HTTP wiring. */
module.exports = { testEnvironment: 'node', testMatch: ['<rootDir>/test/**/*.test.ts'], transform: { '^.+\\.ts$': 'ts-jest' } }
