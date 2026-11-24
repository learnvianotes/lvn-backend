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
  /**
   * Notes shared to these groups and classes that `viewerId` may read (ADR-0049: the activity feed), newest share
   * first, before the (at, noteId) cursor; at most `take`.
   */
  placeShares(viewerId: string, places: { groupIds: string[]; classroomIds: string[] }, before: { at: Date; id: string } | null, take: number): Promise<PlaceShare[]>
  /**
   * The flashcards a person studies (ADR-0068): every flashcard of the notes they own or edit, and of the chosen
   * notes they can read, as they read each note now. Trashed notes and notes they cannot read give none.
   */
  studyCards(viewerId: string, chosenNoteIds: string[]): Promise<StudyCard[]>
  /**
   * Of these notes, the ones `viewerId` may read now, in the order given, titled as they see them (ADR-0071: every
   * recommendation passes through this when read).
   */
  readable(viewerId: string, noteIds: string[]): Promise<ReadableNote[]>
  /**
   * Public notes on any of these topics, published and not held back, that are not `viewerId`'s own; newest published
   * first, at most `take`. `withQuiz` keeps those whose published version has a quiz card (ADR-0071).
   */
  publicOnTopics(viewerId: string, topicIds: string[], options: { withQuiz?: boolean; take: number }): Promise<PublicTopicNote[]>
  /**
   * For You (ADR-0076): public notes on any of these topics, published and not held back, neither `viewerId`'s own nor
   * by `excludeOwners`; newest published first, before the (at, id) cursor; at most `take`.
   */
  publicOnTopicsPage(viewerId: string, topicIds: string[], excludeOwners: string[], before: { at: Date; id: string } | null, take: number): Promise<PublicTopicPage[]>
  /** Public notes, newest published first, not the viewer's. No topic or behaviour filter (ADR-0112). */
  recentPublic(viewerId: string, take: number): Promise<PublicTopicNote[]>
  /** The same list, paged, leaving out `excludeOwners`. `basedOn` stays empty for a minor. */
  recentPublicPage(viewerId: string, excludeOwners: string[], before: { at: Date; id: string } | null, take: number): Promise<PublicTopicPage[]>
  /** Of these notes, the strictly public ones (published, not held back, not trashed), with their owners, in the order given. */
  publicAmong(noteIds: string[]): Promise<{ noteId: string; ownerId: string }[]>
}

export interface PublicTopicPage {
  noteId: string
  /** When it was published */
  at: Date
  topicIds: string[]
}

export interface ReadableNote {
  noteId: string
  title: string
  ownerId: string
  visibility: Visibility
}

export interface PublicTopicNote {
  noteId: string
  title: string
  topicIds: string[]
}

/** A flashcard as its studier reads it (ADR-0068): from the draft for owners and editors, the published version else. */
export interface StudyCard {
  noteId: string
  noteTitle: string
  cardId: string
  /** Rich text */
  front: unknown
  back: unknown
}

export interface PlaceShare {
  noteId: string
  sharedBy: string
  at: Date
  groupId: string | null
  classroomId: string | null
}
