import { SupportContact } from '../../src/application/support-contact'
import { STUDY_PUBLISHER_EMAIL } from '../../src/domain/study-publisher'

const FALLBACK = 'support@learnvianotes.in'

function contact(findFirst: jest.Mock) {
  return new SupportContact({ user: { findFirst } } as never, { supportEmail: FALLBACK } as never)
}

describe('SupportContact', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns the earliest platform admin and falls back when none exists', async () => {
    const findFirst = jest.fn(async () => ({ email: 'first@learnvianotes.in' }))
    const service = contact(findFirst)
    expect(await service.email()).toBe('first@learnvianotes.in')
    expect(findFirst).toHaveBeenCalledWith({
      where: { globalRole: 'PLATFORM_ADMIN', deletedAt: null, email: { not: STUDY_PUBLISHER_EMAIL } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { email: true },
    })

    const empty = contact(jest.fn(async () => null))
    expect(await empty.email()).toBe(FALLBACK)
  })

  it('keeps the address for a minute, then reads again', async () => {
    const findFirst = jest.fn()
      .mockResolvedValueOnce({ email: 'first@learnvianotes.in' })
      .mockResolvedValueOnce({ email: 'later@learnvianotes.in' })
    const service = contact(findFirst)
    expect(await service.email()).toBe('first@learnvianotes.in')
    jest.advanceTimersByTime(59_999)
    expect(await service.email()).toBe('first@learnvianotes.in')
    expect(findFirst).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(1)
    expect(await service.email()).toBe('later@learnvianotes.in')
    expect(findFirst).toHaveBeenCalledTimes(2)
  })

  it('does not cache a failed lookup', async () => {
    const findFirst = jest.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce({ email: 'first@learnvianotes.in' })
    const service = contact(findFirst)
    await expect(service.email()).rejects.toThrow('db down')
    expect(await service.email()).toBe('first@learnvianotes.in')
  })
})
