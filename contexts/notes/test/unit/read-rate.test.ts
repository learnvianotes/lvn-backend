import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { ANONYMOUS_NOTE_READS_PER_MINUTE, NotesService } from '../../src/application/notes.service'
import { limitSearch, SEARCH_PER_MINUTE, SearchService } from '../../src/application/search.service'

function rejection(run: () => Promise<unknown>): Promise<AppError> {
  return run().then(
    () => Promise.reject(new Error('expected a rejection')),
    (error: AppError) => error,
  )
}

function countingLimiter() {
  const hits = new Map<string, number[]>()
  return {
    async hit(key: string, limit: { max: number; windowSeconds: number }, now = Date.now()) {
      const windowMs = limit.windowSeconds * 1000
      const prev = (hits.get(key) ?? []).filter((at) => now - at < windowMs)
      if (prev.length >= limit.max) {
        const oldest = Math.min(...prev)
        hits.set(key, prev)
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)), remaining: 0 }
      }
      prev.push(now)
      hits.set(key, prev)
      return { allowed: true, retryAfter: 0, remaining: limit.max - prev.length }
    },
  }
}

describe('search and public note read caps', () => {
  it('allows 60 searches a minute for a person, then refuses, and an anonymous network is a different key', async () => {
    const limiter = countingLimiter()
    for (let i = 0; i < SEARCH_PER_MINUTE.max; i++) await limitSearch(limiter as never, 'viewer-1', '203.0.113.1')
    const blocked = await rejection(() => limitSearch(limiter as never, 'viewer-1', '203.0.113.1'))
    expect(blocked).toMatchObject({ code: ErrorCode.RATE_LIMITED })
    expect(blocked.message).toMatch(/Try again in \d+ seconds/)
    await limitSearch(limiter as never, 'viewer-2', '203.0.113.1')
    for (let i = 0; i < SEARCH_PER_MINUTE.max; i++) await limitSearch(limiter as never, null, '203.0.113.9')
    const anon = await rejection(() => limitSearch(limiter as never, null, '203.0.113.9'))
    expect(anon.code).toBe(ErrorCode.RATE_LIMITED)
    await limitSearch(limiter as never, null, '198.51.100.9')
    await expect(limitSearch(limiter as never, null, null)).resolves.toBeUndefined()
  })

  it('refuses a search before the providers run', async () => {
    const postgres = { name: 'postgres', search: jest.fn() }
    const search = new SearchService({} as never, postgres as never, { name: 'typesense' } as never, { search: { provider: 'postgres' } } as never, {} as never, {} as never, {} as never, null, {} as never, {
      hit: async () => ({ allowed: false, retryAfter: 5, remaining: 0 }),
    } as never)
    const err = await rejection(() => search.search('viewer-1', 'heaps', null, null, null, null, '203.0.113.1'))
    expect(err).toMatchObject({ code: ErrorCode.RATE_LIMITED, retryAfter: 5 })
    expect(postgres.search).not.toHaveBeenCalled()
  })

  it('allows 120 anonymous public-note reads from one network, then refuses, and another network still reads', async () => {
    const limiter = countingLimiter()
    const notes = new NotesService({} as never, {} as never, limiter as never, {} as never, {} as never, {} as never, {} as never)
    for (let i = 0; i < ANONYMOUS_NOTE_READS_PER_MINUTE.max; i++) await notes.limitAnonymousPublicRead('203.0.113.12')
    const blocked = await rejection(() => notes.limitAnonymousPublicRead('203.0.113.12'))
    expect(blocked).toMatchObject({ code: ErrorCode.RATE_LIMITED })
    expect(blocked.message).toMatch(/note reads from your network/)
    await notes.limitAnonymousPublicRead('198.51.100.12')
    await expect(notes.limitAnonymousPublicRead(null)).resolves.toBeUndefined()
  })
})
