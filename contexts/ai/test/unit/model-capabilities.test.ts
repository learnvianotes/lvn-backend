import { audioTransport, classifyModel, classifyModels, MODEL_USES, rejectionFor } from '../../src/domain/model-capabilities'

/**
 * The models a Claude account and an OpenAI account list (the beta /admin/ai paste). Every id stays on `all`.
 * A picker offers only the models this app can call for that use. New families are a rule in model-capabilities.ts;
 * a new id of a known family needs no change.
 */

const CLAUDE = [
  'claude-fable-5',
  'claude-fable-5-1',
  'claude-haiku-4-5-20251001',
  'claude-haiku-5-5',
  'claude-opus-4-5-20251101',
  'claude-opus-4-6',
  'claude-opus-4-7',
  'claude-opus-4-8',
  'claude-opus-5',
  'claude-opus-5-5',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-6',
  'claude-sonnet-5',
  'claude-sonnet-5-5',
]

const OPENAI_CHAT = [
  'chat-latest',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-0125',
  'gpt-3.5-turbo-1106',
  'gpt-3.5-turbo-16k',
  'gpt-4',
  'gpt-4-0613',
  'gpt-4-turbo',
  'gpt-4-turbo-2024-04-09',
  'gpt-4.1',
  'gpt-4.1-2025-04-14',
  'gpt-4.1-mini',
  'gpt-4.1-mini-2025-04-14',
  'gpt-4.1-nano',
  'gpt-4.1-nano-2025-04-14',
  'gpt-4o',
  'gpt-4o-2024-05-13',
  'gpt-4o-2024-08-06',
  'gpt-4o-2024-11-20',
  'gpt-4o-mini',
  'gpt-4o-mini-2024-07-18',
  'gpt-4o-mini-search-preview',
  'gpt-4o-mini-search-preview-2025-03-11',
  'gpt-4o-search-preview',
  'gpt-4o-search-preview-2025-03-11',
  'gpt-5',
  'gpt-5-2025-08-07',
  'gpt-5-chat-latest',
  'gpt-5-codex',
  'gpt-5-mini',
  'gpt-5-mini-2025-08-07',
  'gpt-5-nano',
  'gpt-5-nano-2025-08-07',
  'gpt-5-pro',
  'gpt-5-pro-2025-10-06',
  'gpt-5-search-api',
  'gpt-5-search-api-2025-10-14',
  'gpt-5.1',
  'gpt-5.1-2025-11-13',
  'gpt-5.1-chat-latest',
  'gpt-5.1-codex',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex-mini',
  'gpt-5.2',
  'gpt-5.2-2025-12-11',
  'gpt-5.2-chat-latest',
  'gpt-5.2-codex',
  'gpt-5.2-pro',
  'gpt-5.2-pro-2025-12-11',
  'gpt-5.3-chat-latest',
  'gpt-5.3-codex',
  'gpt-5.4',
  'gpt-5.4-2026-03-05',
  'gpt-5.4-mini',
  'gpt-5.4-mini-2026-03-17',
  'gpt-5.4-nano',
  'gpt-5.4-nano-2026-03-17',
  'gpt-5.4-pro',
  'gpt-5.4-pro-2026-03-05',
  'gpt-5.5',
  'gpt-5.5-2026-04-23',
  'gpt-5.5-pro',
  'gpt-5.5-pro-2026-04-23',
  'gpt-5.6-luna',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-6-astra',
  'gpt-6-luna',
  'gpt-6-sol',
  'gpt-6.1-sol',
  'o1',
  'o1-2024-12-17',
  'o1-pro',
  'o1-pro-2025-03-19',
  'o3',
  'o3-2025-04-16',
  'o3-mini',
  'o3-mini-2025-01-31',
  'o4-mini',
  'o4-mini-2025-04-16',
]

