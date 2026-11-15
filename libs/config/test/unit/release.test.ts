import { appVersion, formatRunningRelease, runningRelease, shortSha } from '../../src/release'

const FULL = 'd9d27b2d71f0ab684a05d8062ba8147beb9ae62f'

describe('running release', () => {
  it('reads the root package version', () => {
    expect(appVersion()).toBe('0.6.0')
  })

  it('builds vX.Y.Z plus a 12-character SHA, and uses dev when RELEASE is unset', () => {
    expect(formatRunningRelease('0.5.0', undefined)).toBe('v0.5.0+dev')
    expect(formatRunningRelease('v0.5.0', 'dev')).toBe('v0.5.0+dev')
    expect(formatRunningRelease('0.5.0', `  ${FULL.slice(0, 12)}  `)).toBe('v0.5.0+d9d27b2d71f0')
    expect(formatRunningRelease('0.5.0', FULL.toUpperCase())).toBe('v0.5.0+d9d27b2d71f0')
    expect(shortSha('d9d27b2')).toBe('d9d27b2')
    expect(formatRunningRelease('0.5.0', 'test-sha-1234')).toBe('v0.5.0+test-sha-1234')
  })

  it('reads RELEASE from the environment', () => {
    expect(runningRelease({ RELEASE: FULL })).toBe('v0.6.0+d9d27b2d71f0')
    expect(runningRelease({})).toBe('v0.6.0+dev')
  })
})
