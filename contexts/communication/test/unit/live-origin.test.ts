import { liveUpgradeAllowed } from '../../src/live/live-server'

const ALLOWED = ['https://app.learnvianotes.in']

describe('live upgrade origin', () => {
  it('allows a native client with no Origin and an origin on the allow-list', () => {
    expect(liveUpgradeAllowed(undefined, ALLOWED)).toBe(true)
    expect(liveUpgradeAllowed('', ALLOWED)).toBe(true)
    expect(liveUpgradeAllowed('https://app.learnvianotes.in', ALLOWED)).toBe(true)
    expect(liveUpgradeAllowed(['https://app.learnvianotes.in'], ALLOWED)).toBe(true)
  })

  it('refuses a browser origin that is not on the allow-list', () => {
    expect(liveUpgradeAllowed('https://evil.example', ALLOWED)).toBe(false)
    expect(liveUpgradeAllowed('https://www.learnvianotes.in', ALLOWED)).toBe(false)
    expect(liveUpgradeAllowed(['https://app.learnvianotes.in', 'https://evil.example'], ALLOWED)).toBe(false)
  })
})
