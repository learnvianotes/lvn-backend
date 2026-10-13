import { PrismaService } from '@lvn-backend/prisma-base'
import { startFakeAnthropic, startFakeOllama, startFakeOpenAi, type FakeOllama, type FakeProvider } from '@lvn-backend/testing'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * The AI providers page through the API (ADR-0065): only platform admins see and change it; keys go in and never come
 * out (nor into the audit log); a connection test asks the provider; the defaults decide who answers; routes refuse a
 * provider that cannot do the task; deleting a connection hands its work back to the defaults.
 */
describe('AI provider settings', () => {
  let app: TestApp
  let keyless: TestApp
  let ollama: FakeOllama
  let claude: FakeProvider
  let openai: FakeProvider
  let admin: string
  let student: string
  const SECRET = 'e2e-secret-for-the-ai-keys-0123456789abcdef'
  const ERRORS = 'userErrors { field message code }'
  const CONNECTION = 'id kind label baseUrl hasKey keyHint mayReceivePrivate enabled chatModel embedModel inputMicroUsdPerMTok outputMicroUsdPerMTok'
  const SETTINGS = `connections { ${CONNECTION} } chatConnectionId embedConnectionId environment { kind chatModel embedModel } routes { task connectionId model } tasks presets { kind name defaultBaseUrl needsKey canEmbed canHear } keysCanBeSaved spentThisMonthMicroUsd monthlyBudgetMicroUsd`
  type Connection = { id: string; hasKey: boolean; keyHint: string | null; label: string }
  type Settings = { connections: Connection[]; chatConnectionId: string | null; embedConnectionId: string | null; routes: { task: string; connectionId: string | null; model: string }[]; keysCanBeSaved: boolean; tasks: string[] }

  const save = (a: TestApp, token: string, input: object) => a.gql<{ saveAiConnection: { connection: Connection | null; userErrors: { message: string; code: string; field: string[] }[] } }>(`mutation ($input: SaveAiConnectionInput!) { saveAiConnection(input: $input) { connection { ${CONNECTION} } ${ERRORS} } }`, { input }, token)
  const settings = (a: TestApp, token: string) => a.gql<{ aiSettings: Settings }>(`{ aiSettings { ${SETTINGS} } }`, {}, token)
  const mutate = async (name: string, inputType: string, input: object) => (await app.gql<Record<string, { settings: Settings | null; userErrors: { message: string; code: string }[] }>>(`mutation ($input: ${inputType}!) { ${name}(input: $input) { settings { ${SETTINGS} } ${ERRORS} } }`, { input }, admin)).data![name]!

  beforeAll(async () => {
    ;[ollama, claude, openai] = await Promise.all([startFakeOllama(), startFakeAnthropic(), startFakeOpenAi()])
    const ai = { AI_PROVIDER: 'ollama', OLLAMA_URL: ollama.url, AI_CHAT_MODEL: 'gemma4', AI_EMBED_MODEL: 'embeddinggemma' }
    app = await createTestApp({ ...ai, AI_KEYS_SECRET: SECRET })
    keyless = await createTestApp(ai, { resetDatabase: false })
    const a = await seedUser(app.app, { verified: true, globalRole: 'PLATFORM_ADMIN' })
    const s = await seedUser(app.app, { verified: true })
    admin = tokenFor(app.config, a.id, undefined, ['PLATFORM_ADMIN'])
    student = tokenFor(app.config, s.id)
  }, 90_000)

  afterAll(async () => {
    await keyless?.close()
    await app?.close()
    await Promise.all([ollama?.stop(), claude?.stop(), openai?.stop()])
  })

  it('is for platform admins only', async () => {
    expect((await settings(app, student)).errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    expect((await app.gql(`{ aiSettings { keysCanBeSaved } }`)).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
    const res = await save(app, student, { kind: 'OPENAI_COMPATIBLE', label: 'Mine', baseUrl: openai.url, mayReceivePrivate: true, enabled: true, chatModel: 'x' })
    expect(res.errors?.[0]?.extensions.code).toBe('FORBIDDEN')
    const shown = (await settings(app, admin)).data!.aiSettings
    expect(shown).toMatchObject({ connections: [], chatConnectionId: null, keysCanBeSaved: true, environment: { kind: 'OLLAMA', chatModel: 'gemma4', embedModel: 'embeddinggemma' } })
    expect(shown.tasks).toEqual(expect.arrayContaining(['SUMMARIZE', 'TRANSCRIBE', 'ASK', 'READ_PAGE', 'EMBED']))
  })

  it('takes a key and never gives it back: only whether there is one and its last four characters', async () => {
    const missing = await save(app, admin, { kind: 'ANTHROPIC', label: 'Claude', mayReceivePrivate: false, enabled: true, chatModel: 'claude-test' })
    expect(missing.data!.saveAiConnection.userErrors[0]).toMatchObject({ code: 'VALIDATION', field: ['input', 'apiKey'] })
    const res = await save(app, admin, { kind: 'ANTHROPIC', label: 'Claude', baseUrl: claude.url, apiKey: 'sk-ant-very-secret-7777', mayReceivePrivate: false, enabled: true, chatModel: 'claude-test' })
    const connection = res.data!.saveAiConnection.connection!
    expect(connection).toMatchObject({ hasKey: true, keyHint: '7777', label: 'Claude' })
    expect(JSON.stringify(res)).not.toContain('very-secret')
    expect(JSON.stringify((await settings(app, admin)).data)).not.toContain('very-secret')
    // Saved again without a key: the key stays.
    const renamed = await save(app, admin, { id: connection.id, kind: 'ANTHROPIC', label: 'Claude Sonnet', baseUrl: claude.url, mayReceivePrivate: false, enabled: true, chatModel: 'claude-test' })
    expect(renamed.data!.saveAiConnection.connection).toMatchObject({ label: 'Claude Sonnet', hasKey: true, keyHint: '7777' })
    const db = app.app.get(PrismaService)
    expect((await db.aiConnection.findUniqueOrThrow({ where: { id: connection.id } })).apiKeyCipher).not.toContain('very-secret')
    const audit = await db.auditLog.findMany({ where: { targetId: connection.id } })
    expect(audit.map((a) => a.action)).toEqual(['ai.connection.saved', 'ai.connection.saved'])
    expect(JSON.stringify(audit)).not.toContain('very-secret')
    // Claude makes no embeddings.
    const embed = await save(app, admin, { id: connection.id, kind: 'ANTHROPIC', label: 'Claude', baseUrl: claude.url, mayReceivePrivate: false, enabled: true, chatModel: 'claude-test', embedModel: 'x' })
    expect(embed.data!.saveAiConnection.userErrors[0]!.field).toEqual(['input', 'embedModel'])
  })

  it('cannot save keys where AI_KEYS_SECRET is not set, and says so', async () => {
    const adminThere = tokenFor(keyless.config, (await seedUser(keyless.app, { verified: true, globalRole: 'PLATFORM_ADMIN' })).id, undefined, ['PLATFORM_ADMIN'])
    expect((await settings(keyless, adminThere)).data!.aiSettings.keysCanBeSaved).toBe(false)
    const res = await save(keyless, adminThere, { kind: 'OPENAI', label: 'ChatGPT', apiKey: 'sk-test', mayReceivePrivate: false, enabled: true, chatModel: 'gpt-test' })
    expect(res.data!.saveAiConnection.userErrors[0]).toMatchObject({ code: 'UNAVAILABLE', message: expect.stringMatching(/AI_KEYS_SECRET/) })
  })

  it('tests a connection: one word, one embedding and the models the account has', async () => {
    const gpt = (await save(app, admin, { kind: 'OPENAI', label: 'ChatGPT', baseUrl: openai.url, apiKey: 'sk-test-4321', mayReceivePrivate: false, enabled: true, chatModel: 'gpt-test', embedModel: 'text-embedding-test' })).data!.saveAiConnection.connection!
    const test = async (id: string) => (await app.gql<{ testAiConnection: { test: { ok: boolean; message: string; models: string[] } } }>('mutation ($input: AiConnectionIdInput!) { testAiConnection(input: $input) { test { ok message latencyMs models } userErrors { message } } }', { input: { id } }, admin)).data!.testAiConnection.test
    expect(await test(gpt.id)).toMatchObject({ ok: true, message: 'gpt-test answered “OK”; text-embedding-test gave 768 numbers.', models: ['gpt-test', 'text-embedding-test'] })
    openai.answer = () => ({ status: 401, body: '{"error":{"message":"Incorrect API key provided"}}' })
    const failed = await test(gpt.id)
    expect(failed.ok).toBe(false)
    expect(failed.message).toMatch(/401.*Incorrect API key/)
    openai.answer = () => 'OK'
    const usage = await app.app.get(PrismaService).aiUsage.findMany({ where: { task: 'CONNECTION_TEST' } })
    expect(usage.map((u) => u.provider)).toEqual(['OPENAI', 'OPENAI'])
  })

  it('chooses who answers: the defaults, and each task’s route; a route refuses a provider that cannot do the task', async () => {
    const shown = (await settings(app, admin)).data!.aiSettings
    const claudeId = shown.connections.find((c) => c.label.startsWith('Claude'))!.id
    const gptId = shown.connections.find((c) => c.label === 'ChatGPT')!.id
    const set = await mutate('setAiDefaults', 'SetAiDefaultsInput', { chatConnectionId: claudeId, embedConnectionId: gptId })
    expect(set.settings).toMatchObject({ chatConnectionId: claudeId, embedConnectionId: gptId })
    const noEmbed = await mutate('setAiDefaults', 'SetAiDefaultsInput', { chatConnectionId: claudeId, embedConnectionId: claudeId })
    expect(noEmbed.userErrors[0]!.message).toMatch(/embedding model/)
    expect((await mutate('saveAiTaskRoute', 'SaveAiTaskRouteInput', { task: 'TRANSCRIBE', connectionId: claudeId, model: 'claude-test' })).userErrors[0]!.message).toMatch(/cannot hear recordings/)
    expect((await mutate('saveAiTaskRoute', 'SaveAiTaskRouteInput', { task: 'NOT_A_TASK', model: 'x' })).userErrors[0]!.code).toBe('VALIDATION')
    const routed = await mutate('saveAiTaskRoute', 'SaveAiTaskRouteInput', { task: 'TRANSCRIBE', connectionId: gptId, model: 'gpt-audio-test', inputMicroUsdPerMTok: 2_500_000 })
    expect(routed.settings!.routes).toEqual([{ task: 'TRANSCRIBE', connectionId: gptId, model: 'gpt-audio-test' }])
    expect((await app.gql<{ aiStatus: { available: boolean } }>('{ aiStatus { available } }')).data!.aiStatus.available).toBe(true)
  })

  it('deleting a connection hands its routes and defaults back', async () => {
    const shown = (await settings(app, admin)).data!.aiSettings
    const gptId = shown.connections.find((c) => c.label === 'ChatGPT')!.id
    const after = (await mutate('deleteAiConnection', 'AiConnectionIdInput', { id: gptId })).settings!
    expect(after.connections.map((c) => c.id)).not.toContain(gptId)
    expect(after.embedConnectionId).toBeNull()
    expect(after.routes).toEqual([{ task: 'TRANSCRIBE', connectionId: null, model: 'gpt-audio-test' }])
    expect((await mutate('deleteAiTaskRoute', 'AiTaskRouteInput', { task: 'TRANSCRIBE' })).settings!.routes).toEqual([])
    const actions = (await app.app.get(PrismaService).auditLog.findMany({ where: { action: { startsWith: 'ai.' } } })).map((a) => a.action)
    expect(actions).toEqual(expect.arrayContaining(['ai.defaults.changed', 'ai.route.saved', 'ai.connection.deleted', 'ai.route.deleted']))
  })
})
