import { ProviderError, type AiProviderAdapter, type ChatRequest, type ChatResult, type EmbedResult } from '../domain/provider'
import { callProvider } from './http'

interface OllamaChatChunk {
  message?: { content?: string }
  done?: boolean
  prompt_eval_count?: number
  eval_count?: number
  error?: string
}

/**
 * Ollama's HTTP API (ADR-0058): a model on our own machine, so private notes may go to it (an Ollama connection on
 * another host says whether it may, ADR-0065). Thinking is turned off (the answers are what we store); structured
 * output uses Ollama's `format` with a JSON schema.
 */
export class OllamaProvider implements AiProviderAdapter {
  readonly name = 'OLLAMA'

  constructor(
    private readonly url: string,
    readonly mayReceivePrivate = true,
  ) {}

  async chat(request: ChatRequest, onDelta?: (text: string) => void): Promise<ChatResult> {
    const res = await this.post('/api/chat', {
      model: request.model,
      messages: request.messages,
      stream: !!onDelta,
      think: false,
      ...(request.schema ? { format: request.schema } : {}),
      options: { ...(request.temperature !== undefined ? { temperature: request.temperature } : {}), ...(request.maxTokens ? { num_predict: request.maxTokens } : {}) },
    }, request.timeoutMs)
    if (!onDelta) {
      const body = (await res.json()) as OllamaChatChunk
      if (body.error) throw new ProviderError(`ollama: ${body.error}`, false)
      return { text: body.message?.content ?? '', promptTokens: body.prompt_eval_count ?? 0, completionTokens: body.eval_count ?? 0 }
    }
    // Streamed: one JSON object per line, the last with the counts.
    let text = ''
    let last: OllamaChatChunk = {}
    let buffer = ''
    const decoder = new TextDecoder()
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true })
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (!line) continue
        const part = JSON.parse(line) as OllamaChatChunk
        if (part.error) throw new ProviderError(`ollama: ${part.error}`, false)
        const piece = part.message?.content ?? ''
        if (piece) {
          text += piece
          onDelta(piece)
        }
        last = part
      }
    }
    return { text, promptTokens: last.prompt_eval_count ?? 0, completionTokens: last.eval_count ?? 0 }
  }

  async embed(model: string, inputs: string[], timeoutMs: number): Promise<EmbedResult> {
    const res = await this.post('/api/embed', { model, input: inputs }, timeoutMs)
    const body = (await res.json()) as { embeddings?: number[][]; prompt_eval_count?: number; error?: string }
    if (body.error || !body.embeddings) throw new ProviderError(`ollama: ${body.error ?? 'no embeddings'}`, false)
    return { vectors: body.embeddings, promptTokens: body.prompt_eval_count ?? 0 }
  }

  async models(timeoutMs: number): Promise<string[]> {
    const res = await callProvider('OLLAMA', `${this.url.replace(/\/$/, '')}/api/tags`, {}, {}, timeoutMs, 'GET')
    const json = (await res.json()) as { models?: { name: string }[] }
    return (json.models ?? []).map((m) => m.name).sort()
  }

  private post(path: string, body: object, timeoutMs: number): Promise<Response> {
    // Same guarded call as the other providers: no redirects, and no metadata or link-local address.
    return callProvider(`ollama ${path}`, `${this.url.replace(/\/$/, '')}${path}`, {}, body, timeoutMs)
  }
}
