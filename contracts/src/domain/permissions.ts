import { type AiTaskType, ClassroomRole, DERIVATIVE_AI_TASKS, GlobalRole, GroupJoinPolicy, GroupPrivacy, GroupRole, GroupType, NoteKind, NoteRole, ResourceStatus, VerificationMethod, Visibility } from './enums'

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
 * - A verified account (college or organisation email confirmed, ADR-0017) is required only for the abuse-prone
 *   actions in NEEDS_VERIFIED_ACCOUNT, unless the actor carries a different list (`unverifiedGates`, the admin
 *   setting). Until then an account reads, keeps private notes, studies, comments, follows, and joins groups and
 *   classes. Publishing, sharing, contests, payouts, bulk AI and submitting resources stay gated by default.
 *   Changing a note toward SHARED or PUBLIC follows share and publish. Taking it back to PRIVATE stays allowed
 *   unless `note.changeVisibility` is itself on the list. Without an institutional email, a student asks a verified
 *   teacher to vouch for them, or sends proof of enrolment. A platform admin never needs institution verification:
 *   the role skips every verified-account gate, including review, even when `verifiedAt` is null. A teacher reviews
 *   only once their own account is institution-verified, and only students who addressed them or share their
 *   institution (ADR-0019). Managers, unverified teachers, students and everyone else cannot review. Teacher
 *   applications and role changes stay with platform admins.
 * - Restricted minors cannot make a note PUBLIC (§5, §15.2); the flag is applied before the matrix.
 *
 * A fork can be made PUBLIC only if its origin was PUBLIC when forked, or the forker was the origin's owner or
 * an Editor — so a SHARED note never becomes public through someone else's fork (ADR-0010). Every reader of a
 * fork sees its attribution.
 *
 * Follows (ADR-0013, ADR-0014, ADR-0016, ADR-0020): anyone signed in follows teachers and students, never a
 * restricted minor; following shows public content only and only the followed person sees who follows them.
 * Anyone can remove a follower, block (ends follows and connections both ways, stops new interaction) or restrict
 * (a quieter limit enforced on comments and notifications, not here). Teachers connect with other teachers (a
 * request the other accepts); a teacher shares a note directly with another teacher only if connected or
 * co-teaching, and can share with all connections at once. Teachers publish blogs and posts; anyone publishes
 * projects (ADR-0015) — all are notes of another kind and follow every note rule.
 *
 * Project workspaces (ADR-0015) are groups of type PROJECT: the team (members up to the owner) asks doubts and
 * answers them; a MENTOR — a teacher the admins invited and who accepted — answers and resolves doubts and
 * moderates, but does not admit members, change settings or delete.
 *
 * Membership (ADR-0009, ADR-0011): joining a classroom is always a request that its Teacher or a TA accepts; a
 * staff invite is that acceptance given in advance and the student accepts the invite. A PUBLIC group whose
 * admins set the join policy to OPEN can be joined directly; every other group join is a request that a group
 * Admin/Owner accepts. Changing the join policy is a group setting (GROUP_MANAGE).
 */

