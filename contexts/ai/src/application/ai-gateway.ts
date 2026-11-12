import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { z } from 'zod'
import { AI_CHILD_SAFETY_PROMPT_SETTING, CHILD_SAFETY_PROMPT, LimitKey, OPENAI_ZDR_APPROVED_SETTING } from '@lvn/contracts/domain'
import { assertWithinPlan, Errors, planLimitError } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { ENTITLEMENTS, PEOPLE, PLATFORM_SETTINGS, fallbackPlatformSettings, type Entitlements, type People, type PlatformSettings } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { AI_CONFIG, type AiConfig } from '../ai.config'
import { mendAll } from '../domain/escapes'
import { ID_CARD_CHECK_TASK } from '../domain/id-card-route'
import { audioTransport, modelCanHear } from '../domain/model-capabilities'
import { blockedForMinor, MINOR_AI_MESSAGES, type AiCapability, type MinorRoutePolicy } from '../domain/minor-route'
import { filterMinorOutput, withChildSafety } from '../domain/minor-output'
import { isGeminiModel } from '../domain/gemini-policy'
import { HttpProviderError, MODEL_UNSUPPORTED, ProviderError, UnsupportedInput, type ChatMessage } from '../domain/provider'
import { AiProviders, type Target } from './ai-providers'
import { PromptLibrary } from './prompts'
import { aiUsedToday } from './usage-counts'

export type AiUnavailableReason = 'NOT_CONFIGURED' | 'BUDGET' | 'PROVIDER_DOWN'

export interface GenerateCall<T> {
  /** What this is for: picks the model (AiModelRoute) and labels the usage */
  task: string
  /** Who asked; null for the platform's own jobs (the public-note pipeline), which no quota limits */
  userId: string | null
  /** Material from notes that are not public: only providers that may receive private data (§10.1) */
  private: boolean
  prompt: string
  vars?: Record<string, string | number>
  /** What people wrote, fenced in the prompt */
  content?: Record<string, string>
  /** The answer must parse as JSON of this shape; without it the answer is text */
  schema?: z.ZodType<T>
  images?: string[]
  /** Streams the answer's text as it comes (text answers only). A minor's answer is not streamed until it has passed the output filter. */
  onDelta?: (text: string) => void
  maxTokens?: number
  temperature?: number
  /**
   * Whose age decides OpenAI and child-safety when it is not `userId` (platform work that still carries one person's
   * content: a public note's owner, a daily line). Quota stays on `userId`.
   */
  subjectId?: string | null
}

export interface Generated<T> {
  output: T
  model: string
  promptTokens: number
  completionTokens: number
}

const RETRIES = [250, 1000]
/**
 * Consecutive outages that open a provider's circuit, and for how long. Only timeouts, network errors, HTTP 5xx and
 * 429 count: a 4xx is this request (an unknown model, a shape the model refuses) and must not take the provider down.
 */
const TRIP_AFTER = 3
const OPEN_MS = 30_000
const BUDGET_CACHE_MS = 60_000
/** The circuit of the environment's provider; a connection's is its id. */
const ENVIRONMENT = 'environment'

const idCardSchema = z.object({
  name: z.string().nullable(),
  institution: z.string().nullable(),
  idNumber: z.string().nullable(),
  validUntil: z.string().nullable(),
  readable: z.boolean(),
  confidence: z.number(),
})

/** What the ID-card prompt returns. The gateway sends only the image. */
export interface IdCardReading {
  name: string | null
  institution: string | null
  idNumber: string | null
  validUntil: string | null
  readable: boolean
  confidence: number
}

const startOfUtcDay = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
const startOfUtcMonth = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

/**
 * Every AI call in the platform goes through here (§10.1, ADR-0058). In order: who answers this task (AiProviders:
 * a route, the default connection or the environment's provider, ADR-0065), is AI within its monthly budget, is that
 * provider's circuit closed, has the person tokens left today (their plan's AI_TOKENS_DAILY), may this provider see
 * this material;
 * then the versioned prompt with people's text fenced, retries, the answer checked against its schema (with one
 * repair), and an `AiUsage` row whatever happened.
 */
