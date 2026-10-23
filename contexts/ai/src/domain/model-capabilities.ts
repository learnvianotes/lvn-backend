import type { AiProviderKind } from './provider'

/**
 * What a listed model is, so the full list can be grouped. This is not a promise that this app calls it: see
 * `supports`.
 */
export type AiModelKind = 'CHAT' | 'EMBEDDING' | 'IMAGE' | 'AUDIO' | 'REALTIME' | 'TTS' | 'MODERATION' | 'OTHER'

/**
 * A picker on /admin/ai. A model is offered for a use only when this app's code can call it for that use.
 * IMAGE, TTS, AUDIO, REALTIME and MODERATION are pickers too, and they stay empty: those provider APIs are not called.
 * TRANSCRIBE is a recording sent through the chat API (`input_audio`), not the audio-transcriptions API.
 */
export type AiModelUse = 'CHAT' | 'EMBEDDING' | 'TRANSCRIBE' | 'IMAGE' | 'TTS' | 'AUDIO' | 'REALTIME' | 'MODERATION'

/** Picker order. Every use is always present, so a select can bind to one without a second query. */
export const MODEL_USES: readonly AiModelUse[] = ['CHAT', 'EMBEDDING', 'TRANSCRIBE', 'IMAGE', 'TTS', 'AUDIO', 'REALTIME', 'MODERATION']

export interface ClassifiedModel {
  /** The id the provider listed, sent back unchanged as chatModel, embedModel or a route's model */
  id: string
  kind: AiModelKind
  /** Pickers that offer this model. Empty: kept on the full list, shown in no select. */
  supports: AiModelUse[]
}

export interface ModelPicker {
  use: AiModelUse
  models: ClassifiedModel[]
}

export interface ConnectionModelLists {
  /** Every id the provider returned. Nothing is dropped. */
  all: ClassifiedModel[]
  pickers: ModelPicker[]
}

/**
 * First match wins. Put a specific id above the family it would otherwise join (`tts` before `gpt-`, ada-002 before
 * `embedding`). To offer a new family, add a rule here; the pickers read `supports` and do not have their own lists.
 * A rule with `providers` is skipped for every other kind of connection.
 */
export interface ModelRule {
  id: RegExp
  kind: AiModelKind
  supports: readonly AiModelUse[]
  providers?: readonly AiProviderKind[]
}

const CHAT: readonly AiModelUse[] = ['CHAT']
const EMBED: readonly AiModelUse[] = ['EMBEDDING']
const HEAR: readonly AiModelUse[] = ['TRANSCRIBE']
const CHAT_AND_HEAR: readonly AiModelUse[] = ['CHAT', 'TRANSCRIBE']
const NONE: readonly AiModelUse[] = []

export const MODEL_RULES: readonly ModelRule[] = [
  { id: /moderation/, kind: 'MODERATION', supports: NONE },
  // ada-002 is fixed at 1536 numbers; stored vectors are 768, and the embeddings call refuses a different size.
  { id: /^text-embedding-ada-002$/, kind: 'EMBEDDING', supports: NONE },
  { id: /embedding|(^|-)embed($|-)/, kind: 'EMBEDDING', supports: EMBED },
  { id: /(^|-)tts($|-)/, kind: 'TTS', supports: NONE },
  { id: /realtime|(^|-)live($|-)/, kind: 'REALTIME', supports: NONE },
  // Whisper and *-transcribe speak the audio transcriptions API, which this app does not call.
  { id: /transcribe|whisper/, kind: 'AUDIO', supports: NONE },
  // gpt-audio and the audio-preview models take a recording on the chat request, which is how TRANSCRIBE hears.
  { id: /^gpt-audio($|-)|audio-preview/, kind: 'AUDIO', supports: HEAR },
  { id: /gpt-image|chatgpt-image|(^|-)image($|-)|^dall-e|^imagen|^dalle/, kind: 'IMAGE', supports: NONE },
  // Legacy completions models: the chat call is /chat/completions, which they do not answer.
  { id: /-instruct($|-)/, kind: 'OTHER', supports: NONE },
  { id: /^sora($|-)/, kind: 'OTHER', supports: NONE },
  { id: /^(babbage|davinci|curie|ada)($|-)|^(text|code)-(ada|babbage|curie|davinci)/, kind: 'OTHER', supports: NONE },
  // Every Claude model answers the Messages API, including ones that reject a forced tool_choice (the adapter asks
  // those again without it). Claude does not take recordings.
  { id: /^claude($|-)/, kind: 'CHAT', supports: CHAT },
  // Gemini's OpenAI-compatible endpoint takes input_audio on the same chat call TRANSCRIBE sends.
  { id: /^gemini($|-)/, kind: 'CHAT', supports: CHAT_AND_HEAR, providers: ['GEMINI', 'OPENAI_COMPATIBLE', 'OLLAMA'] },
  { id: /^gemini($|-)/, kind: 'CHAT', supports: CHAT },
  { id: /^(gpt-|chatgpt-|chat-|o1($|-)|o3($|-)|o4($|-))/, kind: 'CHAT', supports: CHAT },
]

