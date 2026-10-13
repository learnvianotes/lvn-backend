import { Inject, Injectable, Logger } from '@nestjs/common'
import { z } from 'zod'
import { LimitKey } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { ENTITLEMENTS, type Entitlements } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { AI_CONFIG, type AiConfig } from '../ai.config'
import { ProviderError, type AiProviderAdapter, type ChatMessage } from '../domain/provider'
import { PromptLibrary } from './prompts'

/** The provider adapter in use, or null when AI is off (ADR-0058). */
export const AI_PROVIDER_ADAPTER = Symbol('AI_PROVIDER_ADAPTER')

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
  /** Streams the answer's text as it comes (text answers only) */
  onDelta?: (text: string) => void
  maxTokens?: number
  temperature?: number
}

export interface Generated<T> {
  output: T
  model: string
  promptTokens: number
  completionTokens: number
}

const RETRIES = [250, 1000]
/** Consecutive failed calls that open the circuit, and for how long. */
const TRIP_AFTER = 3
const OPEN_MS = 30_000
const BUDGET_CACHE_MS = 60_000
const ROUTE_CACHE_MS = 30_000

const startOfUtcDay = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
const startOfUtcMonth = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

/**
 * Every AI call in the platform goes through here (§10.1, ADR-0058). In order: is AI on and within its monthly
 * budget, is the provider's circuit closed, has the person tokens left today (their plan's AI_TOKENS_DAILY), may this
 * provider see this material;
 * then the task's model, the versioned prompt with people's text fenced, retries, the answer checked against its
 * schema (with one repair), and an `AiUsage` row whatever happened.
 */
@Injectable()
export class AiGateway {
  private readonly log = new Logger('AiGateway')
  private failures = 0
  private openUntil = 0
  private spend: { since: number; microUsd: number; at: number } | null = null
  private told = new Set<string>()
  private routes = new Map<string, { at: number; route: { model: string; inPrice: number; outPrice: number } | null }>()