@Injectable()
export class AiGateway {
  private readonly log = new Logger('AiGateway')
  private circuits = new Map<string, { failures: number; openUntil: number }>()
  private spend: { since: number; microUsd: number; at: number } | null = null
  private told = new Set<string>()

  constructor(
    private readonly db: PrismaService,
    private readonly prompts: PromptLibrary,
    @Inject(AI_CONFIG) private readonly config: AiConfig,
    private readonly providers: AiProviders,
    @Inject(ENTITLEMENTS) private readonly entitlements: Entitlements,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(PLATFORM_SETTINGS) private readonly settings: PlatformSettings = fallbackPlatformSettings,
    @Optional() @Inject(PEOPLE) private readonly people: People | null = null,
  ) {}

  /** An admin's saved timeout, or the environment's AI_TIMEOUT_MS (ADR-0101). */
  private timeoutMs(): number {
    return this.settings.integer('ai_timeout_ms', this.config.timeoutMs) ?? this.config.timeoutMs
  }

  /** Whether AI answers now (the default chat provider), and if not, why. */
  async status(): Promise<{ available: boolean; reason: AiUnavailableReason | null }> {
    return this.statusOf(await this.providers.forTask(null))
  }

  private async statusOf(target: Target | null): Promise<{ available: boolean; reason: AiUnavailableReason | null }> {
    if (!target) return { available: false, reason: 'NOT_CONFIGURED' }
    if (await this.overBudget()) return { available: false, reason: 'BUDGET' }
    if (Date.now() < (this.circuits.get(target.connectionId ?? ENVIRONMENT)?.openUntil ?? 0)) return { available: false, reason: 'PROVIDER_DOWN' }
    return { available: true, reason: null }
  }

  /** The person's tokens used today (UTC) and their plan's daily limit (ADR-0024; null: none). */
  async allowance(userId: string): Promise<{ usedToday: number; limitToday: number | null; resetsAt: Date }> {
    const since = startOfUtcDay()
    const [sum, limit] = await Promise.all([
      this.db.aiUsage.aggregate({ _sum: { promptTokens: true, completionTokens: true }, where: { userId, createdAt: { gte: since } } }),
      this.entitlements.limit(userId, LimitKey.AI_TOKENS_DAILY),
    ])
    return { usedToday: (sum._sum.promptTokens ?? 0) + (sum._sum.completionTokens ?? 0), limitToday: limit === null ? null : Number(limit), resetsAt: new Date(since.getTime() + 86_400_000) }
  }

  /** Refuses another question or task once today's AI_REQUESTS_DAILY is used. A null limit never refuses. */
  async assertDailyRequests(userId: string): Promise<void> {
    const [used, limit] = await Promise.all([aiUsedToday(this.db, userId), this.entitlements.limit(userId, LimitKey.AI_REQUESTS_DAILY)])
    assertWithinPlan(LimitKey.AI_REQUESTS_DAILY, limit, used.requests)
  }

  async generate<T = string>(call: GenerateCall<T>): Promise<Generated<T>> {
    const minor = await this.isMinor(call.subjectId ?? call.userId)
    const chosen = await this.providers.guarded('task', call.task, this.routePolicy(minor, call.private))
    if (chosen === 'blocked') throw Errors.minorAi(MINOR_AI_MESSAGES.chat)
    return this.complete(await this.ready(chosen, call.userId, call.private), call, minor)
  }

  /**
   * Refuses before a task is queued when this person would have nowhere to send it except OpenAI.
   * A configured provider that is simply off still reports UNAVAILABLE, as it does for an adult.
   */
  async ensureRoutable(userId: string, task: string, isPrivate: boolean): Promise<void> {
    const kind = task === 'EMBED' || task === 'EMBED_QUERY' ? 'embed' : task === 'TRANSCRIBE' ? 'transcribe' : 'task'
    const capability: AiCapability = kind === 'task' ? 'chat' : kind
    const minor = await this.isMinor(userId)
    const chosen = await this.providers.guarded(kind, kind === 'task' ? task : null, this.routePolicy(minor, isPrivate))
    if (chosen === 'blocked') throw Errors.minorAi(MINOR_AI_MESSAGES[capability])
    if (!chosen) throw Errors.unavailable('AI is not switched on here.')
  }

