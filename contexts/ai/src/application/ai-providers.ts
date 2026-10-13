import { Inject, Injectable, Logger } from '@nestjs/common'
import { PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { AI_CONFIG, type AiConfig } from '../ai.config'
import { presetOf } from '../domain/catalog'
import type { AiProviderAdapter } from '../domain/provider'
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

/** Settings are read again after this long, so a change on one API instance reaches the others and the worker. */
const STATE_CACHE_MS = 30_000

/**
 * Which provider and model answer each call (ADR-0065). In order: the task's route (its connection, or the default
 * one, with its model and prices); the default connection for chats or for embeddings; the environment's provider.
 * A disabled connection, or one whose key cannot be read, answers nothing.
 */
@Injectable()
export class AiProviders {
  private readonly log = new Logger('AiProviders')
  private cached: { at: number; state: Promise<State> } | null = null

  constructor(
    private readonly db: PrismaService,
    @Inject(AI_CONFIG) private readonly config: AiConfig,
    @Inject(AI_PROVIDER_ADAPTER) private readonly environment: AiProviderAdapter | null,
    private readonly keys: AiKeys,
  ) {}

  /** After a change: read the settings again on the next call. */
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

  /** Who answers a chat for this task (null: the default chat provider), or null when nothing can. */
  async forTask(task: string | null): Promise<Target | null> {
    const state = await this.state()
    const route = task === null ? undefined : state.routes.get(task)
    const via = route && (route.connectionId ? this.usable(state, route.connectionId) : this.defaultChat(state))
    if (route && via) return { connectionId: via.connectionId, adapter: via.adapter, model: route.model, inPrice: route.inputMicroUsdPerMTok, outPrice: route.outputMicroUsdPerMTok }
    return this.defaultChat(state)
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

  private state(): Promise<State> {
    if (this.cached && Date.now() - this.cached.at < STATE_CACHE_MS) return this.cached.state
    const state = this.load()
    this.cached = { at: Date.now(), state }
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
