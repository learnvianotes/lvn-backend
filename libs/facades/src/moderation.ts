/**
 * Moderation (§15.1, ADR-0037) spans two contexts: `core` keeps reports, actions, appeals and the scorer; `notes` keeps
 * each note's moderation state. MODERATION is core's side, called by notes on the way to the public; NOTE_MODERATION is
 * notes' side, called by core's queue.
 */
export const MODERATION = Symbol('MODERATION')

export type ModerationStateKind = 'OK' | 'PENDING_REVIEW' | 'HIDDEN' | 'REMOVED'

export interface ModerationSubject {
  type: 'NOTE'
  id: string
  ownerId: string
  title: string
  /** The words readers will see (the published version) */
  text: string
}

export interface Moderation {
  /**
   * Scores content on its way to the public. When it is held back, a system report puts it in the queue and `reason`
   * says why, in words for its author.
   */
  screen(subject: ModerationSubject): Promise<{ held: boolean; reason: string | null }>
}

export const NOTE_MODERATION = Symbol('NOTE_MODERATION')

export interface ModeratedNote {
  id: string
  ownerId: string
  title: string
  /** The start of what readers see (the published version), for moderators */
  excerpt: string
  visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC'
  moderation: ModerationStateKind
  moderationReason: string | null
  deleted: boolean
}

export interface NoteModeration {
  describe(noteIds: string[]): Promise<ModeratedNote[]>
  /** Whether the viewer can read the note at all (a report needs it; otherwise it is "not found"). */
  canRead(viewerId: string, noteId: string): Promise<boolean>
  /** Sets the state and the reason the owner sees; NotePublished/NoteUnpublished follow what the public can read. */
  setState(noteId: string, state: ModerationStateKind, reason: string | null): Promise<void>
}
