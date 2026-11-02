import type { CardType, NoteKind, Visibility } from '@lvn/contracts/domain'

/**
 * Notes as the `ai` context needs them for AI tasks (ADR-0059): what a person may run on a note, the words the model
 * reads, and writing kept cards back. Answered by `notes`, which owns the read rule, the fork rule and the cards.
 */
export const NOTE_AI = Symbol('NOTE_AI')

export interface NoteAiCard {
  id: string
  type: CardType
  /** The card's words, as search and read-aloud see them */
  text: string
  content: unknown
}

export interface NoteAiSource {
  noteId: string
  ownerId: string
  title: string
  kind: NoteKind
  visibility: Visibility
  access: 'OWNER' | 'EDITOR' | 'READER'
  /** The published version a reader sees; null when the person works on the draft */
  versionId: string | null
  /** `note.askAi`: every task (ADR-0025) */
  mayAskAi: boolean
  /** `note.fork`: tasks that make the person's own copy (CREATE_NOTES, OUTLINE_TO_NOTE) */
  mayFork: boolean
  /** `ai.bulk`: those copy-writing tasks also need the unverified-account gate to allow them */
  mayBulkAi: boolean
  /** May add cards to this note's draft */
  canEdit: boolean
  cards: NoteAiCard[]
}

export interface NewCard {
  type: CardType
  content: unknown
}

export interface NoteAi {
  /** The note as `viewerId` reads it — the draft for owners and editors, else the published version — or null. */
  source(viewerId: string, noteId: string): Promise<NoteAiSource | null>
  /**
   * The note as anyone reads it, signed in or not: the published version of a PUBLIC note in good standing, or null
   * (the public-note pipeline, ADR-0061).
   */
  publicSource(noteId: string): Promise<NoteAiSource | null>
  /** Appends cards to the draft; FORBIDDEN unless `viewerId` may edit it. */
  appendCards(viewerId: string, noteId: string, cards: NewCard[]): Promise<void>
  /**
   * A new PRIVATE note of `ownerId`'s with these cards; with `copiedFrom`, it carries a copy's credit (ADR-0010) and
   * needs the fork right on that note. Returns the new note's id.
   */
  createNote(ownerId: string, input: { title: string; cards: NewCard[]; copiedFrom?: string | null }): Promise<string>
  /**
   * Replaces the words of text, heading and quote cards of the draft, keeping each card's type and anchor, through the
   * normal save; FORBIDDEN unless `viewerId` may edit it. A card whose words are no longer `before` (edited since) is
   * left alone. Returns the ids of the cards changed (ADR-0063).
   */
  rewriteText(viewerId: string, noteId: string, changes: { cardId: string; before: string; text: string }[]): Promise<string[]>
}