export const Action = {
  NOTE_CREATE: 'note.create',
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
  /** Turn a PDF attached to a note into an editable note of one's own (ADR-0025); follows the fork rule. */
  FILE_CONVERT_TO_NOTE: 'file.convertToNote',
  GROUP_CREATE: 'group.create',
  GROUP_JOIN: 'group.join',
  GROUP_REQUEST_JOIN: 'group.requestJoin',
  GROUP_REVIEW_JOIN_REQUESTS: 'group.reviewJoinRequests',
  GROUP_INVITE_MENTOR: 'group.inviteMentor',
  GROUP_ACCEPT_MENTOR_INVITE: 'group.acceptMentorInvite',
  GROUP_ASK_DOUBT: 'group.askDoubt',
  GROUP_ANSWER_DOUBT: 'group.answerDoubt',
  GROUP_RESOLVE_DOUBT: 'group.resolveDoubt',
  GROUP_POST: 'group.post',
  GROUP_MODERATE_POSTS: 'group.moderatePosts',
  GROUP_MANAGE: 'group.manage',
  GROUP_DELETE: 'group.delete',
  GROUP_MODERATE_REPORTS: 'group.moderateReports',
  CLASSROOM_CREATE: 'classroom.create',
  CLASSROOM_REQUEST_JOIN: 'classroom.requestJoin',
  CLASSROOM_ACCEPT_INVITE: 'classroom.acceptInvite',
  /** Admit people: approve join requests, invite, see the members. A class's teacher must be a verified teacher (ADR-0073). */
  CLASSROOM_REVIEW_JOIN_REQUESTS: 'classroom.reviewJoinRequests',
  /** Write and remove announcements: the class's staff (ADR-0073). */
  CLASSROOM_POST: 'classroom.post',
  CLASSROOM_PUBLISH_QUIZ: 'classroom.publishQuiz',
  CLASSROOM_VIEW_PERFORMANCE: 'classroom.viewPerformance',
  CLASSROOM_MODERATE_REPORTS: 'classroom.moderateReports',
  USER_FOLLOW: 'user.follow',
  USER_UNFOLLOW: 'user.unfollow',
  USER_VIEW_FOLLOWERS: 'user.viewFollowers',
  USER_REMOVE_FOLLOWER: 'user.removeFollower',
  USER_BLOCK: 'user.block',
  USER_UNBLOCK: 'user.unblock',
  USER_RESTRICT: 'user.restrict',
  USER_UNRESTRICT: 'user.unrestrict',
  USER_REQUEST_CONNECTION: 'user.requestConnection',
  USER_RESPOND_TO_CONNECTION: 'user.respondToConnection',
  USER_REMOVE_CONNECTION: 'user.removeConnection',
  ACCOUNT_EXPORT_DATA: 'account.exportData',
  ACCOUNT_IMPORT_NOTES: 'account.importNotes',
  ACCOUNT_CLAIM_LEGACY_DATA: 'account.claimLegacyData',
  ACCOUNT_REQUEST_VERIFICATION: 'account.requestVerification',
  ACCOUNT_REVIEW_VERIFICATION: 'account.reviewVerification',
  PERSONAL_STUDY_CREATE: 'study.create',
  /** A teacher edits their own Skills tab (ADR-0012, ADR-0044). */
  TEACHER_EDIT_PROFILE: 'teacher.editProfile',
  CONTENT_REPORT: 'content.report',
  /** The platform moderation queue (§15.1): PLATFORM_ADMIN until the admin app exists (ADR-0037). */
  CONTENT_MODERATE: 'content.moderate',
  /** Resources (§14.4, ADR-0074): submitting one for moderators to approve */
  RESOURCE_SUBMIT: 'resource.submit',
  RESOURCE_READ: 'resource.read',
  /** Its submitter, while it waits or after it was rejected (saving resubmits it) */
  RESOURCE_EDIT: 'resource.edit',
  RESOURCE_DELETE: 'resource.delete',
  /** Recommending an approved resource to a person, a group or a class (ADR-0075) */
  RESOURCE_RECOMMEND: 'resource.recommend',
  /** Enter a published contest. */
  CONTEST_ENTER: 'contest.enter',
  /** Ask for a payout. No payout product exists yet; the action is gated so one cannot ship ungated. */
  PAYOUT_REQUEST: 'payout.request',
  /** AI tasks that write a new note (CREATE_NOTES, OUTLINE_TO_NOTE). */
  AI_BULK: 'ai.bulk',
} as const
export type Action = (typeof Action)[keyof typeof Action]

