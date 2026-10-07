import { ClassroomRole, GlobalRole, GroupRole, NoteRole, Visibility } from './enums'

/**
 * The permission matrix (spec §5), defined once. The backend's PolicyService loads the facts
 * (ownership, shares, memberships) and calls `can()`; web and mobile call the same function only to
 * hide controls. A client answer is never trusted by the server.
 *
 * Owner decisions where the spec's sections disagree (docs/adr/0005-permission-matrix-encoding.md):
 * - Owners may fork their own notes at any visibility, PRIVATE included; anyone else needs read access and
 *   forking enabled.
 * - A share EDITOR edits the draft while the note is SHARED or PUBLIC; only the owner publishes, so readers
 *   never see an editor's change until the owner releases it (§4.3).
 * - Email verification is required to publish, request to join a group and comment (§7.1).
 * - Restricted minors cannot make a note PUBLIC (§5, §15.2); the flag is applied before the matrix.
 *
 * Membership is by approval (docs/adr/0009-membership-by-approval.md): joining a group or classroom is a
 * request that a group Admin/Owner or the classroom's Teacher/TA accepts. A classroom invite sent by staff is
 * that acceptance given in advance.
 */

export const Action = {
  NOTE_READ: 'note.read',
  NOTE_EDIT_DRAFT: 'note.editDraft',
  NOTE_PUBLISH: 'note.publish',
  NOTE_CHANGE_VISIBILITY: 'note.changeVisibility',
  NOTE_DELETE: 'note.delete',
  NOTE_SHARE: 'note.share',
  NOTE_FORK: 'note.fork',
  NOTE_COMMENT: 'note.comment',
  NOTE_ASK_AI: 'note.askAi',
  FILE_READ: 'file.read',
  GROUP_CREATE: 'group.create',
  GROUP_REQUEST_JOIN: 'group.requestJoin',
  GROUP_REVIEW_JOIN_REQUESTS: 'group.reviewJoinRequests',
  GROUP_POST: 'group.post',
  GROUP_MODERATE_POSTS: 'group.moderatePosts',
  GROUP_MANAGE: 'group.manage',
  GROUP_DELETE: 'group.delete',
  GROUP_MODERATE_REPORTS: 'group.moderateReports',
  CLASSROOM_CREATE: 'classroom.create',
  CLASSROOM_REQUEST_JOIN: 'classroom.requestJoin',
  CLASSROOM_ACCEPT_INVITE: 'classroom.acceptInvite',
  CLASSROOM_REVIEW_JOIN_REQUESTS: 'classroom.reviewJoinRequests',
  CLASSROOM_PUBLISH_QUIZ: 'classroom.publishQuiz',
  CLASSROOM_VIEW_PERFORMANCE: 'classroom.viewPerformance',
  CLASSROOM_MODERATE_REPORTS: 'classroom.moderateReports',
  PERSONAL_STUDY_CREATE: 'study.create',
  CONTENT_REPORT: 'content.report',
} as const
export type Action = (typeof Action)[keyof typeof Action]

/** Who is asking. `null` = anonymous visitor. */
export interface Actor {
  id: string
  globalRole: GlobalRole
  emailVerified: boolean
  /** Minor without verified consent (§15.2): no PUBLIC publishing. */
  restrictedMinor?: boolean
}

/** What the backend knows about one note relative to the actor. */
export interface NoteFacts {
  ownerId: string
  visibility: Visibility
  forkingEnabled: boolean
  /** The actor's NoteShare role, if any. */
  shareRole?: typeof NoteRole.EDITOR | typeof NoteRole.VIEWER
  /** The note is shared to a group the actor belongs to. */
  sharedToActorsGroup?: boolean
  /** The note is shared to a classroom the actor belongs to. */
  sharedToActorsClassroom?: boolean
}

export type Resource =
  | { kind: 'none' }
  | { kind: 'note'; note: NoteFacts; targetVisibility?: Visibility }
  | {
      kind: 'group'
      /** The actor's role in the group; undefined = not a member. */
      role?: GroupRole
      /** The actor already has a pending request to join this group. */
      pendingJoinRequest?: boolean
    }
  | {
      kind: 'classroom'
      /** The actor's role in the classroom; undefined = not a member. */
      role?: ClassroomRole
      /** Whose results are being viewed (CLASSROOM_VIEW_PERFORMANCE). */
      targetUserId?: string
      /** The actor already has a pending request to join this classroom. */
      pendingJoinRequest?: boolean
      /** The classroom's Teacher or TA has invited the actor and the invite is still valid. */
      invitedByStaff?: boolean
    }

/** Note-level relationship, from strongest to weakest — the columns of the §5 table. */
export type NoteRelation = 'OWNER' | 'EDITOR' | 'VIEWER' | 'GROUP_SHARE' | 'CLASSROOM_SHARE' | 'ANY_USER' | 'ANONYMOUS'

