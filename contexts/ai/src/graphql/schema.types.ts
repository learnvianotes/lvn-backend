// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.

/** The viewer's AI tokens today (UTC) against their plan's daily limit (§10.1, ADR-0024) */
export interface AiAllowance {
  usedToday: number
  /** null: the plan sets no limit */
  limitToday: number | null
  resetsAt: Date
}

/** An Ask AI answer: the asker's own. Its text grows while it is RUNNING (live AI_ANSWER events say when) */
export interface AiAnswer {
  id: string
  question: string
  scope: AskAiScope
  status: AiArtifactStatus
  /** Markdown citing sources as [n] */
  text: string
  sources: Array<AiSource>
  /** FAILED: why, in words for the asker */
  error: string | null
  noteId: string | null
  doubtId: string | null
  createdAt: Date
}

/** What a task made for the viewer from a note (ADR-0059). Only its maker sees it, while they can read the note */
export interface AiArtifact {
  id: string
  task: AiTask
  status: AiArtifactStatus
  language: AiLanguage
  /** Text tasks, once READY: the result as Markdown */
  markdown: string | null
  /** Card tasks, once READY: the title a new note would take */
  title: string | null
  /** Card tasks, once READY: the cards to choose from */
  cards: Array<AiCard> | null
  /** CLEAN_UP, once READY: the changes to choose from (empty when nothing needs mending) */
  changes: Array<AiChange> | null
  /** FAILED: why, in words for the person */
  error: string | null
  /** Made from the published version (the viewer is a reader) rather than the draft */
  fromPublishedVersion: boolean
  /** The note was longer than a task reads; its start was used */
  truncated: boolean
  keptAt: Date | null
  createdAt: Date
  note: Note
}

export interface AiArtifactPayload {
  artifact: AiArtifact | null
  userErrors: Array<UserError>
}

export type AiArtifactStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED'

/** A card a task made, exactly as it would be kept: `type` and `content` as in the notes subgraph's Card */
export interface AiCard {
  type: string
  content: unknown
}

/** A card's words as CLEAN_UP would leave them (ADR-0063) */
export interface AiChange {
  cardId: string
  /** What the card said when the change was made */
  before: string
  after: string
  /** Applied to the note with applyAiChanges */
  applied: boolean
}

export interface AiConnection {
  id: string
  kind: AiProviderKind
  label: string
  /** null: the kind's own address */
  baseUrl: string | null
  /** A key is saved; it is never shown again */
  hasKey: boolean
  /** The key's last four characters */
  keyHint: string | null
  /** §10.1's data-processing flag: notes that are not public may go to it (self-hosted, or a zero-retention agreement) */
  mayReceivePrivate: boolean
  enabled: boolean
  chatModel: string | null
  embedModel: string | null
  /** Prices of its default models in millionths of a dollar per million tokens; the monthly budget counts them */
  inputMicroUsdPerMTok: number
  outputMicroUsdPerMTok: number
  embedMicroUsdPerMTok: number
  updatedAt: Date
}

export interface AiConnectionIdInput {
  id: string
}

/** Every model a connection lists, and the select for each use */
export interface AiConnectionModels {
  /** Every model the account lists, sorted by id. Nothing is dropped. */
  all: Array<AiListedModel>
  /** One select per use, in a fixed order. A use this app cannot call has an empty list. */
  pickers: Array<AiModelPicker>
}

export interface AiConnectionPayload {
  connection: AiConnection | null
  userErrors: Array<UserError>
}

export interface AiConnectionTest {
  ok: boolean
  /** What happened; the provider's own words when it failed */
  message: string
  latencyMs: number
  /** Models the account lists; empty when the provider does not list them */
  models: Array<string>
}

export interface AiConnectionTestPayload {
  test: AiConnectionTest | null
  userErrors: Array<UserError>
}

/** The environment's own provider (AI_PROVIDER), which answers when no connection is chosen */
export interface AiEnvironmentProvider {
  /** null: AI_PROVIDER is none */
  kind: AiProviderKind | null
  chatModel: string | null
  embedModel: string | null
}

/** A study aid made from a public note's published version: a summary, key concepts, practice questions, a quiz or flashcards */
export interface AiInsight {
  id: string
  task: AiTask
  status: AiArtifactStatus
  /** Text aids, once READY */
  markdown: string | null
  /** Card aids (quiz, flashcards), once READY: the title a kept note takes */
  title: string | null
  cards: Array<AiCard> | null
  /** Hidden by the owner: only they see it */
  hidden: boolean
  versionId: string
}

