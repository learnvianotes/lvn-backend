import { Inject, Injectable } from '@nestjs/common'
import { GlobalRole } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { AUDIT, POLICY, type Audit, type Policy } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { AI_CONFIG, type AiConfig } from '../ai.config'
import { presetOf, PROVIDER_PRESETS, ROUTABLE_TASKS } from '../domain/catalog'
import { classifyModels, rejectionFor, useForTask, type AiModelUse } from '../domain/model-capabilities'
import { ProviderError, type AiProviderAdapter, type AiProviderKind } from '../domain/provider'
import { AiGateway } from './ai-gateway'
import { AiKeys } from './ai-keys'
import { AI_PROVIDER_ADAPTER, AiProviders, type Target } from './ai-providers'

export interface ConnectionInput {
  id?: string | null
  kind: AiProviderKind
  label: string
  baseUrl?: string | null
  /** Empty or absent: keep the saved key */
  apiKey?: string | null
  clearApiKey?: boolean | null
  mayReceivePrivate: boolean
  enabled: boolean
  chatModel?: string | null
  embedModel?: string | null
  inputMicroUsdPerMTok?: number | null
  outputMicroUsdPerMTok?: number | null
  embedMicroUsdPerMTok?: number | null
}

export interface RouteInput {
  task: string
  connectionId?: string | null
  model: string
  inputMicroUsdPerMTok?: number | null
  outputMicroUsdPerMTok?: number | null
}

/** A connection as platform admins see it: never its key, only whether there is one and its last four characters. */
const view = (c: Prisma.AiConnectionGetPayload<object>) => ({
  id: c.id,
  kind: c.kind,
  label: c.label,
  baseUrl: c.baseUrl,
  hasKey: !!c.apiKeyCipher,
  keyHint: c.apiKeyHint,
  mayReceivePrivate: c.mayReceivePrivate,
  enabled: c.enabled,
  chatModel: c.chatModel,
  embedModel: c.embedModel,
  inputMicroUsdPerMTok: c.inputMicroUsdPerMTok,
  outputMicroUsdPerMTok: c.outputMicroUsdPerMTok,
  embedMicroUsdPerMTok: c.embedMicroUsdPerMTok,
  updatedAt: c.updatedAt,
})

const MAX_PRICE = 1_000_000_000
const TEST_TIMEOUT_MS = 30_000
const trimmed = (s: string | null | undefined) => (s?.trim() ? s.trim() : null)

/**
 * The AI providers page (ADR-0065), for platform admins: connections to Claude, ChatGPT, Gemini, an OpenAI-compatible
 * server (a LiteLLM proxy…) or an Ollama; which answers by default for chats and for embeddings; each task's route;
 * and a test that asks the provider for one word, one embedding and its models. Every change is audited (without
 * keys) and reaches every process on its next call.
 */
@Injectable()
export class AiSettingsService {
  constructor(
    private readonly db: PrismaService,
    private readonly providers: AiProviders,
    private readonly keys: AiKeys,
    private readonly gateway: AiGateway,
    @Inject(AI_CONFIG) private readonly config: AiConfig,
    @Inject(AI_PROVIDER_ADAPTER) private readonly environment: AiProviderAdapter | null,
    @Inject(POLICY) private readonly policy: Policy,
    @Inject(AUDIT) private readonly audit: Audit,
  ) {}

  async settings(adminId: string) {
    await this.assertAdmin(adminId)
    const [connections, settings, routes, spent] = await Promise.all([
      this.db.aiConnection.findMany({ orderBy: { createdAt: 'asc' } }),
      this.db.aiSettings.findUnique({ where: { id: 1 } }),
      this.db.aiModelRoute.findMany({ orderBy: { task: 'asc' } }),
      this.gateway.spentThisMonth(),
    ])
    return {
      connections: connections.map(view),
      chatConnectionId: settings?.chatConnectionId ?? null,
      embedConnectionId: settings?.embedConnectionId ?? null,
      environment: { kind: this.environment?.name ?? null, chatModel: this.environment ? this.config.chatModel : null, embedModel: this.environment ? this.config.embedModel : null },
      routes: routes.map((r) => ({ task: r.task, connectionId: r.connectionId, model: r.model, inputMicroUsdPerMTok: r.inputMicroUsdPerMTok, outputMicroUsdPerMTok: r.outputMicroUsdPerMTok })),
      tasks: ROUTABLE_TASKS,
      presets: PROVIDER_PRESETS,
      keysCanBeSaved: this.keys.available,
      spentThisMonthMicroUsd: spent,
      monthlyBudgetMicroUsd: this.config.monthlyBudgetMicroUsd,
    }
  }

