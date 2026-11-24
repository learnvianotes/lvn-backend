/** Unit tests always run. The EICAR integration test starts ClamAV when Docker answers. */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  testTimeout: 30_000,
}
