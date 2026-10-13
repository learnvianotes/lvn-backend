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

export type AiTask = 'SUMMARIZE' | 'KEY_CONCEPTS' | 'EXPLAIN_SIMPLY' | 'PRACTICE_QUESTIONS' | 'TRANSLATE' | 'FIND_MISTAKES' | 'EXPLAIN_CODE' | 'FLASHCARDS' | 'QUIZ' | 'REVISION_SHEET' | 'CREATE_NOTES' | 'OUTLINE_TO_NOTE'

/** Why AI is not answering */
export type AiUnavailableReason = 'NOT_CONFIGURED' | 'BUDGET' | 'PROVIDER_DOWN'

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

export type ErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL' | 'UNAVAILABLE'

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

export interface UserError {
  field: Array<string> | null
  message: string
  code: ErrorCode
}