  /**
   * One piece of a recording. Whisper and *-transcribe go to /audio/transcriptions. A chat model that can hear
   * takes the WAV on the chat call. A TRANSCRIBE route that names a deaf model is not replaced.
   */
  async transcribeBytes(wav: Buffer, who: { userId: string | null; private: boolean; subjectId?: string | null }, piece: { part: number; parts: number } = { part: 1, parts: 1 }): Promise<string> {
    const minor = await this.isMinor(who.subjectId ?? who.userId)
    const chosen = await this.providers.guarded('transcribe', null, this.routePolicy(minor, who.private))
    if (chosen === 'blocked') throw Errors.minorAi(MINOR_AI_MESSAGES.transcribe)
    const target = chosen
    if (!target) throw Errors.unavailable('AI is not switched on here.')
    if (!modelCanHear(target.model, target.adapter.name)) {
      throw Errors.unavailable(`${target.model} cannot hear recordings. Pick a model from the Transcribe list in Admin.`)
    }
    if (audioTransport(target.model) === 'transcriptions') {
      if (!target.adapter.transcribe) {
        throw Errors.unavailable(`${target.model} needs the transcriptions API, which ${target.adapter.name} does not offer. Pick a chat model that can hear, or an OpenAI transcription model.`)
      }
      const route = await this.ready(target, who.userId, who.private)
      const started = Date.now()
      try {
        const heard = await this.withRetries(route, () => route.adapter.transcribe!({ model: route.model, wav, timeoutMs: this.timeoutMs() }))
        const text = this.screen(heard.text.trim(), minor, 'TRANSCRIBE')
        await this.record({ userId: who.userId, task: 'TRANSCRIBE', model: route.model, promptTokens: heard.promptTokens, completionTokens: 0, ok: true, started, route })
        return text
      } catch (e) {
        if (e instanceof ProviderError) {
          await this.record({ userId: who.userId, task: 'TRANSCRIBE', model: route.model, promptTokens: 0, completionTokens: 0, ok: false, started, route })
          throw Errors.unavailable(failureText(e, route, this.log))
        }
        throw e
      }
    }
    const generated = await this.complete<string>(target, { task: 'TRANSCRIBE', userId: who.userId, private: who.private, prompt: 'transcribe', vars: { part: piece.part, parts: piece.parts }, images: [wav.toString('base64')], temperature: 0 }, minor)
    return generated.output.replace(/<\/?content>/g, '').trim()
  }

  /**
   * Reads one ID image or PDF. The prompt has no account fields: only these bytes are attached.
   * An admin's ID_CARD_CHECK route is used when one is set, and only if that connection may receive private data.
   * With no route: a private Gemini Flash, then GPT-4o-mini, then any other private chat model.
   * A provider that cannot take the file is skipped. Nothing about the image is logged.
   */
  async extractIdCard(imageBase64: string, subjectId?: string | null): Promise<IdCardReading> {
    const minor = await this.isMinor(subjectId ?? null)
    const all = await this.providers.idCardCandidates()
    const targets = minor ? all.filter((target) => !this.minorBlockedTarget(target)) : all
    if (!targets.length) throw all.length && minor ? Errors.minorAi(MINOR_AI_MESSAGES.chat) : Errors.unavailable('AI is not switched on here.')
    let last: unknown = Errors.unavailable('AI is not switched on here.')
    for (const target of targets) {
      try {
        const generated = await this.complete(target, {
          task: ID_CARD_CHECK_TASK,
          userId: null,
          private: true,
          prompt: 'id-card-check',
          images: [imageBase64],
          schema: idCardSchema,
          temperature: 0,
          maxTokens: 600,
          subjectId,
        }, minor)
        const confidence = generated.output.confidence > 1 ? Math.min(1, generated.output.confidence / 100) : Math.max(0, generated.output.confidence)
        return { ...generated.output, confidence }
      } catch (e) {
        last = e
        if (e instanceof Error && /budget/i.test(e.message)) throw e
      }
    }
    throw last
  }

