import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ErrorCode } from '@lvn-backend/errors'
import type { AiConfig } from '../../src/ai.config'
import { AiKeys } from '../../src/application/ai-keys'
import { AiProviders, type Target } from '../../src/application/ai-providers'
import { AiSettingsService } from '../../src/application/ai-settings.service'
import { PromptLibrary } from '../../src/application/prompts'
import { ROUTABLE_TASKS } from '../../src/domain/catalog'
import { chooseIdCardTargets, ID_CARD_CHECK_TASK, idCardPreference, type IdCardRouteTarget } from '../../src/domain/id-card-route'
import { mediaTypeOf, type AiProviderAdapter } from '../../src/domain/provider'

describe('ID card AI route', () => {
  it('prefers a private Gemini Flash model, then GPT-4o-mini', () => {
    expect(idCardPreference({ kind: 'GEMINI', model: 'gemini-2.5-flash', mayReceivePrivate: true })).toBe(0)
    expect(idCardPreference({ kind: 'OPENAI', model: 'gpt-4o-mini', mayReceivePrivate: true })).toBe(1)
    expect(idCardPreference({ kind: 'OLLAMA', model: 'gemma4', mayReceivePrivate: true })).toBe(2)
    expect(idCardPreference({ kind: 'GEMINI', model: 'gemini-2.5-flash', mayReceivePrivate: false })).toBeNull()
    expect(idCardPreference({ kind: 'OPENAI', model: 'gpt-4o-mini', mayReceivePrivate: false })).toBeNull()
  })

  it('the prompt carries no account fields, and a PDF is recognised from its bytes', () => {
    const source = readFileSync(path.join(__dirname, '../../prompts/id-card-check.md'), 'utf8')
    expect(source).not.toContain('{{')
    const text = new PromptLibrary().render('id-card-check').messages.map((m) => m.content).join('\n')
    expect(text.toLowerCase()).not.toMatch(/display\s*name|e-?mail|profile|user id/)
    expect(text).not.toContain('@')
    expect(mediaTypeOf(Buffer.from('%PDF-1.4').toString('base64'))).toBe('application/pdf')
  })

  it('uses an admin route alone, and only when that connection may receive private data', () => {
    const flash = candidate('flash', 'GEMINI', 'gemini-2.5-flash', true)
    const mini = candidate('mini', 'OPENAI', 'gpt-4o-mini', true)
    const local = candidate('local', 'OLLAMA', 'gemma4', true)
    const route = candidate('local', 'OLLAMA', 'llava', true)
    expect(chooseIdCardTargets(route, [flash, mini, local]).map(brief)).toEqual([{ connectionId: 'local', model: 'llava' }])
    expect(chooseIdCardTargets({ ...route, mayReceivePrivate: false }, [flash, mini])).toEqual([])
    const publicMini = { ...mini, connectionId: 'public-mini', mayReceivePrivate: false }
    const publicFlash = { ...flash, connectionId: 'public', mayReceivePrivate: false }
    expect(chooseIdCardTargets(null, [local, publicMini, mini, flash, publicFlash]).map(brief)).toEqual([
      { connectionId: 'flash', model: 'gemini-2.5-flash' },
      { connectionId: 'mini', model: 'gpt-4o-mini' },
      { connectionId: 'local', model: 'gemma4' },
    ])
  })
})

function candidate(connectionId: string | null, kind: string, model: string, mayReceivePrivate: boolean): IdCardRouteTarget {
  return { connectionId, kind, model, mayReceivePrivate }
}

function brief(target: IdCardRouteTarget) {
  return { connectionId: target.connectionId, model: target.model }
}

const SECRET = 'unit-test-secret-0123456789abcd'

function aiConfig(over: Partial<AiConfig> = {}): AiConfig {
  return { appEnv: 'development', geminiEnvNames: [], provider: 'none', ollama: null, chatModel: null, embedModel: null, timeoutMs: 1_000, monthlyBudgetMicroUsd: null, publicPipeline: false, keysSecret: SECRET, ...over }
}

interface StoredConnection {
  id: string
  kind: 'OLLAMA' | 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'OPENAI_COMPATIBLE'
  mayReceivePrivate: boolean
  enabled?: boolean
  chatModel: string | null
  inputMicroUsdPerMTok?: number
  outputMicroUsdPerMTok?: number
}