const OPENAI_IMAGE = ['chatgpt-image-latest', 'gpt-image-1', 'gpt-image-1-mini', 'gpt-image-1.5', 'gpt-image-2', 'gpt-image-2-2026-04-21', 'gpt-image-2.5-flare', 'gpt-image-2.5-flare-2026-09-08', 'gpt-image-2.5-sunburst', 'gpt-image-2.5-sunburst-2026-09-08']
const OPENAI_TRANSCRIBE_API = ['gpt-4o-mini-transcribe', 'gpt-4o-mini-transcribe-2025-03-20', 'gpt-4o-mini-transcribe-2025-12-15', 'gpt-4o-transcribe', 'gpt-4o-transcribe-diarize', 'gpt-transcribe', 'whisper-1']
const OPENAI_HEAR = ['gpt-audio', 'gpt-audio-1.5', 'gpt-audio-2025-08-28', 'gpt-audio-mini', 'gpt-audio-mini-2025-10-06', 'gpt-audio-mini-2025-12-15']
const OPENAI_REALTIME = ['gpt-live-1', 'gpt-live-transcribe', 'gpt-realtime', 'gpt-realtime-1.5', 'gpt-realtime-2', 'gpt-realtime-2.1', 'gpt-realtime-2.1-mini', 'gpt-realtime-2025-08-28', 'gpt-realtime-mini', 'gpt-realtime-mini-2025-12-15', 'gpt-realtime-translate', 'gpt-realtime-whisper']
const OPENAI_TTS = ['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-03-20', 'gpt-4o-mini-tts-2025-12-15', 'tts-1', 'tts-1-1106', 'tts-1-hd', 'tts-1-hd-1106']
const OPENAI_EMBED = ['text-embedding-3-large', 'text-embedding-3-small']
const OPENAI_EMBED_UNUSABLE = ['text-embedding-ada-002']
const OPENAI_MODERATION = ['omni-moderation-2024-09-26', 'omni-moderation-latest']
const OPENAI_OTHER = ['babbage-002', 'davinci-002', 'gpt-3.5-turbo-instruct', 'gpt-3.5-turbo-instruct-0914', 'sora-2', 'sora-2-pro']

/** The OpenAI account's list, in the order it was pasted. */
const OPENAI = [
  'babbage-002',
  'chat-latest',
  'chatgpt-image-latest',
  'davinci-002',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-0125',
  'gpt-3.5-turbo-1106',
  'gpt-3.5-turbo-16k',
  'gpt-3.5-turbo-instruct',
  'gpt-3.5-turbo-instruct-0914',
  'gpt-4',
  'gpt-4-0613',
  'gpt-4-turbo',
  'gpt-4-turbo-2024-04-09',
  'gpt-4.1',
  'gpt-4.1-2025-04-14',
  'gpt-4.1-mini',
  'gpt-4.1-mini-2025-04-14',
  'gpt-4.1-nano',
  'gpt-4.1-nano-2025-04-14',
  'gpt-4o',
  'gpt-4o-2024-05-13',
  'gpt-4o-2024-08-06',
  'gpt-4o-2024-11-20',
  'gpt-4o-mini',
  'gpt-4o-mini-2024-07-18',
  'gpt-4o-mini-search-preview',
  'gpt-4o-mini-search-preview-2025-03-11',
  'gpt-4o-mini-transcribe',
  'gpt-4o-mini-transcribe-2025-03-20',
  'gpt-4o-mini-transcribe-2025-12-15',
  'gpt-4o-mini-tts',
  'gpt-4o-mini-tts-2025-03-20',
  'gpt-4o-mini-tts-2025-12-15',
  'gpt-4o-search-preview',
  'gpt-4o-search-preview-2025-03-11',
  'gpt-4o-transcribe',
  'gpt-4o-transcribe-diarize',
  'gpt-5',
  'gpt-5-2025-08-07',
  'gpt-5-chat-latest',
  'gpt-5-codex',
  'gpt-5-mini',
  'gpt-5-mini-2025-08-07',
  'gpt-5-nano',
  'gpt-5-nano-2025-08-07',
  'gpt-5-pro',
  'gpt-5-pro-2025-10-06',
  'gpt-5-search-api',
  'gpt-5-search-api-2025-10-14',
  'gpt-5.1',
  'gpt-5.1-2025-11-13',
  'gpt-5.1-chat-latest',
  'gpt-5.1-codex',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex-mini',
  'gpt-5.2',
  'gpt-5.2-2025-12-11',
  'gpt-5.2-chat-latest',
  'gpt-5.2-codex',
  'gpt-5.2-pro',
  'gpt-5.2-pro-2025-12-11',
  'gpt-5.3-chat-latest',
  'gpt-5.3-codex',
  'gpt-5.4',
  'gpt-5.4-2026-03-05',
  'gpt-5.4-mini',
  'gpt-5.4-mini-2026-03-17',
  'gpt-5.4-nano',
  'gpt-5.4-nano-2026-03-17',
  'gpt-5.4-pro',
  'gpt-5.4-pro-2026-03-05',
  'gpt-5.5',
  'gpt-5.5-2026-04-23',
  'gpt-5.5-pro',
  'gpt-5.5-pro-2026-04-23',
  'gpt-5.6-luna',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-6-astra',
  'gpt-6-luna',
  'gpt-6-sol',
  'gpt-6.1-sol',
  'gpt-audio',
  'gpt-audio-1.5',
  'gpt-audio-2025-08-28',
  'gpt-audio-mini',
  'gpt-audio-mini-2025-10-06',
  'gpt-audio-mini-2025-12-15',
  'gpt-image-1',
  'gpt-image-1-mini',
  'gpt-image-1.5',
  'gpt-image-2',
  'gpt-image-2-2026-04-21',
  'gpt-image-2.5-flare',
  'gpt-image-2.5-flare-2026-09-08',
  'gpt-image-2.5-sunburst',
  'gpt-image-2.5-sunburst-2026-09-08',
  'gpt-live-1',
  'gpt-live-transcribe',
  'gpt-realtime',
  'gpt-realtime-1.5',
  'gpt-realtime-2',
  'gpt-realtime-2.1',
  'gpt-realtime-2.1-mini',
  'gpt-realtime-2025-08-28',
  'gpt-realtime-mini',
  'gpt-realtime-mini-2025-12-15',
  'gpt-realtime-translate',
  'gpt-realtime-whisper',
  'gpt-transcribe',
  'o1',
  'o1-2024-12-17',
  'o1-pro',
  'o1-pro-2025-03-19',
  'o3',
  'o3-2025-04-16',
  'o3-mini',
  'o3-mini-2025-01-31',
  'o4-mini',
  'o4-mini-2025-04-16',
  'omni-moderation-2024-09-26',
  'omni-moderation-latest',
  'sora-2',
  'sora-2-pro',
  'text-embedding-3-large',
  'text-embedding-3-small',
  'text-embedding-ada-002',
  'tts-1',
  'tts-1-1106',
  'tts-1-hd',
  'tts-1-hd-1106',
  'whisper-1',
]