export type AiLanguage = 'ENGLISH' | 'HINDI' | 'TELUGU'

/** One model a connection's account lists */
export interface AiListedModel {
  /** The id the provider uses, sent back as chatModel, embedModel or a route's model */
  id: string
  kind: AiModelKind
  /** Pickers that offer this model. Empty: listed under `all`, shown in no select. */
  supports: Array<AiModelUse>
}

/** What a listed model is. A picker offers it only when `supports` includes that picker's use. */
export type AiModelKind = 'CHAT' | 'EMBEDDING' | 'IMAGE' | 'AUDIO' | 'REALTIME' | 'TTS' | 'MODERATION' | 'OTHER'

/** The models one select offers */
export interface AiModelPicker {
  use: AiModelUse
  models: Array<AiListedModel>
}

/** A select on /admin/ai. IMAGE, TTS, AUDIO, REALTIME and MODERATION stay empty: this app does not call those APIs.
 * TRANSCRIBE is a recording sent through the chat API, not the audio-transcriptions API. */
export type AiModelUse = 'CHAT' | 'EMBEDDING' | 'TRANSCRIBE' | 'IMAGE' | 'TTS' | 'AUDIO' | 'REALTIME' | 'MODERATION'

/** Who answers AI calls */
export type AiProviderKind = 'OLLAMA' | 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'OPENAI_COMPATIBLE'

/** What a kind of provider is and can do */
export interface AiProviderPreset {
  kind: AiProviderKind
  name: string
  /** null: the connection must give an address */
  defaultBaseUrl: string | null
  needsKey: boolean
  canEmbed: boolean
  /** Takes recordings (transcription) */
  canHear: boolean
  /** Private notes may go to it unless an admin says otherwise (a model on our own machine) */
  privateByDefault: boolean
  /** Hints; a connection test lists what the account has */
  chatModels: Array<string>
  embedModels: Array<string>
}

export interface AiSettings {
  connections: Array<AiConnection>
  /** Answers chats; null: the environment's provider */
  chatConnectionId: string | null
  /** Makes embeddings (Ask AI, meaning search); null: the environment's provider */
  embedConnectionId: string | null
  environment: AiEnvironmentProvider
  routes: Array<AiTaskRoute>
  /** Tasks a route can be set for */
  tasks: Array<string>
  presets: Array<AiProviderPreset>
  /** AI_KEYS_SECRET is set, so keys can be saved */
  keysCanBeSaved: boolean
  spentThisMonthMicroUsd: number
  /** null: no monthly cap */
  monthlyBudgetMicroUsd: number | null
}

export interface AiSettingsPayload {
  settings: AiSettings | null
  userErrors: Array<UserError>
}

/** A passage an answer cites, by its number in the answer ([1], [2] …) */
export interface AiSource {
  n: number
  noteId: string
  title: string
  /** The published version it came from; null for a draft (this note, asked by its owner or an editor) */
  versionId: string | null
  cardIds: Array<string>
  snippet: string
}

export interface AiStatus {
  available: boolean
  reason: AiUnavailableReason | null
}

export type AiTask = 'SUMMARIZE' | 'KEY_CONCEPTS' | 'EXPLAIN_SIMPLY' | 'PRACTICE_QUESTIONS' | 'TRANSLATE' | 'FIND_MISTAKES' | 'EXPLAIN_CODE' | 'FLASHCARDS' | 'QUIZ' | 'REVISION_SHEET' | 'CREATE_NOTES' | 'OUTLINE_TO_NOTE' | 'TRANSCRIBE' | 'QUICK_NOTE' | 'CLEAN_UP'

/** A task sent to a connection and model instead of the default */
export interface AiTaskRoute {
  task: string
  /** null: the default connection */
  connectionId: string | null
  model: string
  inputMicroUsdPerMTok: number
  outputMicroUsdPerMTok: number
}

export interface AiTaskRouteInput {
  task: string
}

/** Why AI is not answering */
export type AiUnavailableReason = 'NOT_CONFIGURED' | 'BUDGET' | 'PROVIDER_DOWN'

export interface ApplyAiChangesInput {
  artifactId: string
  /** The cards whose changes to apply */
  cardIds: Array<string>
}

export interface ApplyAiChangesPayload {
  /** The cards changed; a card edited since the change was made is left as it is */
  applied: Array<string>
  userErrors: Array<UserError>
}

