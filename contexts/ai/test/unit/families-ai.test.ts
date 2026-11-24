import { z } from 'zod'
import { CHILD_SAFETY_PROMPT, ErrorCode } from '@lvn/contracts/domain'
import type { Entitlements, People, PlatformSettings } from '@lvn-backend/facades'
import type { EventBus } from '@lvn-backend/event-bus'
import { AppError } from '@lvn-backend/errors'
import type { AiConfig } from '../../src/ai.config'
import { AiGateway } from '../../src/application/ai-gateway'
import { AiReportsService } from '../../src/application/ai-reports.service'
import { PromptLibrary } from '../../src/application/prompts'
import { geminiEnvNames, geminiFindings, geminiStartupDecision, isGeminiModel, isOpenAiApiUrl } from '../../src/domain/gemini-policy'
import { chooseMinorRoute, MINOR_AI_MESSAGES, type MinorRouteOption, type MinorRoutePolicy } from '../../src/domain/minor-route'
import { filterMinorOutput, MINOR_SAFE_MESSAGE, MINOR_SELF_HARM_MESSAGE, withChildSafety } from '../../src/domain/minor-output'
import type { AiProviderAdapter } from '../../src/domain/provider'
import type { Target } from '../../src/application/ai-providers'
import { AiAnswerLabelResolver, TranscriptLabelResolver } from '../../src/graphql/ai-label.resolver'

const option = (over: Partial<MinorRouteOption> & Pick<MinorRouteOption, 'key' | 'kind'>): MinorRouteOption => ({
  model: over.kind === 'ANTHROPIC' ? 'claude-sonnet-4-5' : over.kind === 'OLLAMA' ? 'gemma4' : 'gpt-4o-mini',
  mayReceivePrivate: true,
  chats: true,
  embeds: false,
  hears: over.kind === 'OLLAMA',
  google: over.kind === 'GEMINI',
  openAi: over.kind === 'OPENAI',
  ...over,
})

const adult: MinorRoutePolicy = { minor: false, openAiAllowed: false, needsPrivate: false }
const minor: MinorRoutePolicy = { minor: true, openAiAllowed: false, needsPrivate: false }

describe('minor provider routing', () => {
  const openai = option({ key: 'openai', kind: 'OPENAI' })
  const anthropic = option({ key: 'anthropic', kind: 'ANTHROPIC', hears: false })
  const ollama = option({ key: 'ollama', kind: 'OLLAMA', model: 'gemma4' })
  const gemini = option({ key: 'gemini', kind: 'GEMINI', model: 'gemini-2.5-flash', hears: true })

  it('leaves an adult on OpenAI', () => {
    expect(chooseMinorRoute('openai', [openai, anthropic], 'chat', adult)).toEqual({ action: 'use', key: 'openai' })
  })

  it('moves a minor and an unknown age off OpenAI onto Anthropic, and keeps a safe route', () => {
    expect(chooseMinorRoute('openai', [openai, ollama, anthropic], 'chat', minor)).toEqual({ action: 'use', key: 'anthropic' })
    expect(chooseMinorRoute('ollama', [openai, ollama, anthropic], 'chat', minor)).toEqual({ action: 'use', key: 'ollama' })
  })

  it('allows OpenAI for a minor only when zero-data retention is approved, and never as the fallback', () => {
    const approved: MinorRoutePolicy = { ...minor, openAiAllowed: true }
    expect(chooseMinorRoute('openai', [openai, anthropic], 'chat', approved)).toEqual({ action: 'use', key: 'openai' })
    expect(chooseMinorRoute('gemini', [gemini, openai], 'chat', approved)).toEqual({ action: 'blocked' })
  })

  it('blocks transcription for a minor when the only model that can hear is OpenAI', () => {
    const whisper = option({ key: 'whisper', kind: 'OPENAI', model: 'whisper-1', hears: true, chats: true })
    expect(chooseMinorRoute('whisper', [whisper, anthropic], 'transcribe', minor)).toEqual({ action: 'blocked' })
    expect(chooseMinorRoute('whisper', [whisper, ollama], 'transcribe', minor)).toEqual({ action: 'use', key: 'ollama' })
  })

  it('does not send a private note to a provider that may not receive private data', () => {
    const publicClaude = option({ key: 'anthropic', kind: 'ANTHROPIC', mayReceivePrivate: false })
    expect(chooseMinorRoute('openai', [openai, publicClaude], 'chat', { ...minor, needsPrivate: true })).toEqual({ action: 'blocked' })
  })

  it('does not treat a compatible proxy or Gemma as OpenAI or Gemini', () => {
    const proxy = option({ key: 'proxy', kind: 'OPENAI_COMPATIBLE', model: 'local-chat', openAi: false, google: false })
    expect(chooseMinorRoute('proxy', [proxy], 'chat', minor)).toEqual({ action: 'use', key: 'proxy' })
    expect(isGeminiModel('gemma4')).toBe(false)
    expect(isGeminiModel('models/gemini-2.5-flash')).toBe(true)
    expect(isOpenAiApiUrl('https://api.openai.com/v1')).toBe(true)
    expect(isOpenAiApiUrl('https://models.example/v1')).toBe(false)
  })
})

