import { z } from 'zod'
import type { Entitlements } from '@lvn-backend/facades'
import type { EventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { startFakeAnthropic, startFakeOllama, startFakeOpenAi, startPostgres, type FakeOllama, type FakeProvider } from '@lvn-backend/testing'
import type { AiConfig } from '../../src/ai.config'
import { AiGateway } from '../../src/application/ai-gateway'
import { AiKeys } from '../../src/application/ai-keys'
import { AiProviders } from '../../src/application/ai-providers'
import { PromptLibrary } from '../../src/application/prompts'
import { OllamaProvider } from '../../src/infrastructure/ollama'

/**
 * Providers platform admins choose (ADR-0065), against Postgres and stand-ins for OpenAI's API (as OpenAI, Gemini and a
 * LiteLLM proxy speak it), Anthropic's and Ollama's: who answers (route, default connection, environment), structured
 * answers and streaming in each dialect, pictures and recordings, embeddings of 768 numbers, prices, the
 * data-processing flag, a circuit per connection, and keys that cannot be read.
 */
describe('AI providers', () => {
  let db: PrismaService
  let stopPg: () => Promise<unknown>
  let openai: FakeProvider
  let claude: FakeProvider
  let ollama: FakeOllama
  const SECRET = 'a-test-secret-for-ai-keys-0123456789abcdef'
  const entitlements: Entitlements = { limit: async () => null }
  const events = { publish: async () => undefined, subscribe: () => undefined } as unknown as EventBus
  const config = (over: Partial<AiConfig> = {}): AiConfig => ({ provider: 'ollama', ollama: { url: ollama.url }, chatModel: 'gemma4', embedModel: 'embeddinggemma', timeoutMs: 5_000, monthlyBudgetMicroUsd: null, publicPipeline: true, keysSecret: SECRET, ...over })
  const gateway = (over: Partial<AiConfig> = {}) => {
    const c = config(over)
    return new AiGateway(db, new PromptLibrary(), c, new AiProviders(db, c, c.provider === 'ollama' ? new OllamaProvider(ollama.url) : null, new AiKeys(c)), entitlements, events)
  }
  const keys = new AiKeys({ keysSecret: SECRET } as AiConfig)
  const connect = async (data: { kind: 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'OPENAI_COMPATIBLE' | 'OLLAMA'; baseUrl: string; key?: string; chatModel?: string; embedModel?: string; mayReceivePrivate?: boolean; enabled?: boolean; inputMicroUsdPerMTok?: number; outputMicroUsdPerMTok?: number }) => {
    const { key, ...rest } = data
    const row = await db.aiConnection.create({ data: { id: newId(), label: data.kind, ...rest, ...(key ? { apiKeyCipher: keys.seal(key), apiKeyHint: key.slice(-4) } : {}) } })
    return row.id
  }
  const defaults = (chat: string | null, embed: string | null = null) => db.aiSettings.upsert({ where: { id: 1 }, create: { id: 1, chatConnectionId: chat, embedConnectionId: embed }, update: { chatConnectionId: chat, embedConnectionId: embed } })
  const summary = z.object({ summary: z.string(), concepts: z.array(z.string()).min(1) })
  const SUMMARY = JSON.stringify({ summary: 'Heaps keep the smallest on top.', concepts: ['heap'] })
  const ask = (g: AiGateway, over: { task?: string; private?: boolean; images?: string[] } = {}) =>
    g.generate({ task: over.task ?? 'SUMMARIZE', userId: newId(), private: over.private ?? false, prompt: 'summarize', vars: { language: 'English', sentences: 2 }, content: { title: 'Heaps', body: 'A heap keeps the smallest item on top.' }, schema: summary, images: over.images })
  // The first bytes of a PNG and of a WAV recording, as base64.
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt '), Buffer.alloc(24)]).toString('base64')

  beforeAll(async () => {
    const pg = await startPostgres()
    stopPg = () => pg.container.stop()
    db = new PrismaService(pg.url)
    ;[openai, claude, ollama] = await Promise.all([startFakeOpenAi(), startFakeAnthropic(), startFakeOllama()])
  }, 120_000)

  afterAll(async () => {
    await Promise.all([openai.stop(), claude.stop(), ollama.stop()])
    await db.$disconnect()
    await stopPg()
  }, 60_000)

  beforeEach(async () => {
    await db.aiUsage.deleteMany()
    await db.aiModelRoute.deleteMany()
    await db.aiSettings.deleteMany()
    await db.aiConnection.deleteMany()
    for (const fake of [openai, claude]) {
      fake.requests.length = 0
      fake.answer = () => SUMMARY
      fake.refuseTemperature = false
      fake.refuseDimensions = false
      fake.nativeDimensions = 768
    }
    ollama.chats.length = 0
    ollama.answer = () => SUMMARY
  })

  it('answers with ChatGPT when it is the default: its key, a JSON-schema answer, its prices in the usage row', async () => {
    const id = await connect({ kind: 'OPENAI', baseUrl: openai.url, key: 'sk-test-1234', chatModel: 'gpt-test', inputMicroUsdPerMTok: 1_000_000, outputMicroUsdPerMTok: 2_000_000 })
    await defaults(id)
    const res = await ask(gateway())
    expect(res).toMatchObject({ output: { summary: 'Heaps keep the smallest on top.' }, model: 'gpt-test' })
    const req = openai.requests.find((r) => r.path === '/v1/chat/completions')!
    expect(req.headers.authorization).toBe('Bearer sk-test-1234')
    expect(req.body.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'answer', schema: { type: 'object', required: ['summary', 'concepts'] } } })
    expect(ollama.chats).toHaveLength(0)
    const [usage] = await db.aiUsage.findMany()
    expect(usage).toMatchObject({ provider: 'OPENAI', connectionId: id, model: 'gpt-test', ok: true })
    expect(usage!.costMicroUsd).toBe(Math.round((usage!.promptTokens * 1_000_000 + usage!.completionTokens * 2_000_000) / 1_000_000))
  })

  it('streams text answers in OpenAI’s dialect, with the token counts of its last chunk', async () => {
    await defaults(await connect({ kind: 'OPENAI_COMPATIBLE', baseUrl: openai.url, chatModel: 'litellm-model' }))
    openai.answer = () => 'A heap is a tree.'
    const pieces: string[] = []
    const res = await gateway().generate({ task: 'EXPLAIN', userId: null, private: false, prompt: 'summarize', vars: { language: 'English', sentences: 1 }, content: { title: 'Heaps', body: 'x' }, onDelta: (t) => pieces.push(t) })
    expect(res.output).toBe('A heap is a tree.')
    expect(pieces.length).toBeGreaterThan(1)
    expect(res.completionTokens).toBe(5)
    // A LiteLLM proxy with no key: no Authorization header.
    expect(openai.requests[0]!.headers.authorization).toBeUndefined()
  })

  it('asks again without temperature when the model refuses it', async () => {
    await defaults(await connect({ kind: 'OPENAI', baseUrl: openai.url, key: 'sk-test-1234', chatModel: 'gpt-test' }))
    openai.refuseTemperature = true
    await gateway().generate({ task: 'SUMMARIZE', userId: null, private: false, prompt: 'summarize', vars: { language: 'English', sentences: 2 }, content: { title: 'Heaps', body: 'x' }, schema: summary, temperature: 0 })
    expect(openai.requests.map((r) => r.body.temperature)).toEqual([0, undefined])
  })

  it('answers with Claude: the answer is a forced tool call, pictures are image blocks, recordings are refused in words', async () => {
    await defaults(await connect({ kind: 'ANTHROPIC', baseUrl: claude.url, key: 'sk-ant-test', chatModel: 'claude-test' }))
    const res = await ask(gateway(), { images: [PNG] })
    expect(res.output.concepts).toEqual(['heap'])
    const req = claude.requests[0]!
    expect(req.headers['x-api-key']).toBe('sk-ant-test')
    expect(req.headers['anthropic-version']).toBe('2023-06-01')
    expect(req.body).toMatchObject({ model: 'claude-test', tool_choice: { type: 'tool', name: 'answer' }, tools: [{ name: 'answer', input_schema: { type: 'object' } }] })
    expect(typeof req.body.system).toBe('string')
    const content = (req.body.messages as { content: { type: string; source?: { media_type: string } }[] }[])[0]!.content
    expect(content.map((b) => b.type)).toEqual(['text', 'image'])
    expect(content[1]!.source!.media_type).toBe('image/png')
    await expect(ask(gateway(), { task: 'TRANSCRIBE', images: [WAV] })).rejects.toMatchObject({ code: 'UNAVAILABLE', message: 'The AI chosen here cannot hear recordings.' })
    // Not the provider's failure: its circuit stays closed.
    for (let i = 0; i < 3; i++) await ask(gateway(), { images: [WAV] }).catch(() => undefined)
    expect(await gateway().status()).toEqual({ available: true, reason: null })
  })

  it('streams Claude’s text answers from its events', async () => {
    await defaults(await connect({ kind: 'ANTHROPIC', baseUrl: claude.url, key: 'sk-ant-test', chatModel: 'claude-test' }))
    claude.answer = () => 'A heap is a tree.'
    const pieces: string[] = []
    const res = await gateway().generate({ task: 'EXPLAIN', userId: null, private: false, prompt: 'summarize', vars: { language: 'English', sentences: 1 }, content: { title: 'Heaps', body: 'x' }, onDelta: (t) => pieces.push(t) })
    expect(pieces.join('')).toBe('A heap is a tree.')
    expect(res).toMatchObject({ output: 'A heap is a tree.', completionTokens: 5 })
    expect(res.promptTokens).toBeGreaterThan(0)
  })

  it('sends each task where its route says: transcription to Gemini, the rest to Claude', async () => {
    const gemini = await connect({ kind: 'GEMINI', baseUrl: openai.url, key: 'AIza-test', chatModel: 'gemini-test' })
    await defaults(await connect({ kind: 'ANTHROPIC', baseUrl: claude.url, key: 'sk-ant-test', chatModel: 'claude-test' }))
    await db.aiModelRoute.create({ data: { task: 'TRANSCRIBE', connectionId: gemini, model: 'gemini-audio' } })
    await ask(gateway(), { task: 'TRANSCRIBE', images: [WAV] })
    await ask(gateway())
    const heard = openai.requests[0]!
    expect(heard.body.model).toBe('gemini-audio')
    const parts = (heard.body.messages as { content: unknown }[]).at(-1)!.content as { type: string; input_audio?: { format: string } }[]
    expect(parts.map((p) => p.type)).toEqual(['text', 'input_audio'])
    expect(parts[1]!.input_audio!.format).toBe('wav')
    expect(claude.requests).toHaveLength(1)
    expect((await db.aiUsage.findMany({ orderBy: { createdAt: 'asc' } })).map((u) => [u.task, u.provider])).toEqual([['TRANSCRIBE', 'GEMINI'], ['SUMMARIZE', 'ANTHROPIC']])
  })

  it('makes embeddings of 768 numbers of length 1, asks again without `dimensions` when refused, and refuses another size', async () => {
    const chat = await connect({ kind: 'ANTHROPIC', baseUrl: claude.url, key: 'sk-ant-test', chatModel: 'claude-test' })
    const embed = await connect({ kind: 'OPENAI', baseUrl: openai.url, key: 'sk-test-1234', embedModel: 'text-embedding-test' })
    await defaults(chat, embed)
    const g = gateway()
    expect(await g.embedModel()).toBe('text-embedding-test')
    const [a, b] = await g.embed(['heaps', 'trees'], { userId: null, private: false })
    expect(a).toHaveLength(768)
    expect(Math.hypot(...a!)).toBeCloseTo(1, 6)
    // In order, though the provider answered them reversed.
    expect(a).not.toEqual(b)
    expect(openai.requests[0]!.body.dimensions).toBe(768)
    openai.refuseDimensions = true
    await g.embed(['heaps'], { userId: null, private: false })
    openai.nativeDimensions = 3072
    await expect(g.embed(['heaps'], { userId: null, private: false })).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    // With no embedding connection, the environment's Ollama makes them, whatever answers chats.
    await defaults(chat, null)
    expect(await gateway().embedModel()).toBe('embeddinggemma')
  })

  it('keeps private notes from a connection that may not receive them', async () => {
    await defaults(await connect({ kind: 'OPENAI', baseUrl: openai.url, key: 'sk-test-1234', chatModel: 'gpt-test', mayReceivePrivate: false }))
    await expect(ask(gateway(), { private: true })).rejects.toMatchObject({ message: 'AI cannot work on private notes here.' })
    expect(openai.requests).toHaveLength(0)
    await expect(ask(gateway(), { private: false })).resolves.toBeDefined()
  })

  it('opens the circuit of the failing connection only', async () => {
    const chat = await connect({ kind: 'OPENAI', baseUrl: openai.url, key: 'sk-test-1234', chatModel: 'gpt-test' })
    const claudeId = await connect({ kind: 'ANTHROPIC', baseUrl: claude.url, key: 'sk-ant-test', chatModel: 'claude-test' })
    await defaults(chat)
    await db.aiModelRoute.create({ data: { task: 'QUIZ', connectionId: claudeId, model: 'claude-test' } })
    openai.answer = () => ({ status: 500, body: 'overloaded' })
    const g = gateway()
    for (let i = 0; i < 3; i++) await expect(ask(g)).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    expect(await g.status()).toEqual({ available: false, reason: 'PROVIDER_DOWN' })
    await expect(ask(g, { task: 'QUIZ' })).resolves.toBeDefined()
  }, 30_000)

  it('falls back to the environment’s provider when the chosen connection is off or its key cannot be read', async () => {
    const id = await connect({ kind: 'OPENAI', baseUrl: openai.url, key: 'sk-test-1234', chatModel: 'gpt-test', enabled: false })
    await defaults(id)
    expect((await ask(gateway())).model).toBe('gemma4')
    await db.aiConnection.update({ where: { id }, data: { enabled: true } })
    // Another secret: the saved key cannot be read, so the connection answers nothing.
    expect((await ask(gateway({ keysSecret: 'another-secret-for-ai-keys-0123456789abc' }))).model).toBe('gemma4')
    expect((await ask(gateway())).model).toBe('gpt-test')
    // Without an environment provider either, AI is off.
    await db.aiConnection.update({ where: { id }, data: { enabled: false } })
    expect(await gateway({ provider: 'none', ollama: null }).status()).toEqual({ available: false, reason: 'NOT_CONFIGURED' })
  })

  it('a change made elsewhere reaches a running process on its next call', async () => {
    // One gateway kept across calls, as in the worker; the change is made as another process would make it.
    const worker = gateway()
    expect((await ask(worker)).model).toBe('gemma4')
    const id = await connect({ kind: 'OPENAI_COMPATIBLE', baseUrl: openai.url, chatModel: 'litellm-model' })
    await db.aiSettings.upsert({ where: { id: 1 }, create: { id: 1, chatConnectionId: id, version: 1 }, update: { chatConnectionId: id, version: { increment: 1 } } })
    expect((await ask(worker)).model).toBe('litellm-model')
  })

  it('stores keys sealed: the database never holds the key', async () => {
    const id = await connect({ kind: 'OPENAI', baseUrl: openai.url, key: 'sk-secret-value-9876', chatModel: 'gpt-test' })
    const row = await db.aiConnection.findUniqueOrThrow({ where: { id } })
    expect(row.apiKeyCipher).not.toContain('sk-secret')
    expect(row.apiKeyHint).toBe('9876')
    expect(keys.open(row.apiKeyCipher!)).toBe('sk-secret-value-9876')
    expect(new AiKeys({ keysSecret: 'another-secret-for-ai-keys-0123456789abc' } as AiConfig).open(row.apiKeyCipher!)).toBeNull()
  })
})
