import { z } from 'zod'
import type { Entitlements } from '@lvn-backend/facades'
import type { EventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { startFakeOllama, startPostgres, type FakeOllama } from '@lvn-backend/testing'
import type { AiConfig } from '../../src/ai.config'
import { AiGateway } from '../../src/application/ai-gateway'
import { AiKeys } from '../../src/application/ai-keys'
import { AiProviders } from '../../src/application/ai-providers'
import { PromptLibrary } from '../../src/application/prompts'
import type { AiProviderAdapter } from '../../src/domain/provider'
import { OllamaProvider } from '../../src/infrastructure/ollama'

/**
 * The AI gateway (§10.1, ADR-0058) against Postgres and a stand-in Ollama: structured answers checked and repaired,
 * streaming, embeddings, usage rows, the plan's daily quotas, the monthly budget breaker, the circuit breaker,
 * the data-processing flag and the task → model table.
 */
describe('AiGateway', () => {
  let db: PrismaService
  let ollama: FakeOllama
  let stopPg: () => Promise<unknown>
  /** Each person's plan limit for AI_TOKENS_DAILY (ADR-0024); none: no limit. */
  const planned = new Map<string, bigint>()
  const published: { name: string; payload: unknown }[] = []
  const entitlements: Entitlements = { limit: async (userId) => planned.get(userId) ?? null }
  const events = { publish: async (name: string, payload: unknown) => void published.push({ name, payload }), subscribe: () => undefined } as unknown as EventBus
  const config = (over: Partial<AiConfig> = {}): AiConfig => ({ provider: 'ollama', ollama: { url: ollama.url }, chatModel: 'gemma4', embedModel: 'embeddinggemma', timeoutMs: 5_000, monthlyBudgetMicroUsd: null, publicPipeline: true, keysSecret: null, ...over })
  const gateway = (over: Partial<AiConfig> = {}, adapter: AiProviderAdapter | null = new OllamaProvider(ollama.url)) => {
    const c = config(over)
    return new AiGateway(db, new PromptLibrary(), c, new AiProviders(db, c, adapter, new AiKeys(c)), entitlements, events)
  }
  const summary = z.object({ summary: z.string(), concepts: z.array(z.string()).min(1) })
  const ask = (g: AiGateway, userId: string | null = newId()) => g.generate({ task: 'SUMMARIZE', userId, private: true, prompt: 'summarize', vars: { language: 'English', sentences: 2 }, content: { title: 'Heaps', body: 'A heap keeps the smallest item on top.' }, schema: summary })

  beforeAll(async () => {
    const pg = await startPostgres()
    stopPg = () => pg.container.stop()
    db = new PrismaService(pg.url)
    ollama = await startFakeOllama()
  }, 120_000)

  // Stopping the database container takes longer than a hook's default 5 seconds on a busy machine.
  afterAll(async () => {
    await ollama.stop()
    await db.$disconnect()
    await stopPg()
  }, 60_000)

  beforeEach(async () => {
    await db.aiUsage.deleteMany()
    await db.aiModelRoute.deleteMany()
    ollama.chats.length = 0
    ollama.answer = () => JSON.stringify({ summary: 'Heaps keep the smallest on top.', concepts: ['heap'] })
  })

  it('answers in the asked shape, with the prompt fenced, and records the usage', async () => {
    const userId = newId()
    const res = await ask(gateway(), userId)
    expect(res.output).toEqual({ summary: 'Heaps keep the smallest on top.', concepts: ['heap'] })
    const chat = ollama.chats[0]!
    expect(chat.model).toBe('gemma4')
    expect(chat.format).toMatchObject({ type: 'object', required: ['summary', 'concepts'] })
    expect(chat.messages[1]!.content).toContain('<content>\nA heap keeps the smallest item on top.\n</content>')
    const [usage] = await db.aiUsage.findMany({ where: { userId } })
    expect(usage).toMatchObject({ task: 'SUMMARIZE', provider: 'OLLAMA', model: 'gemma4', promptId: 'summarize', promptVersion: 1, ok: true, costMicroUsd: 0 })
    expect(usage!.promptTokens).toBeGreaterThan(0)
    expect(usage!.completionTokens).toBeGreaterThan(0)
  })

  it('asks once more when the answer does not fit, and gives up after that', async () => {
    let n = 0
    ollama.answer = () => (++n === 1 ? '{"summary": 3}' : JSON.stringify({ summary: 'Fixed.', concepts: ['heap'] }))
    expect((await ask(gateway())).output.summary).toBe('Fixed.')
    expect(ollama.chats[1]!.messages.at(-1)!.content).toMatch(/does not match the format: summary/)
    ollama.answer = () => 'not json at all'
    const userId = newId()
    await expect(ask(gateway(), userId)).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    expect(await db.aiUsage.findFirst({ where: { userId } })).toMatchObject({ ok: false })
  })

  it('streams text answers as they come', async () => {
    ollama.answer = () => 'A heap is a tree.'
    const pieces: string[] = []
    const res = await gateway().generate({ task: 'EXPLAIN', userId: null, private: false, prompt: 'summarize', vars: { language: 'English', sentences: 1 }, content: { title: 'Heaps', body: 'x' }, onDelta: (t) => pieces.push(t) })
    expect(res.output).toBe('A heap is a tree.')
    expect(pieces.length).toBeGreaterThan(1)
    expect(pieces.join('')).toBe('A heap is a tree.')
  })

  it('embeds texts with the embedding model', async () => {
    const vectors = await gateway().embed(['heaps', 'heaps and trees'], { userId: null, private: false })
    expect(vectors).toHaveLength(2)
    expect(vectors[0]).toHaveLength(768)
    expect(await db.aiUsage.findFirst({ where: { task: 'EMBED' } })).toMatchObject({ model: 'embeddinggemma', ok: true })
  })

  it('keeps each person to their plan’s daily tokens', async () => {
    const student = newId()
    const teacher = newId()
    planned.set(student, 1_000n)
    planned.set(teacher, 5_000n)
    const g = gateway()
    for (const userId of [student, teacher]) await db.aiUsage.create({ data: { id: newId(), userId, task: 'SUMMARIZE', provider: 'OLLAMA', model: 'gemma4', promptTokens: 900, completionTokens: 100, latencyMs: 1, ok: true } })
    expect(await g.allowance(student)).toMatchObject({ usedToday: 1_000, limitToday: 1_000 })
    await expect(ask(g, student)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    await expect(ask(g, teacher)).resolves.toBeDefined()
    planned.set(student, 2_000n)
    await expect(ask(g, student)).resolves.toBeDefined()
    // No row in the plan: no limit.
    const unlimited = newId()
    expect((await g.allowance(unlimited)).limitToday).toBeNull()
    // Yesterday's tokens do not count.
    await db.aiUsage.create({ data: { id: newId(), userId: unlimited, task: 'SUMMARIZE', provider: 'OLLAMA', model: 'gemma4', promptTokens: 5_000, completionTokens: 0, latencyMs: 1, ok: true, createdAt: new Date(Date.now() - 2 * 86_400_000) } })
    expect((await g.allowance(unlimited)).usedToday).toBe(0)
  })

  it('trips the budget breaker when the month’s spend reaches the cap, and tells the platform at 80 % and 100 %', async () => {
    await db.aiModelRoute.create({ data: { task: 'SUMMARIZE', model: 'gemma4', inputMicroUsdPerMTok: 1_000_000_000, outputMicroUsdPerMTok: 1_000_000_000 } })
    const g = gateway({ monthlyBudgetMicroUsd: 50_000 })
    expect(await g.status()).toEqual({ available: true, reason: null })
    while ((await g.status()).available) await ask(g)
    expect(await g.status()).toEqual({ available: false, reason: 'BUDGET' })
    await expect(ask(g)).rejects.toMatchObject({ code: 'UNAVAILABLE', message: expect.stringMatching(/budget/) })
    expect(published.filter((e) => e.name === 'AiBudgetThreshold').map((e) => (e.payload as { percentUsed: number }).percentUsed >= 80)).toEqual([true, true])
    // A new month starts from nothing: last month's spend does not count.
    await db.aiUsage.updateMany({ data: { createdAt: new Date(Date.now() - 40 * 86_400_000) } })
    expect(await gateway({ monthlyBudgetMicroUsd: 50_000 }).status()).toEqual({ available: true, reason: null })
  })

  it('opens the circuit after three failed calls in a row, and closes it after 30 s', async () => {
    ollama.answer = () => ({ status: 500, body: 'overloaded' })
    const g = gateway()
    for (let i = 0; i < 3; i++) await expect(ask(g)).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    // Each failed call was tried three times (two retries).
    expect(ollama.chats).toHaveLength(9)
    expect(await g.status()).toEqual({ available: false, reason: 'PROVIDER_DOWN' })
    ollama.answer = () => JSON.stringify({ summary: 'Back.', concepts: ['heap'] })
    const now = Date.now()
    const later = jest.spyOn(Date, 'now').mockReturnValue(now + 31_000)
    try {
      expect((await ask(g)).output.summary).toBe('Back.')
    } finally {
      later.mockRestore()
    }
  }, 30_000)

  it('says AI is off when nothing is configured, and keeps private notes from providers that may not see them', async () => {
    const off = gateway({ provider: 'none' }, null)
    expect(await off.status()).toEqual({ available: false, reason: 'NOT_CONFIGURED' })
    await expect(ask(off)).rejects.toMatchObject({ code: 'UNAVAILABLE', message: 'AI is not switched on here.' })
    const external: AiProviderAdapter = { name: 'OLLAMA', mayReceivePrivate: false, chat: async () => ({ text: '{}', promptTokens: 1, completionTokens: 1 }), embed: async () => ({ vectors: [], promptTokens: 0 }) }
    await expect(ask(gateway({}, external))).rejects.toMatchObject({ message: 'AI cannot work on private notes here.' })
  })

  it('takes the model from the task’s row when there is one', async () => {
    await db.aiModelRoute.create({ data: { task: 'SUMMARIZE', model: 'gemma4:27b' } })
    await ask(gateway())
    expect(ollama.chats.at(-1)!.model).toBe('gemma4:27b')
  })
})
