import { AiTaskType } from '@lvn/contracts/domain'
import type { AiProviderKind } from './provider'

/** What a kind of provider is and can do, for the settings page and its checks (ADR-0065). */
export interface ProviderPreset {
  kind: AiProviderKind
  name: string
  /** Where it answers unless the connection says otherwise; null: the connection must say */
  defaultBaseUrl: string | null
  needsKey: boolean
  canEmbed: boolean
  /** Takes recordings (transcription) */
  canHear: boolean
  /** Whether private notes may go to it unless an admin says otherwise: only a model on our own machine */
  privateByDefault: boolean
  /** Hints; the connection test lists what the account really has */
  chatModels: string[]
  embedModels: string[]
}

export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  { kind: 'ANTHROPIC', name: 'Claude (Anthropic)', defaultBaseUrl: 'https://api.anthropic.com', needsKey: true, canEmbed: false, canHear: false, privateByDefault: false, chatModels: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'], embedModels: [] },
  { kind: 'OPENAI', name: 'ChatGPT (OpenAI)', defaultBaseUrl: 'https://api.openai.com/v1', needsKey: true, canEmbed: true, canHear: true, privateByDefault: false, chatModels: ['gpt-5-mini', 'gpt-5'], embedModels: ['text-embedding-3-small', 'text-embedding-3-large'] },
  { kind: 'GEMINI', name: 'Gemini (Google)', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', needsKey: true, canEmbed: true, canHear: true, privateByDefault: false, chatModels: ['gemini-3.8-flash', 'gemini-3.1-pro-preview'], embedModels: ['gemini-embedding-001'] },
  { kind: 'OPENAI_COMPATIBLE', name: 'Custom (OpenAI-compatible: LiteLLM proxy, OpenRouter, vLLM…)', defaultBaseUrl: null, needsKey: false, canEmbed: true, canHear: true, privateByDefault: false, chatModels: [], embedModels: [] },
  { kind: 'OLLAMA', name: 'Ollama', defaultBaseUrl: null, needsKey: false, canEmbed: true, canHear: true, privateByDefault: true, chatModels: ['gemma4'], embedModels: ['embeddinggemma'] },
]

export const presetOf = (kind: AiProviderKind): ProviderPreset => PROVIDER_PRESETS.find((p) => p.kind === kind)!

/** Tasks a route can send to a connection and model: the AI tasks, Ask AI, pages read again, and embeddings. */
export const ROUTABLE_TASKS: readonly string[] = [...Object.values(AiTaskType), 'ASK', 'READ_PAGE', 'EMBED']