/** Who is asking. `null` = anonymous visitor. */
export interface Actor {
  id: string
  globalRole: GlobalRole
  /**
   * The account is verified: its college or organisation email was confirmed, a teacher vouched for it, or a
   * platform admin approved its documents (ADR-0017, ADR-0019).
   */
  institutionVerified: boolean
  /** Minor without verified consent (§15.2): no PUBLIC publishing. */
  restrictedMinor?: boolean
  /** Suspended by platform moderators (ADR-0053): nothing that reaches other people until it ends. */
  suspended?: boolean
  /**
   * Asked to be a teacher and waiting for review (ADR-0073): may make classes and prepare them, and edit a teacher
   * profile, but admits no one until a platform admin approves.
   */
  teacherApplicant?: boolean
  /**
   * Action ids this deployment gates until the account is institution-verified. Omitted means
   * {@link NEEDS_VERIFIED_ACCOUNT}. An empty set gates nothing. Web and mobile copy `unverifiedGatedActions` here.
   */
  unverifiedGates?: ReadonlySet<Action>
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
  /** The owner shared the note with all their connections and the actor is one of them (ADR-0013). */
  sharedToActorAsConnection?: boolean
  /** Set when the note is a fork: what the origin was when it was forked (ADR-0010). */
  fork?: ForkFacts
}

export interface ForkFacts {
  /** The origin's visibility at the moment it was forked (later changes to the origin do not matter, §4.2). */
  originVisibilityAtFork: Visibility
  /** The forker was the origin's owner or a share Editor of it when forking. */
  forkedAsOwnerOrEditor: boolean
}

/** Who a note is being shared with (NOTE_SHARE). Group and classroom targets need no extra facts yet. */
export type ShareTargetFacts =
  | {
      kind: 'USER'
      recipientIsTeacher: boolean
      /** The actor and the recipient are connected (ADR-0013). */
      connectedToRecipient?: boolean
      /** The actor and the recipient are Teachers or TAs of the same classroom. */
      coTeachesWithRecipient?: boolean
    }
  | { kind: 'CONNECTIONS' }
  | { kind: 'GROUP' }
  | { kind: 'CLASSROOM' }

