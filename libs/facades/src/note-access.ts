import type { Visibility } from '@lvn/contracts/domain'

/**
 * A note as other contexts need it for one viewer (ADR-0047): `core` keeps comments and reactions on notes and asks
 * `notes`, which owns the read rule, who may read and comment. Answered by `notes`.
 */
export const NOTE_ACCESS = Symbol('NOTE_ACCESS')

export interface NoteReach {
  noteId: string
  ownerId: string
  visibility: Visibility
  /** OWNER and EDITOR work on the draft; READER sees the published version (§4.3) */
  access: 'OWNER' | 'EDITOR' | 'READER'
  /** `note.comment` for this viewer: comments and reactions */
  canComment: boolean
}

export interface NoteAccess {
  /** The note as `viewerId` reaches it, or null when they cannot read it (reported like a note that does not exist). */
  reach(viewerId: string, noteId: string): Promise<NoteReach | null>
  /** The card is in the note: its draft, or the published version readers see. */
  hasCard(noteId: string, cardId: string): Promise<boolean>
  /**
   * Why the note cannot be a project workspace's showcase (ADR-0048), in words, or null when it can: a PUBLIC note of
   * kind PROJECT, published, not held back, and shared to the workspace.
   */
  showcaseProblem(noteId: string, groupId: string): Promise<string | null>
}
