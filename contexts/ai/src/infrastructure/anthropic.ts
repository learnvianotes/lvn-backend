import { HttpProviderError, mediaTypeOf, ProviderError, UnsupportedInput, type AiProviderAdapter, type ChatMessage, type ChatRequest, type ChatResult, type EmbedResult } from '../domain/provider'
import { callProvider, serverSentEvents } from './http'

type Block = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

interface Message {
  content?: ({ type: 'text'; text: string } | { type: 'tool_use'; name: string; input: unknown })[]
  usage?: { input_tokens?: number; output_tokens?: number }
}

interface StreamEvent {
  type: string
  message?: { usage?: { input_tokens?: number } }
  delta?: { type?: string; text?: string }
  usage?: { output_tokens?: number }
  error?: { type?: string; message?: string }
}

/** Long enough for the longest task (a revision sheet, new notes); a call may ask for less. */
const DEFAULT_MAX_TOKENS = 8192
const ANSWER_TOOL = 'answer'

const toMessage = (m: ChatMessage): { role: string; content: string | Block[] } => {
  if (!m.images?.length) return { role: m.role, content: m.content }
  const blocks: Block[] = [{ type: 'text', text: m.content }]
  for (const data of m.images) {
    const type = mediaTypeOf(data)
    if (type === 'audio/wav') throw new UnsupportedInput('The AI chosen here cannot hear recordings.')
    blocks.push({ type: 'image', source: { type: 'base64', media_type: type, data } })
  }
  return { role: m.role, content: blocks }
}

/**
 * Anthropic's Messages API (ADR-0065). A structured answer is the input of one tool the model must call, whose input
 * schema is the answer's JSON schema (a schema that is not an object is wrapped in one); text answers stream. Claude
 * has no embeddings and does not take recordings.
 */
export class AnthropicProvider implements AiProviderAdapter {
  readonly name = 'ANTHROPIC'

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string | null,
    readonly mayReceivePrivate: boolean,
  ) {}

  async chat(request: ChatRequest, onDelta?: (text: string) => void): Promise<ChatResult> {
    const system = request.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
    const wrapped = !!request.schema && (request.schema as { type?: unknown }).type !== 'object'
    const schema = request.schema && (wrapped ? { type: 'object', properties: { answer: request.schema }, required: ['answer'] } : request.schema)
    const stream = !!onDelta && !schema
    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(system ? { system } : {}),
      messages: request.messages.filter((m) => m.role !== 'system').map(toMessage),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(schema ? { tools: [{ name: ANSWER_TOOL, description: 'Give the answer in the required format.', input_schema: schema }], tool_choice: { type: 'tool', name: ANSWER_TOOL } } : {}),
      stream,
    }
    let res: Response
    try {
      res = await this.post('/v1/messages', body, request.timeoutMs)
    } catch (e) {
      if (!(e instanceof HttpProviderError && e.status === 400 && e.body.includes('temperature')) || body.temperature === undefined) throw e
      delete body.temperature
      res = await this.post('/v1/messages', body, request.timeoutMs)
    }
    if (!stream) {
      const json = (await res.json()) as Message
      const usage = { promptTokens: json.usage?.input_tokens ?? 0, completionTokens: json.usage?.output_tokens ?? 0 }
      const tool = json.content?.find((c) => c.type === 'tool_use')
      if (schema && tool) return { text: JSON.stringify(wrapped ? (tool.input as { answer?: unknown }).answer : tool.input), ...usage }
      return { text: (json.content ?? []).map((c) => (c.type === 'text' ? c.text : '')).join(''), ...usage }
    }
    let text = ''
    let promptTokens = 0
    let completionTokens = 0
    for await (const data of serverSentEvents(res)) {
      const event = JSON.parse(data) as StreamEvent
      if (event.type === 'error') throw new ProviderError(`ANTHROPIC: ${event.error?.message ?? 'error'}`, event.error?.type === 'overloaded_error')
      if (event.type === 'message_start') promptTokens = event.message?.usage?.input_tokens ?? 0
      if (event.type === 'message_delta') completionTokens = event.usage?.output_tokens ?? completionTokens
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
        text += event.delta.text
        onDelta!(event.delta.text)
      }
    }
    return { text, promptTokens, completionTokens }
  }

  embed(): Promise<EmbedResult> {
    return Promise.reject(new UnsupportedInput('The AI chosen here makes no embeddings.'))
  }

  async models(timeoutMs: number): Promise<string[]> {
    const res = await callProvider('ANTHROPIC', this.url('/v1/models?limit=1000'), this.headers(), {}, timeoutMs, 'GET')
    const json = (await res.json()) as { data?: { id: string }[] }
    return (json.data ?? []).map((m) => m.id).sort()
  }

  private url(path: string) {
    return `${this.baseUrl.replace(/\/+$/, '')}${path}`
  }

  private headers(): Record<string, string> {
    return { 'anthropic-version': '2023-06-01', ...(this.apiKey ? { 'x-api-key': this.apiKey } : {}) }
  }

  private post(path: string, body: object, timeoutMs: number) {
    return callProvider('ANTHROPIC', this.url(path), this.headers(), body, timeoutMs)
  }
}