  /** One call on an already chosen provider. `ready` still checks the budget, the circuit and private data. */
  private async complete<T>(target: Target, call: GenerateCall<T>, minor = false): Promise<Generated<T>> {
    const route = await this.ready(target, call.userId, call.private)
    const adapter = route.adapter
    const rendered = this.prompts.render(call.prompt, call.vars, call.content)
    const messages: ChatMessage[] = rendered.messages.map((m, i) => (i === rendered.messages.length - 1 && call.images?.length ? { ...m, images: call.images } : m))
    // ID-card extraction must read the document. The child-safety prompt would tell the model not to collect names.
    const safety = minor && call.task !== ID_CARD_CHECK_TASK
    if (safety && messages[0]?.role === 'system') messages[0] = { ...messages[0], content: withChildSafety(messages[0].content, this.childSafetyPrompt()) }
    const schema = call.schema ? (z.toJSONSchema(call.schema) as object) : undefined
    const started = Date.now()
    let promptTokens = 0
    let completionTokens = 0
    const ask = async (msgs: ChatMessage[]) => {
      // A minor's tokens are not written out until the finished answer has passed the filter.
      const res = await this.withRetries(route, () => adapter.chat({ model: route.model, messages: msgs, schema, maxTokens: call.maxTokens, temperature: call.temperature, timeoutMs: this.timeoutMs() }, schema || safety ? undefined : call.onDelta))
      promptTokens += res.promptTokens
      completionTokens += res.completionTokens
      return res.text
    }
    const record = (ok: boolean) =>
      this.record({ userId: call.userId, task: call.task, model: route.model, promptId: rendered.id, promptVersion: rendered.version, promptTokens, completionTokens, ok, started, route })
    try {
      const text = await ask(messages)
      const screened = safety ? this.screen(text, true, call.task) : text
      if (screened !== text) {
        await record(!call.schema)
        if (call.schema) throw Errors.unavailable(screened)
        return { output: screened as T, model: route.model, promptTokens, completionTokens }
      }
      if (!call.schema) {
        await record(true)
        return { output: text as T, model: route.model, promptTokens, completionTokens }
      }
      let parsed = parseAs(call.schema, text)
      if (!parsed.success) {
        // One repair: the model sees its answer and what was wrong with it. A minor's repair is filtered before it is parsed.
        const againRaw = await ask([...messages, { role: 'assistant', content: text }, { role: 'user', content: `That answer does not match the format: ${parsed.problem}. Answer again with JSON only, in the format asked.` }])
        const again = safety ? this.screen(againRaw, true, call.task) : againRaw
        if (again !== againRaw) {
          await record(false)
          throw Errors.unavailable(again)
        }
        parsed = parseAs(call.schema, again)
      }
      if (!parsed.success) {
        await record(false)
        throw Errors.unavailable('The AI’s answer could not be used. Try again.')
      }
      await record(true)
      return { output: parsed.value, model: route.model, promptTokens, completionTokens }
    } catch (e) {
      if (e instanceof ProviderError) {
        await record(false)
        throw Errors.unavailable(failureText(e, route, this.log))
      }
      throw e
    }
  }

  /**
   * The model embeddings come from now (the `EMBED` route, the default embedding connection, else the environment's),
   * or null when none answers.
   */
  async embedModel(): Promise<string | null> {
    const target = await this.providers.forEmbeddings()
    return (await this.statusOf(target)).available ? target!.model : null
  }