describe('minor output filter', () => {
  it('passes study text and replaces sexual, violent, self-harm and personal details', () => {
    expect(filterMinorOutput('A heap keeps the smallest item on top.')).toEqual({ ok: true })
    expect(filterMinorOutput('The word sex is not itself a block.')).toEqual({ ok: true })
    expect(filterMinorOutput('The chapter describes sexual intercourse.')).toMatchObject({ ok: false, category: 'sexual', message: MINOR_SAFE_MESSAGE })
    expect(filterMinorOutput('how to kill a process')).toMatchObject({ ok: false, category: 'violent' })
    expect(filterMinorOutput('I want to die')).toMatchObject({ ok: false, category: 'self-harm', message: MINOR_SELF_HARM_MESSAGE })
    expect(MINOR_SELF_HARM_MESSAGE).toContain('9152987821')
    expect(filterMinorOutput('Write to me at student@school.edu')).toMatchObject({ ok: false, category: 'pii' })
    expect(filterMinorOutput('Call iCall on 9152987821')).toEqual({ ok: true })
  })

  it('puts the child-safety prompt in front of the system message', () => {
    expect(withChildSafety('You help students.', CHILD_SAFETY_PROMPT).startsWith(CHILD_SAFETY_PROMPT)).toBe(true)
    expect(withChildSafety('You help students.', '  ')).toBe('You help students.')
  })
})

describe('Gemini startup', () => {
  it('refuses production and only warns elsewhere, and ignores Firebase and public client keys', () => {
    const env = { GEMINI_API_KEY: 'secret', FIREBASE_API_KEY: 'fb', NEXT_PUBLIC_GEMINI_KEY: 'web', GOOGLE_OAUTH_CLIENT_ID: 'oauth', EMPTY_GEMINI: '' }
    expect(geminiEnvNames(env)).toEqual(['GEMINI_API_KEY'])
    const findings = geminiFindings({
      envNames: ['GEMINI_API_KEY'],
      connections: [{ label: 'Google', kind: 'GEMINI', enabled: false, baseUrl: null, chatModel: 'gemini-2.5-flash', embedModel: null, hasKey: true }],
      routes: [],
      chatModel: null,
      embedModel: null,
    })
    expect(geminiStartupDecision('production', findings)).toMatchObject({ refuse: true })
    expect(geminiStartupDecision('production', findings)?.message).toContain('Remove them before production will start.')
    expect(geminiStartupDecision('development', findings)?.refuse).toBe(false)
    expect(geminiStartupDecision('sandbox', [])).toBeNull()
  })
})