const ids = (models: { id: string }[]) => models.map((m) => m.id)

describe('model pickers', () => {
  it('keeps every pasted model and offers only the ones this app can call', () => {
    const grouped = [...OPENAI_CHAT, ...OPENAI_IMAGE, ...OPENAI_TRANSCRIBE_API, ...OPENAI_HEAR, ...OPENAI_REALTIME, ...OPENAI_TTS, ...OPENAI_EMBED, ...OPENAI_EMBED_UNUSABLE, ...OPENAI_MODERATION, ...OPENAI_OTHER]
    expect(new Set(grouped)).toEqual(new Set(OPENAI))
    expect(grouped).toHaveLength(OPENAI.length)

    const claude = classifyModels(CLAUDE, 'ANTHROPIC')
    expect(ids(claude.all)).toEqual([...CLAUDE].sort())
    expect(claude.all.every((m) => m.kind === 'CHAT' && m.supports.length === 1 && m.supports[0] === 'CHAT')).toBe(true)
    // claude-sonnet-5-5 rejects a forced tool_choice; the adapter retries without it, so the chat select still offers it.
    expect(classifyModel('claude-sonnet-5-5', 'ANTHROPIC')).toEqual({ id: 'claude-sonnet-5-5', kind: 'CHAT', supports: ['CHAT'] })
    expect(ids(claude.pickers.find((p) => p.use === 'CHAT')!.models)).toEqual([...CLAUDE].sort())
    expect(ids(claude.pickers.find((p) => p.use === 'TRANSCRIBE')!.models)).toEqual([])

    const openai = classifyModels(OPENAI, 'OPENAI')
    expect(ids(openai.all)).toEqual([...OPENAI].sort())
    expect(openai.all).toHaveLength(OPENAI.length)
    expect(openai.pickers.map((p) => p.use)).toEqual([...MODEL_USES])
    expect(ids(openai.pickers.find((p) => p.use === 'CHAT')!.models)).toEqual([...OPENAI_CHAT].sort())
    expect(ids(openai.pickers.find((p) => p.use === 'EMBEDDING')!.models)).toEqual([...OPENAI_EMBED].sort())
    expect(ids(openai.pickers.find((p) => p.use === 'TRANSCRIBE')!.models)).toEqual([...OPENAI_HEAR, ...OPENAI_TRANSCRIBE_API].sort())
    for (const use of ['IMAGE', 'TTS', 'AUDIO', 'REALTIME', 'MODERATION'] as const) expect(openai.pickers.find((p) => p.use === use)!.models).toEqual([])
    for (const id of OPENAI_TRANSCRIBE_API) expect(openai.all.find((m) => m.id === id)!.supports).toEqual(['TRANSCRIBE'])
    for (const id of [...OPENAI_IMAGE, ...OPENAI_REALTIME, ...OPENAI_TTS, ...OPENAI_EMBED_UNUSABLE, ...OPENAI_MODERATION, ...OPENAI_OTHER]) {
      expect(openai.all.find((m) => m.id === id)!.supports).toEqual([])
    }
  })

  it('classifies from the id when the provider sends no capability metadata, and a new id of a known family needs no list edit', () => {
    expect(classifyModel('gpt-9-preview', 'OPENAI')).toEqual({ id: 'gpt-9-preview', kind: 'CHAT', supports: ['CHAT'] })
    expect(classifyModel('claude-9', 'ANTHROPIC').supports).toEqual(['CHAT'])
    expect(classifyModel('ft:gpt-4o-mini:acme:suffix:abc', 'OPENAI')).toMatchObject({ id: 'ft:gpt-4o-mini:acme:suffix:abc', kind: 'CHAT', supports: ['CHAT'] })
    expect(classifyModel('models/gemini-2.5-flash', 'GEMINI')).toEqual({ id: 'models/gemini-2.5-flash', kind: 'CHAT', supports: ['CHAT', 'TRANSCRIBE'] })
    expect(classifyModel('gemini-embedding-001', 'GEMINI')).toEqual({ id: 'gemini-embedding-001', kind: 'EMBEDDING', supports: ['EMBEDDING'] })
    expect(classifyModel('embeddinggemma', 'OLLAMA')).toEqual({ id: 'embeddinggemma', kind: 'EMBEDDING', supports: ['EMBEDDING'] })
    expect(classifyModel('gemma4', 'OLLAMA')).toEqual({ id: 'gemma4', kind: 'CHAT', supports: ['CHAT', 'TRANSCRIBE'] })
    // An official account's unknown id is kept and offered in no select. A proxy's own name is a chat model.
    const unknown = classifyModels(['brand-new-model', 'gpt-4o'], 'OPENAI')
    expect(ids(unknown.all)).toEqual(['brand-new-model', 'gpt-4o'])
    expect(ids(unknown.pickers.find((p) => p.use === 'CHAT')!.models)).toEqual(['gpt-4o'])
    expect(classifyModel('my-proxy-model', 'OPENAI_COMPATIBLE')).toEqual({ id: 'my-proxy-model', kind: 'CHAT', supports: ['CHAT'] })
  })

  it('says which select a model does not belong in', () => {
    expect(rejectionFor('gpt-4o', 'OPENAI', 'CHAT')).toBeNull()
    expect(rejectionFor('text-embedding-3-small', 'OPENAI', 'EMBEDDING')).toBeNull()
    expect(rejectionFor('gpt-audio-mini', 'OPENAI', 'TRANSCRIBE')).toBeNull()
    expect(rejectionFor('claude-sonnet-5-5', 'ANTHROPIC', 'CHAT')).toBeNull()
    expect(rejectionFor('gpt-image-1', 'OPENAI', 'CHAT')).toMatch(/image model/)
    expect(rejectionFor('tts-1', 'OPENAI', 'CHAT')).toMatch(/text-to-speech/)
    expect(rejectionFor('whisper-1', 'OPENAI', 'TRANSCRIBE')).toBeNull()
    expect(rejectionFor('gpt-4o', 'OPENAI', 'TRANSCRIBE')).toMatch(/cannot hear/)
    expect(audioTransport('whisper-1')).toBe('transcriptions')
    expect(audioTransport('gpt-4o-mini-transcribe')).toBe('transcriptions')
    expect(audioTransport('gpt-audio-mini')).toBe('chat')
    expect(audioTransport('gemini-2.5-flash')).toBe('chat')
    const gemini = classifyModels(['gemini-2.5-flash', 'gemini-embedding-001'], 'GEMINI')
    expect(ids(gemini.all)).toEqual(['gemini-2.5-flash', 'gemini-embedding-001'])
    for (const picker of gemini.pickers) expect(picker.models).toEqual([])
    const mixed = classifyModels(['gpt-4o', 'gemini-2.5-flash'], 'OPENAI_COMPATIBLE')
    expect(ids(mixed.pickers.find((p) => p.use === 'CHAT')!.models)).toEqual(['gpt-4o'])
    expect(rejectionFor('gemini-2.5-flash', 'GEMINI', 'CHAT')).toBe('Gemini and Google Generative AI are not available.')
    expect(rejectionFor('gemini-2.5-flash', 'OPENAI_COMPATIBLE', 'CHAT')).toBe('Gemini and Google Generative AI are not available.')
    expect(audioTransport('gemma4')).toBe('chat')
    expect(audioTransport('gpt-realtime-whisper')).toBe('chat')
    expect(audioTransport('gpt-live-transcribe')).toBe('chat')
    expect(classifyModel('gpt-live-transcribe', 'OPENAI').kind).toBe('REALTIME')
    expect(rejectionFor('text-embedding-ada-002', 'OPENAI', 'EMBEDDING')).toMatch(/768/)
    expect(rejectionFor('gpt-4o', 'OPENAI', 'EMBEDDING')).toMatch(/chat model/)
    expect(rejectionFor('sora-2', 'OPENAI', 'CHAT')).toMatch(/cannot be used for chats/)
    expect(rejectionFor('omni-moderation-latest', 'OPENAI', 'CHAT')).toMatch(/moderation model/)
  })
})
