/** A message to a chat model; `images` are base64 (PNG or JPEG) for models that see. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[]
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  /** A JSON schema the answer must follow (structured output) */
  schema?: object
  temperature?: number
  maxTokens?: number
  timeoutMs: number
}

export interface ChatResult {
  text: string
  promptTokens: number
  completionTokens: number
}

export interface EmbedResult {
  vectors: number[][]
  promptTokens: number
}

/**
 * One AI provider behind the gateway (§10.1, ADR-0058). `mayReceivePrivate` is §10.1's data-processing flag: private
 * notes go only to self-hosted or zero-retention providers.
 */
export interface AiProviderAdapter {
  readonly name: 'OLLAMA'
  readonly mayReceivePrivate: boolean
  /** With `onDelta`, the answer streams: each piece of text as it comes. */
  chat(request: ChatRequest, onDelta?: (text: string) => void): Promise<ChatResult>
  embed(model: string, inputs: string[], timeoutMs: number): Promise<EmbedResult>
}

/** A provider call that failed; `retryable` when trying again may help (timeouts, overload, a network error). */
export class ProviderError extends Error {
  override name = 'ProviderError'
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
  }
}
