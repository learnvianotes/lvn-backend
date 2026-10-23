import { EMBEDDING_DIMENSIONS, HttpProviderError, mediaTypeOf, normalized, ProviderError, type AiProviderAdapter, type ChatMessage, type ChatRequest, type ChatResult, type EmbedResult } from '../domain/provider'
import { callProvider, serverSentEvents } from './http'

type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } } | { type: 'input_audio'; input_audio: { data: string; format: 'wav' } }

interface Completion {
  choices?: { message?: { content?: string | null }; delta?: { content?: string | null } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null
  error?: { message?: string }
}

/** A guard against a server that never stops saying there are more models. Not a cap on the list. */
const MAX_MODEL_PAGES = 500

const toMessage = (m: ChatMessage): { role: string; content: string | Part[] } => {
  if (!m.images?.length) return { role: m.role, content: m.content }
  const parts: Part[] = [{ type: 'text', text: m.content }]
  for (const data of m.images) {
    const type = mediaTypeOf(data)
    parts.push(type === 'audio/wav' ? { type: 'input_audio', input_audio: { data, format: 'wav' } } : { type: 'image_url', image_url: { url: `data:${type};base64,${data}` } })
  }
  return { role: m.role, content: parts }
}

/** The provider refused an option some of its models do not take (a reasoning model's temperature, say). */
const refused = (e: unknown, option: string) => e instanceof HttpProviderError && e.status === 400 && e.body.includes(option)

/**
 * OpenAI's Chat Completions and Embeddings API (ADR-0065), spoken by OpenAI, by Gemini's OpenAI-compatible endpoint and
 * by any compatible server: a LiteLLM proxy, OpenRouter, vLLM, Ollama's /v1… Structured answers use `response_format`
 * with the JSON schema; pictures go as data URLs and recordings as `input_audio`. Embeddings are asked for 768
 * numbers and scaled to length 1.
 */
export class OpenAiProvider implements AiProviderAdapter {
  constructor(
    readonly name: 'OPENAI' | 'GEMINI' | 'OPENAI_COMPATIBLE',
    private readonly baseUrl: string,
    private readonly apiKey: string | null,
    readonly mayReceivePrivate: boolean,
  ) {}

  async chat(request: ChatRequest, onDelta?: (text: string) => void): Promise<ChatResult> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages.map(toMessage),
      stream: !!onDelta,
      ...(onDelta ? { stream_options: { include_usage: true } } : {}),
      ...(request.schema ? { response_format: { type: 'json_schema', json_schema: { name: 'answer', schema: request.schema, strict: false } } } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      // OpenAI's reasoning models take only max_completion_tokens; compatible servers know max_tokens.
      ...(request.maxTokens ? { [this.name === 'OPENAI' ? 'max_completion_tokens' : 'max_tokens']: request.maxTokens } : {}),
    }
    const res = await this.send(body, request.schema, request.timeoutMs)
    if (!onDelta) {
      const json = (await res.json()) as Completion
      if (json.error) throw new ProviderError(`${this.name}: ${json.error.message ?? 'error'}`, false)
      return { text: json.choices?.[0]?.message?.content ?? '', promptTokens: json.usage?.prompt_tokens ?? 0, completionTokens: json.usage?.completion_tokens ?? 0 }
    }
    let text = ''
    let usage: Completion['usage'] = null
    for await (const data of serverSentEvents(res)) {
      if (data === '[DONE]') break
      const part = JSON.parse(data) as Completion
      if (part.error) throw new ProviderError(`${this.name}: ${part.error.message ?? 'error'}`, false)
      const piece = part.choices?.[0]?.delta?.content ?? ''
      if (piece) {
        text += piece
        onDelta(piece)
      }
      if (part.usage) usage = part.usage
    }
    return { text, promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0 }
  }

  async embed(model: string, inputs: string[], timeoutMs: number): Promise<EmbedResult> {
    const body: Record<string, unknown> = { model, input: inputs, encoding_format: 'float', dimensions: EMBEDDING_DIMENSIONS }
    let res: Response
    try {
      res = await this.post('/embeddings', body, timeoutMs)
    } catch (e) {
      // A model with one fixed size (or a server that does not pass the option on): ask without it, check the size.
      if (!refused(e, 'dimensions')) throw e
      delete body.dimensions
      res = await this.post('/embeddings', body, timeoutMs)
    }
    const json = (await res.json()) as { data?: { embedding: number[]; index: number }[]; usage?: { prompt_tokens?: number }; error?: { message?: string } }
    if (json.error || !json.data) throw new ProviderError(`${this.name}: ${json.error?.message ?? 'no embeddings'}`, false)
    const vectors = [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding)
    const size = vectors[0]?.length ?? EMBEDDING_DIMENSIONS
    if (size !== EMBEDDING_DIMENSIONS) throw new ProviderError(`${model} gives ${size} numbers per text; LearnViaNotes stores ${EMBEDDING_DIMENSIONS}. Choose a model that can give ${EMBEDDING_DIMENSIONS}.`, false)
    return { vectors: vectors.map(normalized), promptTokens: json.usage?.prompt_tokens ?? 0 }
  }

  /**
   * Every model the account lists. One response is the whole list when the server says so; when it sets `has_more`,
   * the next page is `after` the last id. There is no cap on how many ids come back (the page limit only stops a
   * server that never says it is done).
   */
  async models(timeoutMs: number): Promise<string[]> {
    const ids: string[] = []
    const seen = new Set<string>()
    let after: string | null = null
    for (let page = 0; page < MAX_MODEL_PAGES; page++) {
      const path = after ? `/models?after=${encodeURIComponent(after)}` : '/models'
      const res = await callProvider(this.name, this.url(path), this.headers(), {}, timeoutMs, 'GET')
      const json = (await res.json()) as { data?: { id: string }[]; has_more?: boolean; last_id?: string | null }
      const pageIds = (json.data ?? []).map((m) => m.id.replace(/^models\//, ''))
      let added = 0
      for (const id of pageIds) {
        if (seen.has(id)) continue
        seen.add(id)
        ids.push(id)
        added++
      }
      if (!json.has_more) break
      const next = json.last_id ?? pageIds.at(-1) ?? null
      if (!next || next === after || added === 0) break
      after = next
    }
    return ids.sort()
  }

  /**
   * Any model the account lists can answer: one that refuses `temperature` (a reasoning model) is asked again without
   * it, and one that takes no JSON schema (an older or smaller model) is asked for JSON with the schema in its
   * instructions; the gateway checks the answer against the schema either way.
   */
  private async send(body: Record<string, unknown>, schema: object | undefined, timeoutMs: number): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.post('/chat/completions', body, timeoutMs)
      } catch (e) {
        if (attempt >= 2) throw e
        if (refused(e, 'temperature') && body.temperature !== undefined) {
          delete body.temperature
          continue
        }
        if (schema && (refused(e, 'json_schema') || refused(e, 'response_format')) && (body.response_format as { type?: string } | undefined)?.type === 'json_schema') {
          body.response_format = { type: 'json_object' }
          body.messages = [{ role: 'system', content: `Answer with JSON only, matching this JSON schema: ${JSON.stringify(schema)}` }, ...(body.messages as object[])]
          continue
        }
        throw e
      }
    }
  }

  private url(path: string) {
    return `${this.baseUrl.replace(/\/+$/, '')}${path}`
  }

  private headers(): Record<string, string> {
    return this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}
  }

  private post(path: string, body: object, timeoutMs: number) {
    return callProvider(this.name, this.url(path), this.headers(), body, timeoutMs)
  }
}
