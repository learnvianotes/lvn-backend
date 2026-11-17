import { ErrorCode, type AppError } from '@lvn-backend/errors'
import { AskAiScope } from '@lvn/contracts/domain'
import { AI_CALLS_PER_HOUR, AI_CALLS_PER_MINUTE, limitAiCalls } from '../../src/application/ai-calls'
import { AskService } from '../../src/application/ask.service'
import { AiTasksService } from '../../src/application/ai-tasks.service'

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

describe('AI call caps', () => {
  it('allows 5 a minute, then refuses, and another person is unaffected', async () => {
    const limiter = countingLimiter()
    for (let i = 0; i < AI_CALLS_PER_MINUTE.max; i++) await limitAiCalls(limiter as never, 'user-a')
    const blocked = await rejection(() => limitAiCalls(limiter as never, 'user-a'))
    expect(blocked).toMatchObject({ code: ErrorCode.RATE_LIMITED })
    expect(blocked.message).toMatch(/Try again in \d+ seconds/)
    expect(blocked.retryAfter).toBeGreaterThan(0)
    await limitAiCalls(limiter as never, 'user-b')
  })

  it('allows 30 an hour across minutes, then refuses that person only', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-17T00:00:00.000Z') })
    try {
      const limiter = countingLimiter()
      for (let burst = 0; burst < AI_CALLS_PER_HOUR.max / AI_CALLS_PER_MINUTE.max; burst++) {
        for (let i = 0; i < AI_CALLS_PER_MINUTE.max; i++) await limitAiCalls(limiter as never, 'user-a')
        jest.advanceTimersByTime(61_000)
      }
      const blocked = await rejection(() => limitAiCalls(limiter as never, 'user-a'))
      expect(blocked).toMatchObject({ code: ErrorCode.RATE_LIMITED })
      expect(blocked.message).toMatch(/this hour/)
      await limitAiCalls(limiter as never, 'user-b')
    } finally {
      jest.useRealTimers()
    }
  })

  it('refuses Ask before the gateway is called', async () => {
    const gateway = { status: jest.fn(), assertDailyRequests: jest.fn(), allowance: jest.fn(), ensureRoutable: jest.fn() }
    const limiter = { hit: async () => ({ allowed: false, retryAfter: 12, remaining: 0 }) }
    const ask = new AskService({} as never, gateway as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, limiter as never)
    const err = await rejection(() => ask.ask('user-a', { question: 'What is a heap?', scope: AskAiScope.PUBLIC }))
    expect(err).toMatchObject({ code: ErrorCode.RATE_LIMITED, retryAfter: 12 })
    expect(gateway.status).not.toHaveBeenCalled()
    expect(gateway.ensureRoutable).not.toHaveBeenCalled()
  })

  it('refuses a task before the gateway is called, after the note is allowed', async () => {
    const gateway = { status: jest.fn(), assertDailyRequests: jest.fn(), allowance: jest.fn(), ensureRoutable: jest.fn() }
    const notes = { source: jest.fn(async () => ({ mayAskAi: true, mayFork: true, mayBulkAi: true, canEdit: true, cards: [{ id: 'c', type: 'TEXT', text: 'Heaps keep the smallest on top.' }], visibility: 'PRIVATE', versionId: 'v', noteId: 'n' })) }
    const limiter = { hit: async (key: string) => ({ allowed: key.startsWith('ai-min:'), retryAfter: 9, remaining: 0 }) }
    const tasks = new AiTasksService({} as never, gateway as never, {} as never, notes as never, {} as never, {} as never, {} as never, {} as never, {} as never, limiter as never)
    const err = await rejection(() => tasks.run('user-a', { noteId: 'n', task: 'SUMMARIZE' }))
    expect(err).toMatchObject({ code: ErrorCode.RATE_LIMITED })
    expect(notes.source).toHaveBeenCalled()
    expect(gateway.status).not.toHaveBeenCalled()
  })
})