/**
 * A name that matched no rule. A proxy or an Ollama lists whatever the machine has, and the chat call is how this app
 * talks to it. An official account's unknown id is kept and offered nowhere, until a rule above names its family.
 */
const FALLBACK: Record<AiProviderKind, { kind: AiModelKind; supports: readonly AiModelUse[] }> = {
  ANTHROPIC: { kind: 'OTHER', supports: NONE },
  OPENAI: { kind: 'OTHER', supports: NONE },
  GEMINI: { kind: 'OTHER', supports: NONE },
  OPENAI_COMPATIBLE: { kind: 'CHAT', supports: CHAT },
  OLLAMA: { kind: 'CHAT', supports: CHAT_AND_HEAR },
}

/** The id a rule sees: no `models/` prefix, no `vendor/` prefix, and a fine-tune's base model (`ft:gpt-4o:org:…`). */
export function bareModelId(id: string): string {
  let name = id.trim().toLowerCase().replace(/^models\//, '')
  const slash = name.lastIndexOf('/')
  if (slash >= 0) name = name.slice(slash + 1)
  if (name.startsWith('ft:')) name = name.slice(3).split(':')[0] ?? name
  return name
}

/** What one listed id is, and which pickers offer it. */
export function classifyModel(id: string, provider: AiProviderKind): ClassifiedModel {
  const name = bareModelId(id)
  for (const rule of MODEL_RULES) {
    if (rule.providers && !rule.providers.includes(provider)) continue
    if (!rule.id.test(name)) continue
    return { id: id.trim(), kind: rule.kind, supports: [...rule.supports] }
  }
  const fallback = FALLBACK[provider]
  return { id: id.trim(), kind: fallback.kind, supports: [...fallback.supports] }
}

/**
 * The full list and one list per picker. Ids are kept as the provider spelled them. The full list is sorted by id;
 * a picker lists the models whose `supports` includes that use, in the same order.
 */
export function classifyModels(ids: readonly string[], provider: AiProviderKind): ConnectionModelLists {
  const all = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort().map((id) => classifyModel(id, provider))
  return { all, pickers: MODEL_USES.map((use) => ({ use, models: all.filter((model) => model.supports.includes(use)) })) }
}

/** The picker a task route's model has to come from. */
export function useForTask(task: string): AiModelUse {
  if (task === 'EMBED') return 'EMBEDDING'
  if (task === 'TRANSCRIBE') return 'TRANSCRIBE'
  return 'CHAT'
}

const USE_LABEL: Record<AiModelUse, string> = {
  CHAT: 'chats',
  EMBEDDING: 'embeddings',
  TRANSCRIBE: 'transcription',
  IMAGE: 'images',
  TTS: 'speech',
  AUDIO: 'audio transcription',
  REALTIME: 'realtime',
  MODERATION: 'moderation',
}

const NEED: Record<AiModelUse, string> = {
  CHAT: 'Choose a chat model.',
  EMBEDDING: 'Choose an embedding model that can give 768 numbers.',
  TRANSCRIBE: 'Choose a chat model that can hear recordings.',
  IMAGE: 'This app does not generate images.',
  TTS: 'This app does not speak.',
  AUDIO: 'This app does not call the audio transcriptions API.',
  REALTIME: 'This app does not use realtime models.',
  MODERATION: 'This app does not call moderation models.',
}

const KIND_WORD: Record<AiModelKind, string> = {
  CHAT: 'chat',
  EMBEDDING: 'embedding',
  IMAGE: 'image',
  AUDIO: 'audio',
  REALTIME: 'realtime',
  TTS: 'text-to-speech',
  MODERATION: 'moderation',
  OTHER: 'other',
}

/**
 * Why this model cannot be saved for this use, or null when a picker would offer it. The words name the kind and the
 * use, so the admin sees which select it belongs in.
 */
export function rejectionFor(model: string, provider: AiProviderKind, use: AiModelUse): string | null {
  const found = classifyModel(model, provider)
  if (found.supports.includes(use)) return null
  if (use === 'EMBEDDING' && found.kind === 'EMBEDDING') return `${model} cannot make the 768-number embeddings this app stores. ${NEED.EMBEDDING}`
  if (use === 'TRANSCRIBE' && (found.kind === 'AUDIO' || found.kind === 'CHAT')) return `${model} cannot hear recordings through the chat API this app uses. ${NEED.TRANSCRIBE}`
  if (found.kind === 'OTHER') return `${model} cannot be used for ${USE_LABEL[use]}. ${NEED[use]}`
  return `${model} is a ${KIND_WORD[found.kind]} model, so it cannot be used for ${USE_LABEL[use]}. ${NEED[use]}`
}