export function noteRelations(actor: Actor | null, note: NoteFacts): Set<NoteRelation> {
  const r = new Set<NoteRelation>()
  if (!actor) return r.add('ANONYMOUS')
  r.add('ANY_USER')
  if (actor.id === note.ownerId) r.add('OWNER')
  if (note.shareRole === NoteRole.EDITOR) r.add('EDITOR')
  if (note.shareRole === NoteRole.VIEWER) r.add('VIEWER')
  if (note.sharedToActorsGroup) r.add('GROUP_SHARE')
  if (note.sharedToActorsClassroom) r.add('CLASSROOM_SHARE')
  return r
}

/** Read access per visibility — the first three rows of §5. Everything note-related builds on it. */
export const NOTE_READERS: Record<Visibility, readonly NoteRelation[]> = {
  PRIVATE: ['OWNER'],
  SHARED: ['OWNER', 'EDITOR', 'VIEWER', 'GROUP_SHARE', 'CLASSROOM_SHARE'],
  PUBLIC: ['OWNER', 'EDITOR', 'VIEWER', 'GROUP_SHARE', 'CLASSROOM_SHARE', 'ANY_USER', 'ANONYMOUS'],
}

const GROUP_RANK: Record<GroupRole, number> = {
  [GroupRole.MEMBER]: 1,
  [GroupRole.MODERATOR]: 2,
  [GroupRole.ADMIN]: 3,
  [GroupRole.OWNER]: 4,
}

const atLeast = (role: GroupRole | undefined, min: GroupRole) => role !== undefined && GROUP_RANK[role] >= GROUP_RANK[min]
const isClassStaff = (role?: ClassroomRole) => role === ClassroomRole.TEACHER || role === ClassroomRole.TA

function readable(actor: Actor | null, note: NoteFacts): boolean {
  const relations = noteRelations(actor, note)
  return NOTE_READERS[note.visibility].some((r) => relations.has(r))
}

export function can(actor: Actor | null, action: Action, resource: Resource = { kind: 'none' }): boolean {
  switch (resource.kind) {
    case 'note': {
      const { note } = resource
      const isOwner = actor?.id === note.ownerId
      switch (action) {
        case Action.NOTE_READ:
        case Action.FILE_READ:
          return readable(actor, note)
        case Action.NOTE_EDIT_DRAFT:
          // A PRIVATE note is readable by its owner only, so share rows on it grant nothing until it is shared again.
          return isOwner || (actor !== null && note.visibility !== Visibility.PRIVATE && note.shareRole === NoteRole.EDITOR)
        case Action.NOTE_PUBLISH:
        case Action.NOTE_CHANGE_VISIBILITY:
          if (!isOwner || !actor!.emailVerified) return false
          return !(resource.targetVisibility === Visibility.PUBLIC && actor!.restrictedMinor)
        case Action.NOTE_DELETE:
        case Action.NOTE_SHARE:
          return isOwner
        case Action.NOTE_FORK:
          return actor !== null && readable(actor, note) && (isOwner || note.forkingEnabled)
        case Action.NOTE_COMMENT:
          return actor !== null && actor.emailVerified && readable(actor, note)
        case Action.NOTE_ASK_AI:
          return actor !== null && readable(actor, note)
        default:
          return false
      }
    }
    case 'group': {
      if (!actor) return false
      switch (action) {
        case Action.GROUP_POST:
          return atLeast(resource.role, GroupRole.MEMBER)
        case Action.GROUP_MODERATE_POSTS:
        case Action.GROUP_MODERATE_REPORTS:
          return atLeast(resource.role, GroupRole.MODERATOR)
        case Action.GROUP_MANAGE:
          return atLeast(resource.role, GroupRole.ADMIN)
        case Action.GROUP_DELETE:
          return resource.role === GroupRole.OWNER
        case Action.GROUP_REQUEST_JOIN:
          return actor.emailVerified && resource.role === undefined && !resource.pendingJoinRequest
        case Action.GROUP_REVIEW_JOIN_REQUESTS:
          return atLeast(resource.role, GroupRole.ADMIN)
        default:
          return false
      }
    }
    case 'classroom': {
      if (!actor) return false
      switch (action) {
        case Action.CLASSROOM_REQUEST_JOIN:
          return resource.role === undefined && !resource.pendingJoinRequest
        case Action.CLASSROOM_ACCEPT_INVITE:
          return resource.role === undefined && resource.invitedByStaff === true
        case Action.CLASSROOM_REVIEW_JOIN_REQUESTS:
        case Action.CLASSROOM_PUBLISH_QUIZ:
        case Action.CLASSROOM_MODERATE_REPORTS:
          return isClassStaff(resource.role)
        case Action.CLASSROOM_VIEW_PERFORMANCE:
          if (isClassStaff(resource.role)) return true
          return resource.role === ClassroomRole.STUDENT && resource.targetUserId === actor.id
        default:
          return false
      }
    }
    case 'none': {
      if (!actor) return false
      switch (action) {
        case Action.GROUP_CREATE:
        case Action.PERSONAL_STUDY_CREATE:
        case Action.CONTENT_REPORT:
          return true
        case Action.CLASSROOM_CREATE:
          return actor.globalRole === GlobalRole.TEACHER
        default:
          return false
      }
    }
  }
}
