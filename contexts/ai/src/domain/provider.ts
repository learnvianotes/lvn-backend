/** A message to a chat model; `images` are base64 pictures (PNG, JPEG, WebP, GIF) or WAV recordings (transcription). */
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

/** Who a provider is: the environment's Ollama (ADR-0058) or a kind of connection platform admins set up (ADR-0065). */
export type AiProviderKind = 'OLLAMA' | 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'OPENAI_COMPATIBLE'

/** The length of every stored embedding (notes.NoteChunk.embedding is vector(768)). */
export const EMBEDDING_DIMENSIONS = 768

/**
 * One AI provider behind the gateway (§10.1, ADR-0058). `mayReceivePrivate` is §10.1's data-processing flag: private
 * notes go only to self-hosted or zero-retention providers.
 */
export interface AiProviderAdapter {
  readonly name: AiProviderKind
  readonly mayReceivePrivate: boolean
  /** With `onDelta`, the answer streams: each piece of text as it comes. */
  chat(request: ChatRequest, onDelta?: (text: string) => void): Promise<ChatResult>
  embed(model: string, inputs: string[], timeoutMs: number): Promise<EmbedResult>
  /** The models the account can use, when the provider lists them */
  models?(timeoutMs: number): Promise<string[]>
}

/**
 * Shown when a model permanently refuses the shape of the request (HTTP 400). People see it on the failed artifact
 * instead of an outage message; it names no secret and no note text. Admins see the same words in the worker log.
 */
export const MODEL_UNSUPPORTED = 'The selected model doesn’t support this request.'

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

/**
 * The provider cannot take this input (Claude and recordings or embeddings): no retry, not the provider's failure, and
 * the message is for people.
 */
export class UnsupportedInput extends ProviderError {
  constructor(message: string) {
    super(message, false)
  }
}

/** What a base64 attachment is, from its first bytes. */
export function mediaTypeOf(base64: string): 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'audio/wav' {
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png'
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('R0lGOD')) return 'image/gif'
  // RIFF….WAVE or RIFF….WEBP: the format is at bytes 8–11.
  if (base64.startsWith('UklGR')) return Buffer.from(base64.slice(0, 16), 'base64').subarray(8, 12).toString('latin1') === 'WEBP' ? 'image/webp' : 'audio/wav'
  return 'image/jpeg'
}

/** The vector scaled to length 1, so vectors from any provider compare the same way. */
export function normalized(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((s, x) => s + x * x, 0)) || 1
  return vector.map((x) => x / norm)
}

/** A provider's HTTP error answer, with its status and words (an adapter may try again without an option it refused). */
export class HttpProviderError extends ProviderError {
  constructor(
    message: string,
    retryable: boolean,
    readonly status: number,
    readonly body: string,
  ) {
    super(message, retryable)
  }
}