  /**
   * Vectors for texts, in order. Every embedding comes from the `EMBED` route's model, so a question and the chunks it
   * is compared with always share one model; `task` only labels the usage (EMBED, EMBED_QUERY).
   */
  async embed(texts: string[], who: { userId: string | null; private: boolean; task?: string; subjectId?: string | null }): Promise<number[][]> {
    if (!texts.length) return []
    const minor = await this.isMinor(who.subjectId ?? who.userId)
    const chosen = await this.providers.guarded('embed', null, this.routePolicy(minor, who.private))
    if (chosen === 'blocked') throw Errors.minorAi(MINOR_AI_MESSAGES.embed)
    const route = await this.ready(chosen, who.userId, who.private)
    const started = Date.now()
    try {
      const res = await this.withRetries(route, () => route.adapter.embed(route.model, texts, this.timeoutMs()))
      await this.record({ userId: who.userId, task: who.task ?? 'EMBED', model: route.model, promptTokens: res.promptTokens, completionTokens: 0, ok: true, started, route })
      return res.vectors
    } catch (e) {
      if (e instanceof ProviderError) {
        await this.record({ userId: who.userId, task: who.task ?? 'EMBED', model: route.model, promptTokens: 0, completionTokens: 0, ok: false, started, route })
        throw Errors.unavailable(failureText(e, route, this.log))
      }
      throw e
    }
  }

  /** The checks before any call; who answers when all pass. */
  private async ready(target: Target | null, userId: string | null, isPrivate: boolean): Promise<Target> {
    const state = await this.statusOf(target)
    if (!state.available || !target) {
      throw Errors.unavailable(
        state.reason === 'BUDGET' ? 'AI is paused until next month: this month’s AI budget is used up.' : state.reason === 'PROVIDER_DOWN' ? 'AI is not answering right now. Try again in a minute.' : 'AI is not switched on here.',
      )
    }
    if (isPrivate && !target.adapter.mayReceivePrivate) throw Errors.unavailable('AI cannot work on private notes here.')
    if (userId) {
      const { usedToday, limitToday } = await this.allowance(userId)
      if (limitToday !== null && usedToday >= limitToday) throw planLimitError(LimitKey.AI_TOKENS_DAILY)
    }
    return target
  }

  /** Under 18, or an age the platform cannot tell. No people binding (unit tests, platform jobs) is an adult. A lookup that throws fails safe as a minor. */
  private async isMinor(userId: string | null | undefined): Promise<boolean> {
    if (!userId || !this.people) return false
    try {
      return await this.people.isMinorForAi(userId)
    } catch (e) {
      this.log.warn(`Could not read the age for AI routing: ${e instanceof Error ? e.name : 'error'}`)
      return true
    }
  }

  private routePolicy(minor: boolean, needsPrivate: boolean): MinorRoutePolicy {
    return { minor, openAiAllowed: minor && this.settings.boolean(OPENAI_ZDR_APPROVED_SETTING, false), needsPrivate }
  }

  private childSafetyPrompt(): string {
    const saved = (this.settings.string(AI_CHILD_SAFETY_PROMPT_SETTING, '') ?? '').trim()
    return saved || CHILD_SAFETY_PROMPT
  }

  /** Replaces a minor's unsafe answer and logs the category only. The text and the person are not logged. */
  private screen(text: string, minor: boolean, task: string): string {
    if (!minor) return text
    const verdict = filterMinorOutput(text)
    if (verdict.ok) return text
    this.log.warn(`AI output for a minor was replaced (${verdict.category}, task ${task})`)
    return verdict.message
  }

  private minorBlockedTarget(target: Target): boolean {
    return blockedForMinor({
      key: '',
      kind: target.adapter.name,
      model: target.model,
      mayReceivePrivate: target.adapter.mayReceivePrivate,
      chats: true,
      embeds: false,
      hears: false,
      google: target.adapter.name === 'GEMINI' || isGeminiModel(target.model),
      openAi: target.adapter.name === 'OPENAI',
    }, this.settings.boolean(OPENAI_ZDR_APPROVED_SETTING, false))
  }