export type Resource =
  | { kind: 'none' }
  | { kind: 'note'; note: NoteFacts; targetVisibility?: Visibility; shareTarget?: ShareTargetFacts }
  | { kind: 'newNote'; noteKind: NoteKind }
  | {
      kind: 'verification'
      /** TEACHER: a verified teacher vouches. DOCUMENTS: reviewers look at proof of enrolment (ADR-0019). */
      method: typeof VerificationMethod.TEACHER | typeof VerificationMethod.DOCUMENTS
      /** Requesting: the actor already has a verification request waiting. */
      pendingRequest?: boolean
      /** Requesting by TEACHER: the chosen person is a verified teacher. */
      targetIsVerifiedTeacher?: boolean
      /** Reviewing: the student picked this teacher. */
      addressedToActor?: boolean
      /** Reviewing: the student belongs to the teacher's institution (membership or verified email domain). */
      sameInstitution?: boolean
      /** Reviewing a teacher application is platform-admin only. Absent means a student account request. */
      purpose?: 'ACCOUNT' | 'TEACHER_ROLE'
    }
  | {
      kind: 'user'
      targetId: string
      targetGlobalRole: GlobalRole
      /** The target is a restricted minor (§15.2): never followable. */
      targetRestrictedMinor?: boolean
      /** The actor follows the target. */
      following?: boolean
      /** The target follows the actor (USER_REMOVE_FOLLOWER). */
      followsActor?: boolean
      /** The actor and the target are connected. */
      connected?: boolean
      /** A connection request between them is pending: sent by the actor (OUTGOING) or to the actor (INCOMING). */
      pendingConnection?: 'OUTGOING' | 'INCOMING'
      /** Either of them has blocked the other (§15.1). */
      blocked?: boolean
      /** The actor has blocked the target (USER_UNBLOCK). */
      blockedByActor?: boolean
      /** The actor has restricted the target (ADR-0016). */
      restrictedByActor?: boolean
    }
  | {
      kind: 'group'
      /** The actor's role in the group; undefined = not a member. */
      role?: GroupRole
      type?: GroupType
      privacy?: GroupPrivacy
      joinPolicy?: GroupJoinPolicy
      /** The actor already has a pending request to join this group. */
      pendingJoinRequest?: boolean
      /** PROJECT groups: the actor holds a valid invitation to mentor this team. */
      mentorInvitePending?: boolean
      /** GROUP_INVITE_MENTOR: the global role of the person being invited. */
      inviteeGlobalRole?: GlobalRole
      /** GROUP_RESOLVE_DOUBT: the actor asked this doubt. */
      isDoubtAuthor?: boolean
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
  | {
      /** A resource of the catalogue (ADR-0074) */
      kind: 'learningResource'
      submittedById: string
      status: ResourceStatus
    }

/** Note-level relationship, from strongest to weakest — the columns of the §5 table. */
export type NoteRelation =
  | 'OWNER' | 'EDITOR' | 'VIEWER' | 'GROUP_SHARE' | 'CLASSROOM_SHARE' | 'CONNECTION_SHARE' | 'ANY_USER' | 'ANONYMOUS'

export function noteRelations(actor: Actor | null, note: NoteFacts): Set<NoteRelation> {
  const r = new Set<NoteRelation>()
  if (!actor) return r.add('ANONYMOUS')
  r.add('ANY_USER')
  if (actor.id === note.ownerId) r.add('OWNER')
  if (note.shareRole === NoteRole.EDITOR) r.add('EDITOR')
  if (note.shareRole === NoteRole.VIEWER) r.add('VIEWER')
  if (note.sharedToActorsGroup) r.add('GROUP_SHARE')
  if (note.sharedToActorsClassroom) r.add('CLASSROOM_SHARE')
  if (note.sharedToActorAsConnection) r.add('CONNECTION_SHARE')
  return r
}

/** Read access per visibility — the first three rows of §5. Everything note-related builds on it. */
export const NOTE_READERS: Record<Visibility, readonly NoteRelation[]> = {
  PRIVATE: ['OWNER'],
  SHARED: ['OWNER', 'EDITOR', 'VIEWER', 'GROUP_SHARE', 'CLASSROOM_SHARE', 'CONNECTION_SHARE'],
  PUBLIC: ['OWNER', 'EDITOR', 'VIEWER', 'GROUP_SHARE', 'CLASSROOM_SHARE', 'CONNECTION_SHARE', 'ANY_USER', 'ANONYMOUS'],
}

const GROUP_RANK: Record<GroupRole, number> = {
  [GroupRole.MEMBER]: 1,
  [GroupRole.MODERATOR]: 2,
  [GroupRole.ADMIN]: 3,
  [GroupRole.OWNER]: 4,
  // A mentor posts like a member; its extra powers are granted explicitly below, never through the ladder.
  [GroupRole.MENTOR]: 1,
}

const atLeast = (role: GroupRole | undefined, min: GroupRole) => role !== undefined && GROUP_RANK[role] >= GROUP_RANK[min]
/** The team itself: members up to the owner, not the mentor. */
const onTeam = (role: GroupRole | undefined) => atLeast(role, GroupRole.MEMBER) && role !== GroupRole.MENTOR
/** A PUBLIC group with the OPEN join policy: no approval needed (ADR-0011). */
const openToJoin = (group: { privacy?: GroupPrivacy; joinPolicy?: GroupJoinPolicy }) =>
  group.privacy === GroupPrivacy.PUBLIC && group.joinPolicy === GroupJoinPolicy.OPEN
const isClassStaff = (role?: ClassroomRole) => role === ClassroomRole.TEACHER || role === ClassroomRole.TA
/** The class's own teacher must hold the TEACHER role to bring students in or see their results (ADR-0073). */
const admitsAsTeacher = (actor: Actor, role?: ClassroomRole) => role !== ClassroomRole.TEACHER || actor.globalRole === GlobalRole.TEACHER

/**
 * Which permission an AI task needs on its source (ADR-0025): tasks that create a note of one's own from the source
 * follow the fork rule (so forking-disabled content cannot be copied out through AI); the rest follow Ask-AI.
 */
export function aiTaskAction(task: AiTaskType): Action {
  return DERIVATIVE_AI_TASKS.has(task) ? Action.NOTE_FORK : Action.NOTE_ASK_AI
}

/** Teacher-to-teacher sharing needs a connection or a shared classroom; only teachers have connections (ADR-0013). */
function shareTargetAllowed(actor: Actor, target: ShareTargetFacts | undefined): boolean {
  if (target?.kind === 'CONNECTIONS') return actor.globalRole === GlobalRole.TEACHER
  if (target?.kind === 'USER' && actor.globalRole === GlobalRole.TEACHER && target.recipientIsTeacher) {
    return target.connectedToRecipient === true || target.coTeachesWithRecipient === true
  }
  return true
}

/**
 * Default actions an institution-unverified account cannot do. Comments, follows, groups and classrooms are not
 * here: an admin list can add them. `account.reviewVerification` stays a domain check inside `can()` so an
 * unverified teacher still cannot review. A platform admin skips every institution-verification gate by role.
 */
export const DEFAULT_UNVERIFIED_GATED_ACTIONS: readonly Action[] = [
  Action.NOTE_PUBLISH,
  Action.NOTE_SHARE,
  Action.CONTEST_ENTER,
  Action.PAYOUT_REQUEST,
  Action.AI_BULK,
  Action.RESOURCE_SUBMIT,
]

/** The built-in gate. `can()` uses `actor.unverifiedGates` when the caller set one. */
export const NEEDS_VERIFIED_ACCOUNT: ReadonlySet<Action> = new Set<Action>(DEFAULT_UNVERIFIED_GATED_ACTIONS)

const ACTION_IDS = new Set<string>(Object.values(Action))

/** Comma-separated action ids. Empty gates nothing. An unknown id is refused. */
export function parseUnverifiedGateSetting(raw: string): { ok: true; actions: ReadonlySet<Action> } | { ok: false; message: string } {
  const actions = new Set<Action>()
  for (const part of raw.split(',')) {
    const id = part.trim()
    if (!id) continue
    if (!ACTION_IDS.has(id)) return { ok: false, message: `Unknown action "${id}".` }
    actions.add(id as Action)
  }
  return { ok: true, actions }
}

/** A missing row (`null`) is the default list. A saved string, including empty, is that list. */
export function unverifiedGatesFromSetting(raw: string | null): ReadonlySet<Action> {
  if (raw === null) return NEEDS_VERIFIED_ACCOUNT
  const parsed = parseUnverifiedGateSetting(raw)
  return parsed.ok ? parsed.actions : NEEDS_VERIFIED_ACCOUNT
}

/**
 * What a suspended account cannot do (ADR-0053): everything that reaches other people, and moderating or running
 * places for them. This stays the broad set even when the unverified gate is narrowed. It still reads, keeps and
 * writes its own notes, makes private copies, takes a note back to PRIVATE, leaves places, unfollows, blocks,
 * restricts, reports, exports its data and appeals.
 */
export const BLOCKED_WHILE_SUSPENDED: ReadonlySet<Action> = new Set<Action>([
  Action.NOTE_PUBLISH,
  Action.NOTE_CHANGE_VISIBILITY,
  Action.NOTE_SHARE,
  Action.NOTE_COMMENT,
  Action.GROUP_CREATE,
  Action.GROUP_JOIN,
  Action.GROUP_REQUEST_JOIN,
  Action.GROUP_POST,
  Action.GROUP_ACCEPT_MENTOR_INVITE,
  Action.GROUP_ASK_DOUBT,
  Action.GROUP_ANSWER_DOUBT,
  Action.CLASSROOM_CREATE,
  Action.CLASSROOM_REQUEST_JOIN,
  Action.CLASSROOM_ACCEPT_INVITE,
  Action.USER_FOLLOW,
  Action.USER_REQUEST_CONNECTION,
  Action.USER_RESPOND_TO_CONNECTION,
  Action.ACCOUNT_REVIEW_VERIFICATION,
  Action.RESOURCE_SUBMIT,
  Action.RESOURCE_RECOMMEND,
  Action.CONTEST_ENTER,
  Action.PAYOUT_REQUEST,
  Action.AI_BULK,
  Action.GROUP_REVIEW_JOIN_REQUESTS,
  Action.GROUP_INVITE_MENTOR,
  Action.GROUP_RESOLVE_DOUBT,
  Action.GROUP_MODERATE_POSTS,
  Action.GROUP_MANAGE,
  Action.GROUP_MODERATE_REPORTS,
  Action.CLASSROOM_REVIEW_JOIN_REQUESTS,
  Action.CLASSROOM_POST,
  Action.CLASSROOM_PUBLISH_QUIZ,
  Action.CLASSROOM_MODERATE_REPORTS,
  Action.TEACHER_EDIT_PROFILE,
  Action.CONTENT_MODERATE,
  Action.RESOURCE_EDIT,
])

function readable(actor: Actor | null, note: NoteFacts): boolean {
  const relations = noteRelations(actor, note)
  return NOTE_READERS[note.visibility].some((r) => relations.has(r))
}

/** Taking one's own note back to PRIVATE reaches nobody: a suspended account may still do it. */
function backToPrivate(action: Action, resource: Resource): boolean {
  return action === Action.NOTE_CHANGE_VISIBILITY && resource.kind === 'note' && resource.targetVisibility === Visibility.PRIVATE
}

/** A teacher applicant makes a class before their account is verified: a class with no students reaches nobody. */
const applicantMayDo = (actor: Actor, action: Action) => actor.teacherApplicant === true && action === Action.CLASSROOM_CREATE

function gateSetOf(actor: Actor): ReadonlySet<Action> {
  return actor.unverifiedGates ?? NEEDS_VERIFIED_ACCOUNT
}

/**
 * Whether the institution-verification gate stops this action. SHARED follows `note.share`, PUBLIC follows
 * `note.publish`, and PRIVATE stays open unless `note.changeVisibility` is itself on the list.
 */
function gateApplies(actor: Actor, action: Action, resource: Resource): boolean {
  // The role is enough: a platform admin is never stopped for a missing institution verification.
  if (actor.globalRole === GlobalRole.PLATFORM_ADMIN || applicantMayDo(actor, action)) return false
  const gates = gateSetOf(actor)
  if (action === Action.NOTE_CHANGE_VISIBILITY && resource.kind === 'note') {
    if (gates.has(Action.NOTE_CHANGE_VISIBILITY)) return true
    const target = resource.targetVisibility ?? resource.note.visibility
    if (target === Visibility.PRIVATE) return false
    if (target === Visibility.PUBLIC) return gates.has(Action.NOTE_PUBLISH)
    return gates.has(Action.NOTE_SHARE)
  }
  return gates.has(action)
}

/** True when this person is stopped because their account is not institution-verified. */
export function verificationBlocks(actor: Actor | null | undefined, action: Action, resource: Resource = { kind: 'none' }): boolean {
  return !!actor && !actor.institutionVerified && gateApplies(actor, action, resource)
}

export function can(actor: Actor | null, action: Action, resource: Resource = { kind: 'none' }): boolean {
  if (actor && !actor.institutionVerified && gateApplies(actor, action, resource)) return false
  if (actor?.suspended && BLOCKED_WHILE_SUSPENDED.has(action) && !backToPrivate(action, resource)) return false
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
        case Action.NOTE_CHANGE_VISIBILITY: {
          if (!isOwner) return false
          const goesPublic = (resource.targetVisibility ?? note.visibility) === Visibility.PUBLIC
          if (!goesPublic) return true
          if (actor!.restrictedMinor) return false
          return !note.fork || note.fork.originVisibilityAtFork === Visibility.PUBLIC || note.fork.forkedAsOwnerOrEditor
        }
        case Action.NOTE_DELETE:
          return isOwner
        case Action.NOTE_SHARE:
          return isOwner && shareTargetAllowed(actor!, resource.shareTarget)
        case Action.NOTE_FORK:
        case Action.FILE_CONVERT_TO_NOTE:
          return actor !== null && readable(actor, note) && (isOwner || note.forkingEnabled)
        case Action.NOTE_COMMENT:
          // Commenting or reacting on a PUBLIC note is publishing in public, which restricted minors do not (§15.2, ADR-0047).
          return actor !== null && readable(actor, note) && !(actor.restrictedMinor && note.visibility === Visibility.PUBLIC)
        case Action.NOTE_ASK_AI:
          return actor !== null && readable(actor, note)
        default:
          return false
      }
    }
    case 'group': {
      if (!actor) return false
      const isProject = resource.type === GroupType.PROJECT
      switch (action) {
        case Action.GROUP_POST:
          return atLeast(resource.role, GroupRole.MEMBER)
        case Action.GROUP_MODERATE_POSTS:
        case Action.GROUP_MODERATE_REPORTS:
          return atLeast(resource.role, GroupRole.MODERATOR) || resource.role === GroupRole.MENTOR
        case Action.GROUP_MANAGE:
          return atLeast(resource.role, GroupRole.ADMIN)
        case Action.GROUP_DELETE:
          return resource.role === GroupRole.OWNER
        case Action.GROUP_JOIN:
          return resource.role === undefined && openToJoin(resource)
        case Action.GROUP_REQUEST_JOIN:
          return resource.role === undefined && !resource.pendingJoinRequest && !openToJoin(resource)
        case Action.GROUP_REVIEW_JOIN_REQUESTS:
          return atLeast(resource.role, GroupRole.ADMIN)
        case Action.GROUP_INVITE_MENTOR:
          return isProject && atLeast(resource.role, GroupRole.ADMIN) && resource.inviteeGlobalRole === GlobalRole.TEACHER
        case Action.GROUP_ACCEPT_MENTOR_INVITE:
          return isProject && actor.globalRole === GlobalRole.TEACHER && resource.role === undefined && resource.mentorInvitePending === true
        case Action.GROUP_ASK_DOUBT:
          return isProject && onTeam(resource.role)
        case Action.GROUP_ANSWER_DOUBT:
          return isProject && (onTeam(resource.role) || resource.role === GroupRole.MENTOR)
        case Action.GROUP_RESOLVE_DOUBT:
          return isProject && (
            resource.role === GroupRole.MENTOR ||
            atLeast(resource.role, GroupRole.ADMIN) ||
            (resource.isDoubtAuthor === true && onTeam(resource.role))
          )
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
          // A class's teacher admits people only once verified as a teacher (ADR-0073); TAs were invited by one.
          return isClassStaff(resource.role) && admitsAsTeacher(actor, resource.role)
        case Action.CLASSROOM_POST:
        case Action.CLASSROOM_PUBLISH_QUIZ:
        case Action.CLASSROOM_MODERATE_REPORTS:
          return isClassStaff(resource.role)
        case Action.CLASSROOM_VIEW_PERFORMANCE:
          if (isClassStaff(resource.role)) return admitsAsTeacher(actor, resource.role)
          return resource.role === ClassroomRole.STUDENT && resource.targetUserId === actor.id
        default:
          return false
      }
    }
    case 'user': {
      if (!actor) return false
      const self = actor.id === resource.targetId
      const reachable = !self && !resource.blocked
      const targetIsTeacher = resource.targetGlobalRole === GlobalRole.TEACHER
      // Anyone follows a teacher, and any student who is not a restricted minor (ADR-0016, ADR-0020).
      const followable =
        targetIsTeacher || (resource.targetGlobalRole === GlobalRole.STUDENT && !resource.targetRestrictedMinor)
      const teachers = actor.globalRole === GlobalRole.TEACHER && targetIsTeacher && reachable
      switch (action) {
        case Action.USER_FOLLOW:
          return reachable && followable && !resource.following
        case Action.USER_VIEW_FOLLOWERS:
          return self
        case Action.USER_REMOVE_FOLLOWER:
          return resource.followsActor === true
        case Action.USER_BLOCK:
          return !self && !resource.blockedByActor
        case Action.USER_UNBLOCK:
          return resource.blockedByActor === true
        case Action.USER_RESTRICT:
          return !self && !resource.restrictedByActor && !resource.blockedByActor
        case Action.USER_UNRESTRICT:
          return resource.restrictedByActor === true
        case Action.USER_UNFOLLOW:
          return resource.following === true
        case Action.USER_REQUEST_CONNECTION:
          return teachers && !resource.connected && resource.pendingConnection === undefined
        case Action.USER_RESPOND_TO_CONNECTION:
          return resource.pendingConnection === 'INCOMING' && !resource.blocked
        case Action.USER_REMOVE_CONNECTION:
          return resource.connected === true
        default:
          return false
      }
    }
    case 'verification': {
      if (!actor) return false
      const documents = resource.method === VerificationMethod.DOCUMENTS
      switch (action) {
        case Action.ACCOUNT_REQUEST_VERIFICATION:
          // Restricted minors never upload identity documents; a teacher vouches for them instead.
          if (actor.institutionVerified || resource.pendingRequest) return false
          return documents ? !actor.restrictedMinor : resource.targetIsVerifiedTeacher === true
        case Action.ACCOUNT_REVIEW_VERIFICATION:
          // Teacher applications grant the TEACHER role: platform admins only.
          if (actor.globalRole === GlobalRole.PLATFORM_ADMIN) return true
          if (resource.purpose === 'TEACHER_ROLE') return false
          // A verified teacher reviews students who picked them and students of their own institution, with documents.
          // Managers, unverified teachers and students do not review.
          if (actor.globalRole !== GlobalRole.TEACHER || !actor.institutionVerified) return false
          return resource.addressedToActor === true || resource.sameInstitution === true
        default:
          return false
      }
    }
    case 'learningResource': {
      const mine = actor?.id === resource.submittedById
      const moderator = actor?.globalRole === GlobalRole.PLATFORM_ADMIN
      switch (action) {
        case Action.RESOURCE_READ:
          // Waiting and rejected resources are their submitter's and the moderators' alone (ADR-0074).
          return resource.status === ResourceStatus.APPROVED || mine || moderator
        case Action.RESOURCE_EDIT:
          // An approved resource is the catalogue's: its submitter deletes it rather than changing it.
          return mine && resource.status !== ResourceStatus.APPROVED
        case Action.RESOURCE_DELETE:
          return mine || moderator
        default:
          return false
      }
    }
    case 'newNote':
      // Anyone signed in writes notes and projects; blogs and posts are teacher publications (ADR-0014, ADR-0015).
      if (!actor || action !== Action.NOTE_CREATE) return false
      return resource.noteKind === NoteKind.NOTE || resource.noteKind === NoteKind.PROJECT || actor.globalRole === GlobalRole.TEACHER
    case 'none': {
      if (!actor) return false
      switch (action) {
        case Action.GROUP_CREATE:
        case Action.PERSONAL_STUDY_CREATE:
        case Action.CONTENT_REPORT:
        case Action.ACCOUNT_EXPORT_DATA:
        case Action.ACCOUNT_IMPORT_NOTES:
        case Action.ACCOUNT_CLAIM_LEGACY_DATA:
          return true
        case Action.CLASSROOM_CREATE:
        case Action.TEACHER_EDIT_PROFILE:
          return actor.globalRole === GlobalRole.TEACHER || actor.teacherApplicant === true
        case Action.CONTENT_MODERATE:
          return actor.globalRole === GlobalRole.PLATFORM_ADMIN
        case Action.RESOURCE_RECOMMEND:
          // Where it may go (a person, a group, a class) is the place's own rule (ADR-0075).
          return true
        case Action.RESOURCE_SUBMIT:
          // A resource is public with its submitter's name: child accounts do not publish in public (§15.2).
          return !actor.restrictedMinor
        case Action.CONTEST_ENTER:
        case Action.PAYOUT_REQUEST:
        case Action.AI_BULK:
          return true
        default:
          return false
      }
    }
  }
}