function connectionRow(keys: AiKeys, row: StoredConnection) {
  const needsKey = row.kind !== 'OLLAMA'
  return {
    id: row.id,
    kind: row.kind,
    label: row.id,
    baseUrl: 'https://models.example',
    apiKeyCipher: needsKey ? keys.seal('sk-test') : null,
    apiKeyHint: needsKey ? 'test' : null,
    mayReceivePrivate: row.mayReceivePrivate,
    enabled: row.enabled ?? true,
    chatModel: row.chatModel,
    embedModel: null,
    inputMicroUsdPerMTok: row.inputMicroUsdPerMTok ?? 1,
    outputMicroUsdPerMTok: row.outputMicroUsdPerMTok ?? 2,
    embedMicroUsdPerMTok: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function providerHarness(opts: { connections?: StoredConnection[]; routes?: { task: string; connectionId: string | null; model: string; inputMicroUsdPerMTok?: number; outputMicroUsdPerMTok?: number }[]; chatConnectionId?: string | null; environment?: AiProviderAdapter | null; config?: Partial<AiConfig> } = {}) {
  const config = aiConfig(opts.config)
  const keys = new AiKeys(config)
  const db = {
    aiSettings: { findUnique: async () => ({ id: 1, version: 1, chatConnectionId: opts.chatConnectionId ?? null, embedConnectionId: null }) },
    aiConnection: { findMany: async () => (opts.connections ?? []).map((row) => connectionRow(keys, row)) },
    aiModelRoute: {
      findMany: async () =>
        (opts.routes ?? []).map((route) => ({
          task: route.task,
          connectionId: route.connectionId,
          model: route.model,
          inputMicroUsdPerMTok: route.inputMicroUsdPerMTok ?? 0,
          outputMicroUsdPerMTok: route.outputMicroUsdPerMTok ?? 0,
          updatedAt: new Date(),
        })),
    },
  }
  return new AiProviders(db as never, config, opts.environment ?? null, keys)
}

function shown(targets: Target[]) {
  return targets.map((target) => ({ connectionId: target.connectionId, model: target.model, private: target.adapter.mayReceivePrivate, inPrice: target.inPrice, outPrice: target.outPrice }))
}

describe('ID card candidates', () => {
  const rows: StoredConnection[] = [
    { id: 'local', kind: 'OLLAMA', mayReceivePrivate: true, chatModel: 'gemma4' },
    { id: 'public-mini', kind: 'OPENAI', mayReceivePrivate: false, chatModel: 'gpt-4o-mini' },
    { id: 'flash', kind: 'GEMINI', mayReceivePrivate: true, chatModel: 'gemini-2.5-flash', inputMicroUsdPerMTok: 3, outputMicroUsdPerMTok: 4 },
    { id: 'mini', kind: 'OPENAI', mayReceivePrivate: true, chatModel: 'gpt-4o-mini' },
    { id: 'off', kind: 'GEMINI', mayReceivePrivate: true, enabled: false, chatModel: 'gemini-2.5-flash' },
  ]

  it('falls back to a private Gemini Flash, then GPT-4o-mini, then any other private chat model', async () => {
    const environment: AiProviderAdapter = { name: 'OLLAMA', mayReceivePrivate: true, chat: async () => { throw new Error('not called') }, embed: async () => { throw new Error('not called') } }
    const providers = providerHarness({ connections: rows, environment, config: { provider: 'ollama', chatModel: 'environment-gemma' } })
    expect(shown(await providers.idCardCandidates())).toEqual([
      { connectionId: 'flash', model: 'gemini-2.5-flash', private: true, inPrice: 3, outPrice: 4 },
      { connectionId: 'mini', model: 'gpt-4o-mini', private: true, inPrice: 1, outPrice: 2 },
      { connectionId: 'local', model: 'gemma4', private: true, inPrice: 1, outPrice: 2 },
      { connectionId: null, model: 'environment-gemma', private: true, inPrice: 0, outPrice: 0 },
    ])
  })

  it('uses only the admin route, including its model and prices, when one is set', async () => {
    const providers = providerHarness({
      connections: rows,
      routes: [{ task: ID_CARD_CHECK_TASK, connectionId: 'mini', model: 'custom-vision', inputMicroUsdPerMTok: 11, outputMicroUsdPerMTok: 22 }],
    })
    expect(shown(await providers.idCardCandidates())).toEqual([{ connectionId: 'mini', model: 'custom-vision', private: true, inPrice: 11, outPrice: 22 }])
  })

  it('does not fall back when the routed connection may not receive private data', async () => {
    const providers = providerHarness({
      connections: rows,
      routes: [{ task: ID_CARD_CHECK_TASK, connectionId: 'public-mini', model: 'gpt-4o-mini' }],
    })
    expect(await providers.idCardCandidates()).toEqual([])
  })

  it('follows a route with no connection only when the default chat provider is private', async () => {
    const environment: AiProviderAdapter = { name: 'OLLAMA', mayReceivePrivate: true, chat: async () => { throw new Error('not called') }, embed: async () => { throw new Error('not called') } }
    const routed = providerHarness({
      connections: rows,
      routes: [{ task: ID_CARD_CHECK_TASK, connectionId: null, model: 'llava', inputMicroUsdPerMTok: 7, outputMicroUsdPerMTok: 8 }],
      chatConnectionId: 'local',
      environment,
      config: { provider: 'ollama', chatModel: 'environment-gemma' },
    })
    expect(shown(await routed.idCardCandidates())).toEqual([{ connectionId: 'local', model: 'llava', private: true, inPrice: 7, outPrice: 8 }])

    const publicDefault = providerHarness({
      connections: rows,
      routes: [{ task: ID_CARD_CHECK_TASK, connectionId: null, model: 'llava' }],
      chatConnectionId: 'public-mini',
      environment,
      config: { provider: 'ollama', chatModel: 'environment-gemma' },
    })
    expect(await publicDefault.idCardCandidates()).toEqual([])
  })
})

describe('ID card route in admin settings', () => {
  it('is one of the tasks the AI settings API already lists', () => {
    expect(ROUTABLE_TASKS).toContain(ID_CARD_CHECK_TASK)
  })

  function settings(connections: { id: string; kind: 'GEMINI' | 'OPENAI'; mayReceivePrivate: boolean; label?: string }[]) {
    const upserts: { where: { task: string }; create: { connectionId: string | null; model: string } }[] = []
    const db = {
      aiConnection: {
        findUnique: async ({ where }: { where: { id: string } }) => connections.find((row) => row.id === where.id) ?? null,
        findMany: async () => connections,
      },
      aiModelRoute: {
        upsert: async (args: { where: { task: string }; create: { connectionId: string | null; model: string } }) => void upserts.push(args),
        findMany: async () => [],
      },
      aiSettings: {
        upsert: async () => ({ id: 1, version: 1 }),
        findUnique: async () => ({ id: 1, version: 1, chatConnectionId: null, embedConnectionId: null }),
      },
    }
    const service = new AiSettingsService(
      db as never,
      { invalidate: () => undefined } as never,
      { available: true } as never,
      { spentThisMonth: async () => 0 } as never,
      aiConfig(),
      null,
      { actor: async (id: string) => ({ id, globalRole: id === 'admin' ? 'PLATFORM_ADMIN' : 'STUDENT', institutionVerified: true }) } as never,
      { record: async () => undefined } as never,
    )
    return { service, upserts }
  }

  it('lets an admin save the route only on a connection that may receive private data', async () => {
    const h = settings([
      { id: 'private', kind: 'OPENAI', mayReceivePrivate: true },
      { id: 'public', kind: 'OPENAI', mayReceivePrivate: false },
      { id: 'gemini', kind: 'GEMINI', mayReceivePrivate: true },
    ])
    await expect(h.service.saveRoute('student', { task: ID_CARD_CHECK_TASK, connectionId: 'private', model: 'gpt-4o-mini' })).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN })
    await expect(h.service.saveRoute('admin', { task: ID_CARD_CHECK_TASK, connectionId: 'public', model: 'gpt-4o-mini' })).rejects.toMatchObject({
      code: ErrorCode.VALIDATION,
      field: ['input', 'connectionId'],
      message: 'ID cards can only go to a connection that may receive private data.',
    })
    await expect(h.service.saveRoute('admin', { task: ID_CARD_CHECK_TASK, connectionId: 'gemini', model: 'gemini-2.5-flash' })).rejects.toMatchObject({
      code: ErrorCode.VALIDATION,
      message: 'Gemini and Google Generative AI are not available.',
    })
    expect(h.upserts).toEqual([])
    await h.service.saveRoute('admin', { task: ID_CARD_CHECK_TASK, connectionId: 'private', model: 'gpt-4o-mini' })
    expect(h.upserts).toEqual([
      expect.objectContaining({
        where: { task: ID_CARD_CHECK_TASK },
        create: expect.objectContaining({ task: ID_CARD_CHECK_TASK, connectionId: 'private', model: 'gpt-4o-mini' }),
      }),
    ])
  })
})
