import { SupportContact } from '../../src/application/support-contact'

const SUPPORT = 'support@learnvianotes.in'

describe('SupportContact', () => {
  it('returns SUPPORT_EMAIL and not a platform admin inbox', async () => {
    const service = new SupportContact({ supportEmail: SUPPORT } as never)
    expect(await service.email()).toBe(SUPPORT)
  })
})
