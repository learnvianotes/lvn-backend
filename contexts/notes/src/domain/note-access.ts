import { Action, can, type Actor, type NoteFacts, type Visibility } from '@lvn/contracts/domain'
import type { Prisma } from '@lvn-backend/prisma-base'

/** What a viewer may see of a note: OWNER and EDITOR work on the draft, READER sees the published version (§4.3). */
export type NoteAccess = 'OWNER' | 'EDITOR' | 'READER'

/** The columns of a note that decide who may see it. */
export interface NoteAccessRow {
  id: string
  ownerId: string
  visibility: Visibility
  forkingEnabled: boolean
  publishedVersionId: string | null
  deletedAt: Date | null
  /** Set on forks: what the origin was when forked, and how the forker could reach it (ADR-0010) */
  forkedFromVisibility?: Visibility | null
  forkedAsRole?: 'OWNER' | 'EDITOR' | 'READER' | null
}

/** The facts `can()` needs about one note for one actor; `shareRole` is the actor's NoteShare row, if any. */
export function noteFacts(note: NoteAccessRow, shareRole: 'EDITOR' | 'VIEWER' | null): NoteFacts {
  return {
    ownerId: note.ownerId,
    visibility: note.visibility,
    forkingEnabled: note.forkingEnabled,
    ...(shareRole ? { shareRole } : {}),
    ...(note.forkedFromVisibility ? { fork: { originVisibilityAtFork: note.forkedFromVisibility, forkedAsOwnerOrEditor: note.forkedAsRole === 'OWNER' || note.forkedAsRole === 'EDITOR' } } : {}),
  }
}

/**
 * The viewer's access, or null when the note is invisible to them — which callers report exactly like a note that does
 * not exist, so ids reveal nothing (§5). On top of the matrix's `note.read`: a trashed note is visible to its owner
 * only, and a reader needs a published version to have anything to read.
 */
export function noteAccess(actor: Actor | null, note: NoteAccessRow, shareRole: 'EDITOR' | 'VIEWER' | null): NoteAccess | null {
  if (actor?.id === note.ownerId) return 'OWNER'
  if (note.deletedAt) return null
  const facts = noteFacts(note, shareRole)
  if (!can(actor, Action.NOTE_READ, { kind: 'note', note: facts })) return null
  if (actor && can(actor, Action.NOTE_EDIT_DRAFT, { kind: 'note', note: facts })) return 'EDITOR'
  return note.publishedVersionId ? 'READER' : null
}

/**
 * The same predicate as `noteAccess(...) !== null`, as a Prisma filter (§5: "implement the predicate once as a reusable
 * where builder"): lists, search and every other query over many notes use it, and a test checks that both agree on
 * seeded data. Trashed notes are left out; the owner reaches them through the trash.
 */
export function visibleNotesWhere(actorId: string | null): Prisma.NoteWhereInput {
  const published: Prisma.NoteWhereInput = { publishedVersionId: { not: null } }
  if (!actorId) return { deletedAt: null, visibility: 'PUBLIC', ...published }
  return {
    deletedAt: null,
    OR: [
      { ownerId: actorId },
      { visibility: 'PUBLIC', ...published },
      { visibility: { in: ['SHARED', 'PUBLIC'] }, shares: { some: { userId: actorId, role: 'EDITOR' } } },
      { visibility: { in: ['SHARED', 'PUBLIC'] }, shares: { some: { userId: actorId, role: 'VIEWER' } }, ...published },
    ],
  }
}

/** What the viewer may do, for clients to show or hide controls (the API checks again on every mutation). */
export function notePermissions(actor: Actor | null, note: NoteAccessRow, shareRole: 'EDITOR' | 'VIEWER' | null) {
  const resource = { kind: 'note' as const, note: noteFacts(note, shareRole) }
  return {
    edit: can(actor, Action.NOTE_EDIT_DRAFT, resource),
    publish: can(actor, Action.NOTE_PUBLISH, resource),
    changeVisibility: can(actor, Action.NOTE_CHANGE_VISIBILITY, resource),
    delete: can(actor, Action.NOTE_DELETE, resource),
    share: can(actor, Action.NOTE_SHARE, resource),
    fork: can(actor, Action.NOTE_FORK, resource),
  }
}