describe('AiGateway Families policy', () => {
  const seen: { messages: { role: string; content: string }[]; deltas: number }[] = []
  let reply = 'A heap keeps the smallest item on top.'
  let policy: MinorRoutePolicy | null = null
  const minors = new Set<string>()
  const zdr = { on: false }

  const adapter: AiProviderAdapter = {
    name: 'OLLAMA',
    mayReceivePrivate: true,
    chat: async (request, onDelta) => {
      seen.push({ messages: request.messages.map((m) => ({ role: m.role, content: m.content })), deltas: onDelta ? 1 : 0 })
      onDelta?.('partial ')
      return { text: reply, promptTokens: 3, completionTokens: 2 }
    },
    embed: async () => ({ vectors: [[1]], promptTokens: 1 }),
    transcribe: async () => ({ text: reply, promptTokens: 1 }),
  }
  const target: Target = { connectionId: 'c', adapter, model: 'gemma4', inPrice: 0, outPrice: 0 }
  const config: AiConfig = { appEnv: 'development', geminiEnvNames: [], provider: 'none', ollama: null, chatModel: null, embedModel: null, timeoutMs: 5_000, monthlyBudgetMicroUsd: null, publicPipeline: false, keysSecret: null }
  const db = { aiUsage: { aggregate: async () => ({ _sum: { promptTokens: 0, completionTokens: 0, costMicroUsd: 0 } }), create: async () => ({}) } }
  const entitlements = { limit: async () => null } as Entitlements
  const events = { publish: async () => undefined, subscribe: () => undefined } as unknown as EventBus
  const settings: PlatformSettings = {
    boolean: (key, fallback) => (key === 'openai_zdr_approved' ? zdr.on : fallback),
    integer: (_key, fallback) => fallback,
    string: (key, fallback) => (key === 'ai_child_safety_prompt' ? '' : fallback),
  }
  const people = { isMinorForAi: async (id: string) => minors.has(id) } as unknown as People
  const providers = {
    guarded: async (_kind: string, _task: string | null, next: MinorRoutePolicy) => {
      policy = next
      return next.minor && next.needsPrivate && !next.openAiAllowed && _kind === 'transcribe' ? 'blocked' : target
    },
    forTask: async () => target,
    forEmbeddings: async () => target,
    transcriptionChoice: async () => target,
  }

  function gateway() {
    return new AiGateway(db as never, new PromptLibrary(), config, providers as never, entitlements, events, settings, people)
  }

  beforeEach(() => {
    seen.length = 0
    reply = 'A heap keeps the smallest item on top.'
    policy = null
    minors.clear()
    zdr.on = false
  })

  const ask = (userId: string | null, subjectId?: string) =>
    gateway().generate({ task: 'SUMMARIZE', userId, subjectId, private: false, prompt: 'summarize', vars: { language: 'English', sentences: 2 }, content: { title: 'Heaps', body: 'A heap keeps the smallest item on top.' }, onDelta: () => undefined })

  it('does not change an adult call', async () => {
    const out = await ask('adult')
    expect(out.output).toBe(reply)
    expect(seen[0]!.messages[0]!.content.startsWith('You help students')).toBe(true)
    expect(seen[0]!.messages[0]!.content).not.toContain('under 13')
    expect(seen[0]!.deltas).toBe(1)
    expect(policy).toMatchObject({ minor: false, openAiAllowed: false })
  })

  it('applies the child-safety prompt and the output filter for a minor and for an unknown age', async () => {
    minors.add('child')
    minors.add('unknown')
    const safe = await ask('child')
    expect(safe.output).toBe(reply)
    expect(seen[0]!.messages[0]!.content.startsWith(CHILD_SAFETY_PROMPT)).toBe(true)
    expect(seen[0]!.deltas).toBe(0)
    expect(policy).toMatchObject({ minor: true, openAiAllowed: false })
    reply = 'Here is some pornography.'
    await expect(ask('unknown')).resolves.toMatchObject({ output: MINOR_SAFE_MESSAGE })
  })

  it('tells a schema task the safe message instead of the model text', async () => {
    minors.add('child')
    reply = 'I want to die'
    const schema = z.object({ summary: z.string(), concepts: z.array(z.string()).min(1) })
    await expect(
      gateway().generate({ task: 'SUMMARIZE', userId: 'child', private: true, prompt: 'summarize', vars: { language: 'English', sentences: 2 }, content: { title: 'Heaps', body: 'x' }, schema }),
    ).rejects.toMatchObject({ code: ErrorCode.UNAVAILABLE, message: MINOR_SELF_HARM_MESSAGE })
  })

  it('passes zero-data retention into the route and still filters', async () => {
    minors.add('child')
    zdr.on = true
    reply = 'sexual intercourse'
    await expect(ask('child')).resolves.toMatchObject({ output: MINOR_SAFE_MESSAGE })
    expect(policy).toMatchObject({ minor: true, openAiAllowed: true })
  })

  it('blocks transcription for a minor when routing says there is no safe model, and leaves an adult transcript alone', async () => {
    const whisper: Target = { ...target, model: 'whisper-1', adapter: { ...adapter, name: 'OPENAI' } }
    const routed = {
      ...providers,
      guarded: async (kind: string, _task: string | null, next: MinorRoutePolicy) => {
        if (kind === 'transcribe' && next.minor && !next.openAiAllowed) return 'blocked'
        return whisper
      },
    }
    const g = new AiGateway(db as never, new PromptLibrary(), config, routed as never, entitlements, events, settings, people)
    minors.add('child')
    await expect(g.transcribeBytes(Buffer.from('RIFF'), { userId: 'child', private: true })).rejects.toMatchObject({ code: ErrorCode.AI_UNAVAILABLE_FOR_MINOR, message: MINOR_AI_MESSAGES.transcribe })
    reply = 'I want to die'
    await expect(g.transcribeBytes(Buffer.from('RIFF'), { userId: 'adult', private: true })).resolves.toBe('I want to die')
  })

  it('does not call a provider when the route is blocked', async () => {
    const blocked = { ...providers, guarded: async () => 'blocked' as const }
    const g = new AiGateway(db as never, new PromptLibrary(), config, blocked as never, entitlements, events, settings, people)
    minors.add('child')
    await expect(g.generate({ task: 'SUMMARIZE', userId: 'child', private: false, prompt: 'summarize', vars: { language: 'English', sentences: 1 }, content: { title: 't', body: 'b' } })).rejects.toBeInstanceOf(AppError)
    expect(seen).toEqual([])
  })
})