  async saveConnection(adminId: string, input: ConnectionInput) {
    await this.assertAdmin(adminId)
    const preset = PROVIDER_PRESETS.find((p) => p.kind === input.kind)
    if (!preset) throw Errors.validation('Choose a kind of provider.', ['input', 'kind'])
    const existing = input.id ? await this.db.aiConnection.findUnique({ where: { id: input.id } }) : null
    if (input.id && !existing) throw Errors.notFound('This connection no longer exists.')
    if (existing && existing.kind !== input.kind) throw Errors.validation('A connection keeps its kind; add a new one for another provider.', ['input', 'kind'])
    const label = input.label.trim()
    if (!label || label.length > 60) throw Errors.validation('Give the connection a name of at most 60 characters.', ['input', 'label'])
    const baseUrl = trimmed(input.baseUrl)
    if (baseUrl && !/^https?:\/\/[^\s/]+/.test(baseUrl)) throw Errors.validation('The address starts with http:// or https://.', ['input', 'baseUrl'])
    if (!baseUrl && !preset.defaultBaseUrl) throw Errors.validation(`${preset.name} needs an address, such as ${input.kind === 'OLLAMA' ? 'http://gpu-host:11434' : 'http://litellm:4000/v1'}.`, ['input', 'baseUrl'])
    const apiKey = trimmed(input.apiKey)
    if (apiKey && !this.keys.available) throw Errors.unavailable('Keys cannot be saved here: set AI_KEYS_SECRET on the API and the worker first.')
    if (apiKey && apiKey.length > 500) throw Errors.validation('That key is too long.', ['input', 'apiKey'])
    const keyAfter = apiKey ? true : input.clearApiKey ? false : !!existing?.apiKeyCipher
    if (preset.needsKey && !keyAfter) throw Errors.validation(`${preset.name} needs an API key.`, ['input', 'apiKey'])
    const chatModel = trimmed(input.chatModel)
    const embedModel = trimmed(input.embedModel)
    for (const [field, model] of [['chatModel', chatModel], ['embedModel', embedModel]] as const) if (model && model.length > 200) throw Errors.validation('That model name is too long.', ['input', field])
    if (embedModel && !preset.canEmbed) throw Errors.validation(`${preset.name} has no embeddings: leave the embedding model empty.`, ['input', 'embedModel'])
    rejectUnlessSupported(chatModel, input.kind, 'CHAT', 'chatModel')
    rejectUnlessSupported(embedModel, input.kind, 'EMBEDDING', 'embedModel')
    const prices = { inputMicroUsdPerMTok: price(input.inputMicroUsdPerMTok, 'inputMicroUsdPerMTok'), outputMicroUsdPerMTok: price(input.outputMicroUsdPerMTok, 'outputMicroUsdPerMTok'), embedMicroUsdPerMTok: price(input.embedMicroUsdPerMTok, 'embedMicroUsdPerMTok') }
    const key = apiKey ? { apiKeyCipher: this.keys.seal(apiKey), apiKeyHint: apiKey.slice(-4) } : input.clearApiKey ? { apiKeyCipher: null, apiKeyHint: null } : {}
    const data = { label, baseUrl, mayReceivePrivate: input.mayReceivePrivate, enabled: input.enabled, chatModel, embedModel, ...prices, ...key }
    const saved = existing ? await this.db.aiConnection.update({ where: { id: existing.id }, data }) : await this.db.aiConnection.create({ data: { id: newId(), kind: input.kind, ...data } })
    await this.audit.record({ actorId: adminId, action: 'ai.connection.saved', targetType: 'AiConnection', targetId: saved.id, metadata: { kind: saved.kind, label, enabled: saved.enabled, mayReceivePrivate: saved.mayReceivePrivate, keyChanged: !!apiKey || !!input.clearApiKey } })
    await this.changed()
    return view(saved)
  }