export interface AskAiInput {
  question: string
  scope: AskAiScope
  /** THIS_NOTE: the note */
  noteId?: string | null
}

export interface AskAiPayload {
  answer: AiAnswer | null
  userErrors: Array<UserError>
}

/** Where Ask AI looks, always within what the asker may read */
export type AskAiScope = 'THIS_NOTE' | 'MY_NOTES' | 'MY_PLACES' | 'PUBLIC' | 'WORKSPACE'

export type ErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL' | 'UNAVAILABLE' | 'UNDER_MINIMUM_AGE' | 'AGE_RESTRICTED'

export interface KeepAiCardsInput {
  artifactId: string
  /** Indexes into the artifact's cards */
  cardIndexes: Array<number>
  into: KeepCardsInto
}

export interface KeepAiCardsPayload {
  /** The note the cards went into */
  noteId: string | null
  userErrors: Array<UserError>
}

export type KeepCardsInto = 'NOTE' | 'NEW_NOTE'

export interface MutationRunAiTaskArgs {
  input: RunAiTaskInput
}

export interface MutationKeepAiCardsArgs {
  input: KeepAiCardsInput
}

export interface MutationApplyAiChangesArgs {
  input: ApplyAiChangesInput
}

export interface MutationDeleteAiArtifactArgs {
  id: string
}

export interface MutationAskAiArgs {
  input: AskAiInput
}

export interface MutationAskAiAboutDoubtArgs {
  doubtId: string
}

export interface MutationDeleteAiAnswerArgs {
  id: string
}

export interface MutationSetAiInsightHiddenArgs {
  id: string
  hidden: boolean
}

export interface MutationSaveAiConnectionArgs {
  input: SaveAiConnectionInput
}

export interface MutationDeleteAiConnectionArgs {
  input: AiConnectionIdInput
}

export interface MutationSetAiDefaultsArgs {
  input: SetAiDefaultsInput
}

export interface MutationTestAiConnectionArgs {
  input: AiConnectionIdInput
}

export interface MutationSaveAiTaskRouteArgs {
  input: SaveAiTaskRouteInput
}

export interface MutationDeleteAiTaskRouteArgs {
  input: AiTaskRouteInput
}

/** A note, owned by the notes subgraph; ai adds the viewer's AI results */
export interface Note {
  id: string
  /** Signed-in: the viewer's own AI results for this note, newest first; empty signed out */
  aiArtifacts: Array<AiArtifact>
  /** Readers (signed in or not, while they may read the note): the READY aids the owner has not hidden. The owner: every step */
  aiInsights?: Array<AiInsight>
  /** The owner's: the aids' progress; null for anyone else, or before any. Live NOTE_PROCESSING events say when a step ends */
  noteProcessingStatus?: NoteProcessing | null
}

/** The study aids' progress for the note's current published version */
export interface NoteProcessing {
  versionId: string
  steps: Array<NoteProcessingStep>
  /** Every step READY or FAILED */
  done: boolean
}

export interface NoteProcessingStep {
  task: AiTask
  status: AiArtifactStatus
}

export interface OkPayload {
  ok: boolean
  userErrors: Array<UserError>
}

export interface QueryAiAnswerArgs {
  id: string
}

export interface QueryMyAiAnswersArgs {
  first?: number | null
  noteId?: string | null
  doubtId?: string | null
}

export interface QueryAiConnectionModelsArgs {
  input: AiConnectionIdInput
}

export interface QueryAiArtifactArgs {
  id: string
}

export interface RunAiTaskInput {
  noteId: string
  task: AiTask
  /** Default ENGLISH; TRANSLATE translates into it */
  language?: AiLanguage | null
  /** Only these cards (default: the whole note) */
  cardIds?: Array<string> | null
}

export interface SaveAiConnectionInput {
  /** Absent: a new connection */
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

export interface SaveAiTaskRouteInput {
  task: string
  /** Absent: the default connection */
  connectionId?: string | null
  model: string
  inputMicroUsdPerMTok?: number | null
  outputMicroUsdPerMTok?: number | null
}

export interface SetAiDefaultsInput {
  chatConnectionId?: string | null
  embedConnectionId?: string | null
}

export interface UserError {
  field: Array<string> | null
  message: string
  code: ErrorCode
  /** Set on AGE_RESTRICTED, and on a blocked sign-in: the address to show as contact admin at this email. */
  supportEmail: string | null
}