  private async withRetries<R>(target: Target, run: () => Promise<R>): Promise<R> {
    const key = target.connectionId ?? ENVIRONMENT
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await run()
        this.circuits.delete(key)
        return result
      } catch (e) {
        const retry = e instanceof ProviderError && e.retryable && attempt < RETRIES.length
        if (retry) {
          await new Promise((r) => setTimeout(r, RETRIES[attempt]))
          continue
        }
        // UnsupportedInput and any other 4xx are not outages: leave the circuit alone.
        if (e instanceof ProviderError && e.retryable) {
          const circuit = this.circuits.get(key) ?? { failures: 0, openUntil: 0 }
          if (++circuit.failures >= TRIP_AFTER) {
            circuit.openUntil = Date.now() + OPEN_MS
            this.log.warn(`AI provider ${target.adapter.name} failed ${circuit.failures} times in a row: its circuit is open for ${OPEN_MS / 1000} s — ${e.message}`)
          }
          this.circuits.set(key, circuit)
        }
        throw e
      }
    }
  }

  /** An `AiUsage` row: what a call (or a connection test, ADR-0065) used and cost. */
  async record(u: { userId: string | null; task: string; model: string; promptId?: string; promptVersion?: number; promptTokens: number; completionTokens: number; ok: boolean; started: number; route: Target }) {
    const costMicroUsd = Math.round((u.promptTokens * u.route.inPrice + u.completionTokens * u.route.outPrice) / 1_000_000)
    await this.db.aiUsage.create({
      data: { id: newId(), userId: u.userId, task: u.task, provider: u.route.adapter.name, connectionId: u.route.connectionId, model: u.model, promptId: u.promptId ?? null, promptVersion: u.promptVersion ?? null, promptTokens: u.promptTokens, completionTokens: u.completionTokens, costMicroUsd, latencyMs: Date.now() - u.started, ok: u.ok },
    })
    if (this.spend) this.spend.microUsd += costMicroUsd
  }

  /** What AI cost since the start of this UTC month, in millionths of a dollar. */
  async spentThisMonth(): Promise<number> {
    const sum = await this.db.aiUsage.aggregate({ _sum: { costMicroUsd: true }, where: { createdAt: { gte: startOfUtcMonth() } } })
    return sum._sum.costMicroUsd ?? 0
  }

  /** This month's spend against the budget (cached a minute); tells the platform at 80 % and 100 %. */
  private async overBudget(): Promise<boolean> {
    const cap = this.settings.integer('ai_monthly_budget_micro_usd', this.config.monthlyBudgetMicroUsd)
    if (cap === null) return false
    const since = startOfUtcMonth().getTime()
    if (!this.spend || this.spend.since !== since || Date.now() - this.spend.at > BUDGET_CACHE_MS) {
      const sum = await this.db.aiUsage.aggregate({ _sum: { costMicroUsd: true }, where: { createdAt: { gte: new Date(since) } } })
      this.spend = { since, microUsd: sum._sum.costMicroUsd ?? 0, at: Date.now() }
    }
    const percent = cap === 0 ? 100 : (this.spend.microUsd / cap) * 100
    for (const mark of [80, 100]) {
      const key = `${since}:${mark}`
      if (percent >= mark && !this.told.has(key)) {
        this.told.add(key)
        this.log.warn(`AI spend is at ${Math.round(percent)} % of this month's budget`)
        await this.events.publish('AiBudgetThreshold', { percentUsed: Math.round(percent) })
      }
    }
    return this.spend.microUsd >= cap
  }
}

/**
 * What a person (and the failed artifact) is told. An outage stays generic. A permanent 400 is named plainly, with the
 * provider's body left out of the message and the log: it can echo the note.
 */
function failureText(e: ProviderError, target: Target, log: Logger): string {
  if (e instanceof UnsupportedInput) return e.message
  const status = e instanceof HttpProviderError ? e.status : /\b400\b/.test(e.message) ? 400 : 0
  if (!e.retryable && status === 400) {
    log.warn(`AI provider ${target.adapter.name} model ${target.model} rejected the request (HTTP 400): ${MODEL_UNSUPPORTED}`)
    return MODEL_UNSUPPORTED
  }
  return 'AI is not answering right now. Try again in a minute.'
}

/** The answer as JSON of the schema's shape, or what was wrong with it. */
function parseAs<T>(schema: z.ZodType<T>, text: string): { success: true; value: T } | { success: false; problem: string } {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { success: false, problem: 'it is not valid JSON' }
  }
  // Backslashes the model left unescaped (\text read as a tab) are mended before the answer is checked (ADR-0086).
  const result = schema.safeParse(mendAll(json))
  if (result.success) return { success: true, value: result.data }
  return { success: false, problem: result.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'the answer'}: ${i.message}`).join('; ') }
}