  async deleteConnection(adminId: string, id: string) {
    await this.assertAdmin(adminId)
    const existing = await this.db.aiConnection.findUnique({ where: { id } })
    if (!existing) throw Errors.notFound('This connection no longer exists.')
    // Routes through it fall back to the default connection; defaults that were it fall back to the environment.
    await this.db.aiConnection.delete({ where: { id } })
    await this.audit.record({ actorId: adminId, action: 'ai.connection.deleted', targetType: 'AiConnection', targetId: id, metadata: { kind: existing.kind, label: existing.label } })
    await this.changed()
    return this.settings(adminId)
  }

  async setDefaults(adminId: string, input: { chatConnectionId?: string | null; embedConnectionId?: string | null }) {
    await this.assertAdmin(adminId)
    const chat = input.chatConnectionId ? await this.db.aiConnection.findUnique({ where: { id: input.chatConnectionId } }) : null
    const embed = input.embedConnectionId ? await this.db.aiConnection.findUnique({ where: { id: input.embedConnectionId } }) : null
    if (input.chatConnectionId && !chat) throw Errors.notFound('That connection no longer exists.')
    if (input.embedConnectionId && !embed) throw Errors.notFound('That connection no longer exists.')
    if (chat && !chat.chatModel) throw Errors.validation('Give that connection a chat model first.', ['input', 'chatConnectionId'])
    if (embed && !embed.embedModel) throw Errors.validation('Give that connection an embedding model first.', ['input', 'embedConnectionId'])
    const data = { chatConnectionId: chat?.id ?? null, embedConnectionId: embed?.id ?? null }
    await this.db.aiSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data })
    await this.audit.record({ actorId: adminId, action: 'ai.defaults.changed', targetType: 'AiSettings', metadata: { chat: chat?.label ?? null, embed: embed?.label ?? null } })
    await this.changed()
    return this.settings(adminId)
  }

  async saveRoute(adminId: string, input: RouteInput) {
    await this.assertAdmin(adminId)
    if (!ROUTABLE_TASKS.includes(input.task)) throw Errors.validation('There is no such task.', ['input', 'task'])
    const model = input.model.trim()
    if (!model || model.length > 200) throw Errors.validation('Name the model that answers this task.', ['input', 'model'])
    const connection = input.connectionId ? await this.db.aiConnection.findUnique({ where: { id: input.connectionId } }) : null
    if (input.connectionId && !connection) throw Errors.notFound('That connection no longer exists.')
    if (connection && input.task === 'EMBED' && !presetOf(connection.kind).canEmbed) throw Errors.validation(`${presetOf(connection.kind).name} has no embeddings.`, ['input', 'connectionId'])
    if (connection && input.task === 'TRANSCRIBE' && !presetOf(connection.kind).canHear) throw Errors.validation(`${presetOf(connection.kind).name} cannot hear recordings.`, ['input', 'connectionId'])
    if (connection) rejectUnlessSupported(model, connection.kind, useForTask(input.task), 'model')
    const data = { connectionId: connection?.id ?? null, model, inputMicroUsdPerMTok: price(input.inputMicroUsdPerMTok, 'inputMicroUsdPerMTok'), outputMicroUsdPerMTok: price(input.outputMicroUsdPerMTok, 'outputMicroUsdPerMTok') }
    await this.db.aiModelRoute.upsert({ where: { task: input.task }, create: { task: input.task, ...data }, update: data })
    await this.audit.record({ actorId: adminId, action: 'ai.route.saved', targetType: 'AiModelRoute', metadata: { task: input.task, connection: connection?.label ?? null, model } })
    await this.changed()
    return this.settings(adminId)
  }

  async deleteRoute(adminId: string, task: string) {
    await this.assertAdmin(adminId)
    await this.db.aiModelRoute.deleteMany({ where: { task } })
    await this.audit.record({ actorId: adminId, action: 'ai.route.deleted', targetType: 'AiModelRoute', metadata: { task } })
    await this.changed()
    return this.settings(adminId)
  }

  /**
   * Every model the connection's account lists, plus the select for each use. The full list drops nothing. A picker
   * lists only models this app can call for that use. Empty when the provider lists none or the call fails.
   */
  async listModels(adminId: string, id: string) {
    await this.assertAdmin(adminId)
    const row = await this.db.aiConnection.findUnique({ where: { id } })
    if (!row) throw Errors.notFound('This connection no longer exists.')
    const adapter = this.providers.adapterFor(row)
    const ids = adapter?.models ? await adapter.models(TEST_TIMEOUT_MS).catch(() => [] as string[]) : []
    return classifyModels(ids, row.kind)
  }

  /**
   * Asks the provider for one word with the chat model, one embedding with the embedding model (it must have 768
   * numbers) and the models the account lists. The calls are recorded as CONNECTION_TEST, as the platform's.
   */
  async testConnection(adminId: string, id: string): Promise<{ ok: boolean; message: string; latencyMs: number; models: string[] }> {
    await this.assertAdmin(adminId)
    const row = await this.db.aiConnection.findUnique({ where: { id } })
    if (!row) throw Errors.notFound('This connection no longer exists.')
    const adapter = this.providers.adapterFor(row)
    if (!adapter) return { ok: false, message: row.apiKeyCipher && !this.keys.available ? 'Its key cannot be read: AI_KEYS_SECRET is not set.' : row.apiKeyCipher ? 'Its key cannot be read: AI_KEYS_SECRET changed since it was saved. Enter the key again.' : 'It needs an API key.', latencyMs: 0, models: [] }
    const started = Date.now()
    const done: string[] = []
    const models = adapter.models ? await adapter.models(TEST_TIMEOUT_MS).catch(() => [] as string[]) : []
    try {
      if (row.chatModel) {
        const target: Target = { connectionId: row.id, adapter, model: row.chatModel, inPrice: row.inputMicroUsdPerMTok, outPrice: row.outputMicroUsdPerMTok }
        const at = Date.now()
        const res = await adapter.chat({ model: row.chatModel, messages: [{ role: 'user', content: 'Reply with the single word OK.' }], timeoutMs: TEST_TIMEOUT_MS })
        await this.gateway.record({ userId: null, task: 'CONNECTION_TEST', model: row.chatModel, promptTokens: res.promptTokens, completionTokens: res.completionTokens, ok: true, started: at, route: target })
        done.push(`${row.chatModel} answered “${res.text.trim().slice(0, 40)}”`)
      }
      if (row.embedModel) {
        const target: Target = { connectionId: row.id, adapter, model: row.embedModel, inPrice: row.embedMicroUsdPerMTok, outPrice: 0 }
        const at = Date.now()
        const res = await adapter.embed(row.embedModel, ['LearnViaNotes'], TEST_TIMEOUT_MS)
        await this.gateway.record({ userId: null, task: 'CONNECTION_TEST', model: row.embedModel, promptTokens: res.promptTokens, completionTokens: 0, ok: true, started: at, route: target })
        done.push(`${row.embedModel} gave ${res.vectors[0]?.length ?? 0} numbers`)
      }
    } catch (e) {
      const message = e instanceof ProviderError ? e.message : (e as Error).message
      return { ok: false, message: `${done.length ? `${done.join('; ')}; then ` : ''}${message}`, latencyMs: Date.now() - started, models }
    }
    if (!done.length) return { ok: models.length > 0, message: models.length ? `Reached it: ${models.length} models listed. Choose a chat or embedding model to try them.` : 'Choose a chat or embedding model to try.', latencyMs: Date.now() - started, models }
    return { ok: true, message: `${done.join('; ')}.`, latencyMs: Date.now() - started, models }
  }

  /** Every process reads the settings again on its next call (AiProviders checks the version). */
  private async changed() {
    await this.db.aiSettings.upsert({ where: { id: 1 }, create: { id: 1, version: 1 }, update: { version: { increment: 1 } } })
    this.providers.invalidate()
  }

  private async assertAdmin(userId: string) {
    const actor = await this.policy.actor(userId)
    if (actor?.globalRole !== GlobalRole.PLATFORM_ADMIN) throw Errors.forbidden('Only platform admins choose AI providers.')
  }
}

function rejectUnlessSupported(model: string | null, provider: AiProviderKind, use: AiModelUse, field: string) {
  if (!model) return
  const reason = rejectionFor(model, provider, use)
  if (reason) throw Errors.validation(reason, ['input', field])
}

function price(value: number | null | undefined, field: string): number {
  if (value === null || value === undefined) return 0
  if (!Number.isInteger(value) || value < 0 || value > MAX_PRICE) throw Errors.validation('A price is a whole number of millionths of a dollar per million tokens, at least 0.', ['input', field])
  return value
}
