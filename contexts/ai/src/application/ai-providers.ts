import { Inject, Injectable, Logger } from '@nestjs/common'
import { PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { AI_CONFIG, type AiConfig } from '../ai.config'
import { presetOf } from '../domain/catalog'
import { isGeminiModel, isGoogleGenerativeUrl, isOpenAiApiUrl } from '../domain/gemini-policy'
import { modelCanHear } from '../domain/model-capabilities'
import { chooseIdCardTargets, ID_CARD_CHECK_TASK, type IdCardRouteTarget } from '../domain/id-card-route'
import { chooseMinorRoute, type AiCapability, type MinorRouteOption, type MinorRoutePolicy } from '../domain/minor-route'
import type { AiProviderAdapter, AiProviderKind } from '../domain/provider'
import { AnthropicProvider } from '../infrastructure/anthropic'
import { OllamaProvider } from '../infrastructure/ollama'
import { OpenAiProvider } from '../infrastructure/openai'
import { AiKeys } from './ai-keys'

/** The environment's provider (AI_PROVIDER, ADR-0058), or null when it is `none`. */
export const AI_PROVIDER_ADAPTER = Symbol('AI_PROVIDER_ADAPTER')

/** Who answers a call: the adapter, the model and its prices (millionths of a dollar per million tokens). */
export interface Target {
  /** The connection; null for the environment's provider */
  connectionId: string | null
  adapter: AiProviderAdapter
  model: string
  inPrice: number
  outPrice: number
}

type Connection = Prisma.AiConnectionGetPayload<object>
type Route = Prisma.AiModelRouteGetPayload<object>

interface State {
  connections: Map<string, { row: Connection; adapter: AiProviderAdapter | null }>
  chat: string | null
  embed: string | null
  routes: Map<string, Route>
}


/**
 * Which provider and model answer each call (ADR-0065). In order: the task's route (its connection, or the default
 * one, with its model and prices); the default connection for chats or for embeddings; the environment's provider.
 * A disabled connection, or one whose key cannot be read, answers nothing. Each call checks the settings' version (one
 * row by its key), so a change made on one API instance reaches the others and the worker at once.
 */
@Injectable()
export class AiProviders {
  private readonly log = new Logger('AiProviders')
  private cached: { version: number; state: Promise<State> } | null = null

  constructor(
    private readonly db: PrismaService,
    @Inject(AI_CONFIG) private readonly config: AiConfig,
    @Inject(AI_PROVIDER_ADAPTER) private readonly environment: AiProviderAdapter | null,
    private readonly keys: AiKeys,
  ) {}

  /** After a change in this process: read the settings again on the next call (the version tells the others). */
  invalidate(): void {
    this.cached = null
  }

  /** The adapter for one saved connection, or null when its key cannot be read. */
  adapterFor(row: Connection): AiProviderAdapter | null {
    const preset = presetOf(row.kind)
    const key = row.apiKeyCipher ? this.keys.open(row.apiKeyCipher) : null
    if (row.apiKeyCipher && key === null) return null
    if (preset.needsKey && !key) return null
    const url = row.baseUrl ?? preset.defaultBaseUrl
    if (!url) return null
    switch (row.kind) {
      case 'ANTHROPIC':
        return new AnthropicProvider(url, key, row.mayReceivePrivate)
      case 'OLLAMA':
        return new OllamaProvider(url, row.mayReceivePrivate)
      default:
        return new OpenAiProvider(row.kind, url, key, row.mayReceivePrivate)
    }
  }

  /**
   * Who transcribes a recording. A TRANSCRIBE route is used as saved, even when that model cannot hear:
   * the caller names it and does not try another. With no route, the default chat model when it can hear,
   * otherwise another enabled connection whose chat model can hear. Null when nothing is configured.
   */
  async transcriptionChoice(): Promise<Target | null> {
    const state = await this.state()
    const route = state.routes.get('TRANSCRIBE')
    if (route) {
      const via = route.connectionId ? this.usable(state, route.connectionId) : this.defaultChat(state)
      if (!via) return null
      return { connectionId: via.connectionId, adapter: via.adapter, model: route.model, inPrice: route.inputMicroUsdPerMTok, outPrice: route.outputMicroUsdPerMTok }
    }
    const chat = this.defaultChat(state)
    if (chat && modelCanHear(chat.model, chat.adapter.name)) return chat
    for (const { row, adapter } of state.connections.values()) {
      if (!row.enabled || !adapter || !row.chatModel || row.chatModel === chat?.model) continue
      if (!modelCanHear(row.chatModel, adapter.name)) continue
      return { connectionId: row.id, adapter, model: row.chatModel, inPrice: row.inputMicroUsdPerMTok, outPrice: row.outputMicroUsdPerMTok }
    }
    return chat
  }

  /** Who answers a chat for this task (null: the default chat provider), or null when nothing can. */
  async forTask(task: string | null): Promise<Target | null> {
    const state = await this.state()
    const route = task === null ? undefined : state.routes.get(task)
    const via = route && (route.connectionId ? this.usable(state, route.connectionId) : this.defaultChat(state))
    if (route && via) return { connectionId: via.connectionId, adapter: via.adapter, model: route.model, inPrice: route.inputMicroUsdPerMTok, outPrice: route.outputMicroUsdPerMTok }
    return this.defaultChat(state)
  }

  /**
   * Who may read an ID card, best first. The image is the only thing sent, so a connection that must not receive
   * private data is never chosen. An admin's `ID_CARD_CHECK` route, when one is saved, is the only candidate, and
   * only when that connection may receive private data. With no route: a private Gemini Flash, then GPT-4o-mini,
   * then any other private chat model.
   */
  async idCardCandidates(): Promise<Target[]> {
    const state = await this.state()
    const saved = state.routes.get(ID_CARD_CHECK_TASK)
    type Choice = IdCardRouteTarget & { target: Target }
    if (saved) {
      const linked = saved.connectionId ? this.usable(state, saved.connectionId) : null
      const via = linked ?? (saved.connectionId ? null : this.defaultChat(state))
      if (!via?.adapter.mayReceivePrivate) return []
      const route: Choice = {
        connectionId: via.connectionId,
        kind: linked?.row.kind ?? this.config.provider,
        model: saved.model,
        mayReceivePrivate: true,
        target: { connectionId: via.connectionId, adapter: via.adapter, model: saved.model, inPrice: saved.inputMicroUsdPerMTok, outPrice: saved.outputMicroUsdPerMTok },
      }
      return chooseIdCardTargets(route, []).map((choice) => choice.target)
    }
    const fallback: Choice[] = []
    for (const { row, adapter } of state.connections.values()) {
      if (!row.enabled || !adapter || !row.chatModel) continue
      fallback.push({
        connectionId: row.id,
        kind: row.kind,
        model: row.chatModel,
        mayReceivePrivate: adapter.mayReceivePrivate,
        target: { connectionId: row.id, adapter, model: row.chatModel, inPrice: row.inputMicroUsdPerMTok, outPrice: row.outputMicroUsdPerMTok },
      })
    }
    if (this.environment && this.config.chatModel) {
      fallback.push({
        connectionId: null,
        kind: this.config.provider,
        model: this.config.chatModel,
        mayReceivePrivate: this.environment.mayReceivePrivate,
        target: { connectionId: null, adapter: this.environment, model: this.config.chatModel, inPrice: 0, outPrice: 0 },
      })
    }
    return chooseIdCardTargets(null, fallback).map((choice) => choice.target)
  }

  /**
   * The target a call may use. Adults receive the ordinary choice. A minor is moved off OpenAI (unless
   * `openai_zdr_approved`) and off Gemini onto Anthropic, then a local model, when one can do the job.
   * `'blocked'` means the ordinary choice was unsafe and nothing else can do it: the caller must not send the content.
   */
  async guarded(kind: 'task' | 'embed' | 'transcribe', task: string | null, policy: MinorRoutePolicy): Promise<Target | 'blocked' | null> {
    const capability: AiCapability = kind === 'task' ? 'chat' : kind
    const preferred = kind === 'embed' ? await this.forEmbeddings() : kind === 'transcribe' ? await this.transcriptionChoice() : await this.forTask(task)
    if (!policy.minor) return preferred
    if (!preferred) return null
    const built = this.routeOptions(await this.state(), preferred, capability)
    const decision = chooseMinorRoute(built.preferredKey, built.options, capability, policy)
    if (decision.action === 'missing') return null
    if (decision.action === 'blocked') return 'blocked'
    return built.targets.get(decision.key) ?? 'blocked'
  }

  /** Who makes embeddings: the EMBED route, the default embedding connection, else the environment's provider. */
  async forEmbeddings(): Promise<Target | null> {
    const state = await this.state()
    const route = state.routes.get('EMBED')
    const via = route && (route.connectionId ? this.usable(state, route.connectionId) : this.defaultEmbed(state))
    if (route && via) return { connectionId: via.connectionId, adapter: via.adapter, model: route.model, inPrice: route.inputMicroUsdPerMTok, outPrice: 0 }
    return this.defaultEmbed(state)
  }

  private defaultChat(state: State): Target | null {
    const chosen = state.chat ? this.usable(state, state.chat) : null
    if (chosen?.row.chatModel) return { connectionId: chosen.connectionId, adapter: chosen.adapter, model: chosen.row.chatModel, inPrice: chosen.row.inputMicroUsdPerMTok, outPrice: chosen.row.outputMicroUsdPerMTok }
    if (this.environment && this.config.chatModel) return { connectionId: null, adapter: this.environment, model: this.config.chatModel, inPrice: 0, outPrice: 0 }
    return null
  }

  private defaultEmbed(state: State): Target | null {
    const chosen = state.embed ? this.usable(state, state.embed) : null
    if (chosen?.row.embedModel) return { connectionId: chosen.connectionId, adapter: chosen.adapter, model: chosen.row.embedModel, inPrice: chosen.row.embedMicroUsdPerMTok, outPrice: 0 }
    if (this.environment && this.config.embedModel) return { connectionId: null, adapter: this.environment, model: this.config.embedModel, inPrice: 0, outPrice: 0 }
    return null
  }

  private usable(state: State, id: string): { connectionId: string; row: Connection; adapter: AiProviderAdapter } | null {
    const c = state.connections.get(id)
    return c?.row.enabled && c.adapter ? { connectionId: id, row: c.row, adapter: c.adapter } : null
  }

  /** The preferred call, plus every other enabled chat or embedding model a minor can be moved to. */
  private routeOptions(state: State, preferred: Target, capability: AiCapability): { preferredKey: string; options: MinorRouteOption[]; targets: Map<string, Target> } {
    const targets = new Map<string, Target>()
    const options: MinorRouteOption[] = []
    const add = (key: string, option: Omit<MinorRouteOption, 'key'>, target: Target) => {
      if (targets.has(key)) return
      targets.set(key, target)
      options.push({ key, ...option })
    }
    const rowOf = (id: string | null) => (id ? state.connections.get(id)?.row ?? null : null)
    const preferredKey = preferred.connectionId ? `picked:${preferred.connectionId}:${preferred.model}` : `picked:env:${preferred.model}`
    add(preferredKey, this.optionOf(preferred.adapter.name, preferred.model, preferred.adapter.mayReceivePrivate, rowOf(preferred.connectionId)?.baseUrl ?? null, capability), preferred)
    for (const { row, adapter } of state.connections.values()) {
      if (!row.enabled || !adapter) continue
      if (row.chatModel) {
        add(`chat:${row.id}:${row.chatModel}`, this.optionOf(adapter.name, row.chatModel, adapter.mayReceivePrivate, row.baseUrl, 'chat'), {
          connectionId: row.id, adapter, model: row.chatModel, inPrice: row.inputMicroUsdPerMTok, outPrice: row.outputMicroUsdPerMTok,
        })
      }
      if (row.embedModel) {
        add(`embed:${row.id}:${row.embedModel}`, this.optionOf(adapter.name, row.embedModel, adapter.mayReceivePrivate, row.baseUrl, 'embed'), {
          connectionId: row.id, adapter, model: row.embedModel, inPrice: row.embedMicroUsdPerMTok, outPrice: 0,
        })
      }
    }
    if (this.environment && this.config.chatModel) {
      add(`chat:env:${this.config.chatModel}`, this.optionOf(this.environment.name, this.config.chatModel, this.environment.mayReceivePrivate, this.config.ollama?.url ?? null, 'chat'), {
        connectionId: null, adapter: this.environment, model: this.config.chatModel, inPrice: 0, outPrice: 0,
      })
    }
    if (this.environment && this.config.embedModel) {
      add(`embed:env:${this.config.embedModel}`, this.optionOf(this.environment.name, this.config.embedModel, this.environment.mayReceivePrivate, this.config.ollama?.url ?? null, 'embed'), {
        connectionId: null, adapter: this.environment, model: this.config.embedModel, inPrice: 0, outPrice: 0,
      })
    }
    return { preferredKey, options, targets }
  }

  private optionOf(kind: AiProviderKind, model: string, mayReceivePrivate: boolean, baseUrl: string | null, capability: AiCapability): Omit<MinorRouteOption, 'key'> {
    const google = kind === 'GEMINI' || isGoogleGenerativeUrl(baseUrl) || isGeminiModel(model)
    return {
      kind,
      model,
      mayReceivePrivate,
      chats: capability !== 'embed',
      embeds: capability === 'embed',
      hears: capability === 'transcribe' || modelCanHear(model, kind),
      google,
      openAi: kind === 'OPENAI' || isOpenAiApiUrl(baseUrl),
    }
  }

  private async state(): Promise<State> {
    const row = await this.db.aiSettings.findUnique({ where: { id: 1 }, select: { version: true } })
    const version = row?.version ?? 0
    if (this.cached && this.cached.version === version) return this.cached.state
    const state = this.load()
    this.cached = { version, state }
    state.catch(() => (this.cached = null))
    return state
  }

  private async load(): Promise<State> {
    const [connections, settings, routes] = await Promise.all([this.db.aiConnection.findMany(), this.db.aiSettings.findUnique({ where: { id: 1 } }), this.db.aiModelRoute.findMany()])
    const built = new Map(
      connections.map((row) => {
        const adapter = this.adapterFor(row)
        if (row.enabled && !adapter) this.log.warn(`AI connection "${row.label}" cannot answer: its key is missing or cannot be read (AI_KEYS_SECRET), or it has no address`)
        return [row.id, { row, adapter }] as const
      }),
    )
    return { connections: built, chat: settings?.chatConnectionId ?? null, embed: settings?.embedConnectionId ?? null, routes: new Map(routes.map((r) => [r.task, r])) }
  }
}