  constructor(
    private readonly db: PrismaService,
    private readonly prompts: PromptLibrary,
    @Inject(AI_CONFIG) private readonly config: AiConfig,
    @Inject(AI_PROVIDER_ADAPTER) private readonly adapter: AiProviderAdapter | null,
    @Inject(ENTITLEMENTS) private readonly entitlements: Entitlements,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  /** Whether AI answers now, and if not, why. */
  async status(): Promise<{ available: boolean; reason: AiUnavailableReason | null }> {
    if (!this.adapter) return { available: false, reason: 'NOT_CONFIGURED' }
    if (await this.overBudget()) return { available: false, reason: 'BUDGET' }
    if (Date.now() < this.openUntil) return { available: false, reason: 'PROVIDER_DOWN' }
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

  async generate<T = string>(call: GenerateCall<T>): Promise<Generated<T>> {
    const adapter = await this.ready(call.userId, call.private)
    const route = await this.route(call.task, this.config.chatModel)
    const rendered = this.prompts.render(call.prompt, call.vars, call.content)
    const messages: ChatMessage[] = rendered.messages.map((m, i) => (i === rendered.messages.length - 1 && call.images?.length ? { ...m, images: call.images } : m))
    const schema = call.schema ? (z.toJSONSchema(call.schema) as object) : undefined
    const started = Date.now()
    let promptTokens = 0
    let completionTokens = 0
    const ask = async (msgs: ChatMessage[]) => {
      const res = await this.withRetries(() => adapter.chat({ model: route.model, messages: msgs, schema, maxTokens: call.maxTokens, temperature: call.temperature, timeoutMs: this.config.timeoutMs }, schema ? undefined : call.onDelta))
      promptTokens += res.promptTokens
      completionTokens += res.completionTokens
      return res.text
    }
    const record = (ok: boolean) =>
      this.record({ userId: call.userId, task: call.task, model: route.model, promptId: rendered.id, promptVersion: rendered.version, promptTokens, completionTokens, ok, started, route })
    try {
      const text = await ask(messages)
      if (!call.schema) {
        await record(true)
        return { output: text as T, model: route.model, promptTokens, completionTokens }
      }
      let parsed = parseAs(call.schema, text)
      if (!parsed.success) {
        // One repair: the model sees its answer and what was wrong with it.
        const again = await ask([...messages, { role: 'assistant', content: text }, { role: 'user', content: `That answer does not match the format: ${parsed.problem}. Answer again with JSON only, in the format asked.` }])
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
        throw Errors.unavailable('AI is not answering right now. Try again in a minute.')
      }
      throw e
    }
  }

  /** The model embeddings come from now (the `EMBED` route, else the environment's), or null when AI does not answer. */
  async embedModel(): Promise<string | null> {
    if (!(await this.status()).available) return null
    return this.route('EMBED', this.config.embedModel).then((r) => r.model).catch(() => null)
  }

  /**
   * Vectors for texts, in order. Every embedding comes from the `EMBED` route's model, so a question and the chunks it
   * is compared with always share one model; `task` only labels the usage (EMBED, EMBED_QUERY).
   */
  async embed(texts: string[], who: { userId: string | null; private: boolean; task?: string }): Promise<number[][]> {
    if (!texts.length) return []
    const adapter = await this.ready(who.userId, who.private)
    const route = await this.route('EMBED', this.config.embedModel)
    const started = Date.now()
    try {
      const res = await this.withRetries(() => adapter.embed(route.model, texts, this.config.timeoutMs))
      await this.record({ userId: who.userId, task: who.task ?? 'EMBED', model: route.model, promptTokens: res.promptTokens, completionTokens: 0, ok: true, started, route })
      return res.vectors
    } catch (e) {
      if (e instanceof ProviderError) {
        await this.record({ userId: who.userId, task: who.task ?? 'EMBED', model: route.model, promptTokens: 0, completionTokens: 0, ok: false, started, route })
        throw Errors.unavailable('AI is not answering right now. Try again in a minute.')
      }
      throw e
    }
  }

  /** The checks before any call; the adapter when all pass. */
  private async ready(userId: string | null, isPrivate: boolean): Promise<AiProviderAdapter> {
    const state = await this.status()
    if (!state.available || !this.adapter) {
      throw Errors.unavailable(
        state.reason === 'BUDGET' ? 'AI is paused until next month: this month’s AI budget is used up.' : state.reason === 'PROVIDER_DOWN' ? 'AI is not answering right now. Try again in a minute.' : 'AI is not switched on here.',
      )
    }
    if (isPrivate && !this.adapter.mayReceivePrivate) throw Errors.unavailable('AI cannot work on private notes here.')
    if (userId) {
      const { usedToday, limitToday, resetsAt } = await this.allowance(userId)
      if (limitToday !== null && usedToday >= limitToday) throw Errors.rateLimited(Math.ceil((resetsAt.getTime() - Date.now()) / 1000), `You have used today’s AI allowance (${limitToday.toLocaleString('en')} tokens). It renews at midnight UTC.`)
    }
    return this.adapter
  }

  /** The task's model and prices: its row in AiModelRoute, else the environment's default. */
  private async route(task: string, fallback: string | null): Promise<{ model: string; inPrice: number; outPrice: number }> {
    const cached = this.routes.get(task)
    let route = cached && Date.now() - cached.at < ROUTE_CACHE_MS ? cached.route : undefined
    if (route === undefined) {
      const row = await this.db.aiModelRoute.findUnique({ where: { task } })
      route = row ? { model: row.model, inPrice: row.inputMicroUsdPerMTok, outPrice: row.outputMicroUsdPerMTok } : null
      this.routes.set(task, { at: Date.now(), route })
    }
    if (route) return route
    if (!fallback) throw Errors.unavailable('AI is not switched on here.')
    return { model: fallback, inPrice: 0, outPrice: 0 }
  }

  private async withRetries<R>(run: () => Promise<R>): Promise<R> {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await run()
        this.failures = 0
        return result
      } catch (e) {
        const retry = e instanceof ProviderError && e.retryable && attempt < RETRIES.length
        if (retry) {
          await new Promise((r) => setTimeout(r, RETRIES[attempt]))
          continue
        }
        if (e instanceof ProviderError && ++this.failures >= TRIP_AFTER) {
          this.openUntil = Date.now() + OPEN_MS
          this.log.warn(`AI provider failed ${this.failures} times in a row: the circuit is open for ${OPEN_MS / 1000} s — ${e.message}`)
        }
        throw e
      }
    }
  }

  private async record(u: { userId: string | null; task: string; model: string; promptId?: string; promptVersion?: number; promptTokens: number; completionTokens: number; ok: boolean; started: number; route: { inPrice: number; outPrice: number } }) {
    const costMicroUsd = Math.round((u.promptTokens * u.route.inPrice + u.completionTokens * u.route.outPrice) / 1_000_000)
    await this.db.aiUsage.create({
      data: { id: newId(), userId: u.userId, task: u.task, provider: this.adapter!.name, model: u.model, promptId: u.promptId ?? null, promptVersion: u.promptVersion ?? null, promptTokens: u.promptTokens, completionTokens: u.completionTokens, costMicroUsd, latencyMs: Date.now() - u.started, ok: u.ok },
    })
    if (this.spend) this.spend.microUsd += costMicroUsd
  }

  /** This month's spend against the budget (cached a minute); tells the platform at 80 % and 100 %. */
  private async overBudget(): Promise<boolean> {
    const cap = this.config.monthlyBudgetMicroUsd
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

/** The answer as JSON of the schema's shape, or what was wrong with it. */
function parseAs<T>(schema: z.ZodType<T>, text: string): { success: true; value: T } | { success: false; problem: string } {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { success: false, problem: 'it is not valid JSON' }
  }
  const result = schema.safeParse(json)
  if (result.success) return { success: true, value: result.data }
  return { success: false, problem: result.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'the answer'}: ${i.message}`).join('; ') }
}