describe('AI label', () => {
  it('is true for a model answer and false for browser captions', () => {
    expect(new AiAnswerLabelResolver().aiGenerated({})).toBe(true)
    expect(new TranscriptLabelResolver().aiGenerated({})).toBe(true)
    expect(new TranscriptLabelResolver().aiGenerated({ aiGenerated: false })).toBe(false)
  })
})

describe('AI reports', () => {
  const reports: { id: string; status: string; reporterId: string; context: unknown; comment: string | null }[] = []
  let hits = 0
  const answers = new Map<string, { askerId: string; status: string; noteId: string | null }>()
  const db = {
    aiAnswer: { findUnique: async ({ where }: { where: { id: string } }) => answers.get(where.id) ?? null },
    noteArtifact: { findUnique: async () => null },
    aiReport: {
      create: async ({ data }: { data: { id: string; reporterId: string; context: unknown; comment: string | null; status: string } }) => {
        reports.push(data)
        return data
      },
      findMany: async () => reports.filter((row) => row.status === 'OPEN'),
      findUnique: async ({ where }: { where: { id: string } }) => reports.find((row) => row.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        const row = reports.find((item) => item.id === where.id)!
        Object.assign(row, data)
        return row
      },
    },
  }
  const limiter = { hit: async () => ({ allowed: hits++ < 1, retryAfter: 30, remaining: 0 }) }
  const policy = { actor: async (id: string) => ({ id, globalRole: id === 'admin' ? 'PLATFORM_ADMIN' : 'STUDENT', institutionVerified: true }) }
  const settings: PlatformSettings = { boolean: (_k, f) => f, integer: (_k, f) => f, string: (_k, f) => f }

  function service() {
    return new AiReportsService(db as never, limiter as never, policy as never, settings)
  }

  beforeEach(() => {
    reports.length = 0
    hits = 0
    answers.clear()
    answers.set('answer-1', { askerId: 'student', status: 'READY', noteId: 'note-1' })
  })

  it('stores the response id and no answer text, and rate-limits the next report', async () => {
    const row = await service().report('student', { responseId: 'answer-1', responseKind: 'ANSWER', reason: 'INACCURATE', comment: ' the date is wrong ' })
    expect(row.comment).toBe('the date is wrong')
    expect(row.context).toEqual({ task: 'ASK', status: 'READY', noteId: 'note-1' })
    expect(JSON.stringify(row.context)).not.toContain('question')
    await expect(service().report('student', { responseId: 'answer-1', responseKind: 'ANSWER', reason: 'OTHER' })).rejects.toMatchObject({ code: ErrorCode.RATE_LIMITED })
    hits = 0
    await expect(service().report('other', { responseId: 'answer-1', responseKind: 'ANSWER', reason: 'OTHER' })).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND })
  })

  it('lets an admin list and resolve, and refuses everyone else', async () => {
    await service().report('student', { responseId: 'answer-1', responseKind: 'ANSWER', reason: 'HARMFUL' })
    await expect(service().list('student', {})).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN })
    const open = await service().list('admin', { first: 20 })
    expect(open).toHaveLength(1)
    const closed = await service().resolve('admin', open[0]!.id)
    expect(closed.status).toBe('RESOLVED')
    await expect(service().dismiss('admin', open[0]!.id)).rejects.toMatchObject({ code: ErrorCode.CONFLICT })
  })
})
