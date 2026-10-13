// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.

/** The viewer's AI tokens today (UTC) against their plan's daily limit (§10.1, ADR-0024) */
export interface AiAllowance {
  usedToday: number
  /** null: the plan sets no limit */
  limitToday: number | null
  resetsAt: Date
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

export type AiLanguage = 'ENGLISH' | 'HINDI' | 'TELUGU'

export interface AiStatus {
  available: boolean
  reason: AiUnavailableReason | null
}

export type AiTask = 'SUMMARIZE' | 'KEY_CONCEPTS' | 'EXPLAIN_SIMPLY' | 'PRACTICE_QUESTIONS' | 'TRANSLATE' | 'FIND_MISTAKES' | 'EXPLAIN_CODE' | 'FLASHCARDS' | 'QUIZ' | 'REVISION_SHEET' | 'CREATE_NOTES' | 'OUTLINE_TO_NOTE'

/** Why AI is not answering */
export type AiUnavailableReason = 'NOT_CONFIGURED' | 'BUDGET' | 'PROVIDER_DOWN'

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

/** A note, owned by the notes subgraph; ai adds the viewer's AI results */
export interface Note {
  id: string
  /** Signed-in: the viewer's own AI results for this note, newest first; empty signed out */
  aiArtifacts: Array<AiArtifact>
}

export interface OkPayload {
  ok: boolean
  userErrors: Array<UserError>
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
