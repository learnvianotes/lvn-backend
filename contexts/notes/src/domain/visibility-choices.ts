import { Action, can, type Actor, type Visibility } from '@lvn/contracts/domain'
import { noteFacts, type NoteAccessRow } from './note-access'

/** One value in the visibility control. `reason` is set only when the value is off. */
export interface VisibilityChoice {
  visibility: Visibility
  enabled: boolean
  reason: string | null
}

/**
 * Public follows `public_notes_require_verification` unless a verification gate already set `mayPublishPublic`.
 * That flag wins, so this stays a setting check and not a second verification policy.
 */
export function gatePublic(actor: Actor, requireVerification: boolean): Actor {
  if (actor.mayPublishPublic !== undefined) return actor
  return { ...actor, mayPublishPublic: actor.institutionVerified || !requireVerification }
}

/**
 * What the owner may set. Shared stays in the list only while the note is already Shared, so a person share is not
 * wiped by the control. Unlisted and Public need a published version. The API checks again on the mutation.
 */
export function visibilityChoices(actor: Actor, note: NoteAccessRow, published: boolean): VisibilityChoice[] {
  const targets: Visibility[] = note.visibility === 'SHARED' ? ['PRIVATE', 'SHARED', 'UNLISTED', 'PUBLIC'] : ['PRIVATE', 'UNLISTED', 'PUBLIC']
  return targets.map((visibility) => {
    const allowed = can(actor, Action.NOTE_CHANGE_VISIBILITY, { kind: 'note', note: noteFacts(note, null), targetVisibility: visibility })
    if (!allowed) return { visibility, enabled: false, reason: refused(actor, note, visibility) }
    if ((visibility === 'UNLISTED' || visibility === 'PUBLIC') && !published) {
      return { visibility, enabled: false, reason: 'Publish the note first: readers see the published version.' }
    }
    if ((visibility === 'UNLISTED' || visibility === 'PUBLIC') && (note.moderation === 'HIDDEN' || note.moderation === 'REMOVED')) {
      return { visibility, enabled: false, reason: 'Moderators took this note off the public pages. You can appeal from the note.' }
    }
    return { visibility, enabled: true, reason: null }
  })
}

function refused(actor: Actor, note: NoteAccessRow, visibility: Visibility): string {
  if (visibility === 'PUBLIC' && actor.restrictedMinor) return 'Your account cannot make notes public.'
  if (visibility === 'PUBLIC' && note.forkedFromVisibility && note.forkedFromVisibility !== 'PUBLIC' && note.forkedAsRole !== 'OWNER' && note.forkedAsRole !== 'EDITOR') {
    return 'This note is a copy of a note that was not public, so it cannot be made public.'
  }
  if (visibility === 'PUBLIC') return 'Your account cannot make notes public.'
  if (actor.suspended) return 'Your account is suspended.'
  return 'You cannot set this.'
}
