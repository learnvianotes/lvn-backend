import type { AiProviderKind } from './provider'
import { isGeminiModel } from './gemini-policy'

export type AiCapability = 'chat' | 'embed' | 'transcribe'

/** What the client is told when a minor's content has nowhere to go except OpenAI. */
export const MINOR_AI_MESSAGES: Record<AiCapability, string> = {
  chat: 'This AI feature isn’t available on this account.',
  embed: 'AI search isn’t available on this account.',
  transcribe: 'Transcription isn’t available on this account.',
}

export interface MinorRouteOption {
  key: string
  kind: AiProviderKind
  model: string
  mayReceivePrivate: boolean
  chats: boolean
  embeds: boolean
  hears: boolean
  /** Gemini, a Gemini model id, or a Google Generative AI host. */
  google: boolean
  /** The OpenAI provider, or a compatible host that is OpenAI's own API. */
  openAi: boolean
}

export interface MinorRoutePolicy {
  /** Under 18, or an age that is not known. */
  minor: boolean
  /** Admin setting `openai_zdr_approved`. Adults ignore it. */
  openAiAllowed: boolean
  needsPrivate: boolean
}

export type MinorRouteDecision = { action: 'missing' } | { action: 'blocked' } | { action: 'use'; key: string }

/**
 * Where a call goes. Adults keep the preferred target, including OpenAI. A minor is sent to that target only when it
 * is not OpenAI (unless zero-data retention is approved) and not Gemini. Otherwise the first safe provider that can
 * do the job is used, Anthropic first for chat. When none can, the call is blocked and must not be sent.
 */
export function chooseMinorRoute(
  preferredKey: string | null,
  options: readonly MinorRouteOption[],
  capability: AiCapability,
  policy: MinorRoutePolicy,
): MinorRouteDecision {
  if (!preferredKey) return { action: 'missing' }
  const preferred = options.find((option) => option.key === preferredKey)
  if (!preferred) return { action: 'missing' }
  if (!policy.minor || !blockedForMinor(preferred, policy.openAiAllowed)) return { action: 'use', key: preferred.key }
  const fallback = options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => option.key !== preferred.key && fits(option, capability, policy.needsPrivate) && !blockedForMinor(option, false))
    .sort((a, b) => rank(a.option, capability) - rank(b.option, capability) || a.index - b.index)[0]
  return fallback ? { action: 'use', key: fallback.option.key } : { action: 'blocked' }
}

/** OpenAI without approval, and Gemini in every case. Gemini is not unlocked by the OpenAI setting. */
export function blockedForMinor(option: MinorRouteOption, openAiAllowed: boolean): boolean {
  if (option.google || option.kind === 'GEMINI' || isGeminiModel(option.model)) return true
  if ((option.openAi || option.kind === 'OPENAI') && !openAiAllowed) return true
  return false
}

function fits(option: MinorRouteOption, capability: AiCapability, needsPrivate: boolean): boolean {
  if (needsPrivate && !option.mayReceivePrivate) return false
  if (capability === 'chat') return option.chats
  if (capability === 'embed') return option.embeds
  return option.hears
}

/** Anthropic is the chat equivalent. A local model is next. Embeddings and transcription have no Anthropic model. */
function rank(option: MinorRouteOption, capability: AiCapability): number {
  if (capability === 'chat' && option.kind === 'ANTHROPIC') return 0
  if (option.kind === 'OLLAMA') return 1
  return 2
}
