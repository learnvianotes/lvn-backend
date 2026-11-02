import { AiTaskType, ClassroomRole, GlobalRole, GroupJoinPolicy, GroupPrivacy, GroupRole, GroupType, NoteKind, ResourceStatus, VerificationMethod, Visibility } from '../../../src/domain/enums'
import { Action, aiTaskAction, BLOCKED_WHILE_SUSPENDED, can, NEEDS_VERIFIED_ACCOUNT, parseUnverifiedGateSetting, unverifiedGatesFromSetting, verificationBlocks, type Actor, type NoteFacts, type Resource } from '../../../src/domain/permissions'

/**
 * One assertion per cell of the §5 table that has a defined value. If this file and the spec disagree,
 * the spec wins and this file (and permissions.ts) change in the same PR.
 */

const student = (id: string, extra: Partial<Actor> = {}): Actor => ({ id, globalRole: GlobalRole.STUDENT, institutionVerified: true, ...extra })
/** A verified teacher, the TEACHER global role (ADR-0073: only they admit students to the class they teach). */
const verifiedTeacher = student('verified-teacher', { globalRole: GlobalRole.TEACHER })
const owner = student('owner')
const other = student('other')
const anon = null

const note = (visibility: Visibility, extra: Partial<NoteFacts> = {}): NoteFacts => ({ ownerId: 'owner', visibility, forkingEnabled: true, ...extra })

type Relation = 'owner' | 'editor' | 'viewer' | 'groupShare' | 'classShare' | 'connectionShare' | 'anyUser' | 'anonymous'
const RELATIONS: Relation[] = ['owner', 'editor', 'viewer', 'groupShare', 'classShare', 'connectionShare', 'anyUser', 'anonymous']

function as(relation: Relation, n: NoteFacts): [Actor | null, NoteFacts] {
  switch (relation) {
    case 'owner': return [owner, n]
    case 'editor': return [other, { ...n, shareRole: 'EDITOR' }]
    case 'viewer': return [other, { ...n, shareRole: 'VIEWER' }]
    case 'groupShare': return [other, { ...n, sharedToActorsGroup: true }]
    case 'classShare': return [other, { ...n, sharedToActorsClassroom: true }]
    case 'connectionShare': return [other, { ...n, sharedToActorAsConnection: true }]
    case 'anyUser': return [other, n]
    case 'anonymous': return [anon, n]
  }
}

function expectRow(action: Action, visibility: Visibility, allowed: Relation[]) {
  for (const relation of RELATIONS) {
    const [actor, facts] = as(relation, note(visibility))
    expect({ action, visibility, relation, allowed: can(actor, action, { kind: 'note', note: facts }) })
      .toEqual({ action, visibility, relation, allowed: allowed.includes(relation) })
  }
}

describe('note rows of §5', () => {
  it('read', () => {
    expectRow(Action.NOTE_READ, 'PRIVATE', ['owner'])
    expectRow(Action.NOTE_READ, 'SHARED', ['owner', 'editor', 'viewer', 'groupShare', 'classShare', 'connectionShare'])
    expectRow(Action.NOTE_READ, 'UNLISTED', RELATIONS)
    expectRow(Action.NOTE_READ, 'PUBLIC', RELATIONS)
  })

  it('attachments follow read on the parent note', () => {
    for (const v of Object.values(Visibility)) {
      for (const r of RELATIONS) {
        const [actor, facts] = as(r, note(v))
        expect(can(actor, Action.FILE_READ, { kind: 'note', note: facts })).toBe(can(actor, Action.NOTE_READ, { kind: 'note', note: facts }))
      }
    }
  })

  it('edit draft: owner always, share editor while SHARED or PUBLIC (ADR-0005)', () => {
    expectRow(Action.NOTE_EDIT_DRAFT, 'PRIVATE', ['owner'])
    expectRow(Action.NOTE_EDIT_DRAFT, 'SHARED', ['owner', 'editor'])
    expectRow(Action.NOTE_EDIT_DRAFT, 'UNLISTED', ['owner', 'editor'])
    expectRow(Action.NOTE_EDIT_DRAFT, 'PUBLIC', ['owner', 'editor'])
  })

  it('a share editor still cannot publish what they edited', () => {
    const [actor, facts] = as('editor', note('PUBLIC'))
    expect(can(actor, Action.NOTE_PUBLISH, { kind: 'note', note: facts })).toBe(false)
  })

  it('publish / change visibility / delete / share: owner only', () => {
    for (const a of [Action.NOTE_PUBLISH, Action.NOTE_CHANGE_VISIBILITY, Action.NOTE_DELETE, Action.NOTE_SHARE]) {
      for (const v of Object.values(Visibility)) expectRow(a, v, ['owner'])
    }
  })

  it('fork: anyone who can read it and is signed in; owners fork their own PRIVATE notes (ADR-0005)', () => {
    expectRow(Action.NOTE_FORK, 'PRIVATE', ['owner'])
    expectRow(Action.NOTE_FORK, 'SHARED', ['owner', 'editor', 'viewer', 'groupShare', 'classShare', 'connectionShare'])
    expectRow(Action.NOTE_FORK, 'UNLISTED', ['owner', 'editor', 'viewer', 'groupShare', 'classShare', 'connectionShare', 'anyUser'])
    expectRow(Action.NOTE_FORK, 'PUBLIC', ['owner', 'editor', 'viewer', 'groupShare', 'classShare', 'connectionShare', 'anyUser'])
  })

  it('converting an attached PDF into an editable note follows the fork rule (ADR-0025)', () => {
    for (const v of Object.values(Visibility)) {
      for (const r of RELATIONS) {
        const [actor, facts] = as(r, note(v, { forkingEnabled: r === 'editor' }))
        expect(can(actor, Action.FILE_CONVERT_TO_NOTE, { kind: 'note', note: facts })).toBe(can(actor, Action.NOTE_FORK, { kind: 'note', note: facts }))
      }
    }
  })

  it('AI tasks that create a copy need the fork right; the others need Ask-AI (ADR-0025)', () => {
    expect(aiTaskAction(AiTaskType.CREATE_NOTES)).toBe(Action.NOTE_FORK)
    expect(aiTaskAction(AiTaskType.OUTLINE_TO_NOTE)).toBe(Action.NOTE_FORK)
    for (const t of [AiTaskType.SUMMARIZE, AiTaskType.QUIZ, AiTaskType.TRANSLATE, AiTaskType.FLASHCARDS]) expect(aiTaskAction(t)).toBe(Action.NOTE_ASK_AI)
  })

  it('fork: disabled forking blocks everyone but the owner (§4.4)', () => {
    const facts = note('PUBLIC', { forkingEnabled: false })
    expect(can(other, Action.NOTE_FORK, { kind: 'note', note: facts })).toBe(false)
    expect(can(owner, Action.NOTE_FORK, { kind: 'note', note: facts })).toBe(true)
  })

  it('comment and ask AI: readable and signed in', () => {
    for (const a of [Action.NOTE_COMMENT, Action.NOTE_ASK_AI]) {
      expectRow(a, 'PRIVATE', ['owner'])
      expectRow(a, 'SHARED', ['owner', 'editor', 'viewer', 'groupShare', 'classShare', 'connectionShare'])
      expectRow(a, 'UNLISTED', ['owner', 'editor', 'viewer', 'groupShare', 'classShare', 'connectionShare', 'anyUser'])
      expectRow(a, 'PUBLIC', ['owner', 'editor', 'viewer', 'groupShare', 'classShare', 'connectionShare', 'anyUser'])
    }
  })

  it('an unverified account can comment and cannot publish (§7.1, ADR-0017)', () => {
    const unverified = student('owner', { institutionVerified: false })
    expect(can(unverified, Action.NOTE_COMMENT, { kind: 'note', note: note('PUBLIC') })).toBe(true)
    expect(can(unverified, Action.NOTE_PUBLISH, { kind: 'note', note: note('PRIVATE') })).toBe(false)
  })

  it('an unverified owner can set Private, Shared and Unlisted; Public waits on mayPublishPublic', () => {
    const unverified = student('owner', { institutionVerified: false })
    const n = note('PRIVATE', { ownerId: 'owner' })
    const change = (target: Visibility, extra: Partial<Actor> = {}) =>
      can({ ...unverified, ...extra }, Action.NOTE_CHANGE_VISIBILITY, { kind: 'note', note: n, targetVisibility: target })
    expect(change('PRIVATE')).toBe(true)
    expect(change('SHARED')).toBe(true)
    expect(change('UNLISTED')).toBe(true)
    expect(change('PUBLIC')).toBe(false)
    expect(change('PUBLIC', { mayPublishPublic: true })).toBe(true)
    expect(can(unverified, Action.NOTE_CHANGE_VISIBILITY, { kind: 'note', note: n })).toBe(true)
  })

  it('restricted minors comment and react on notes shared with them, never on PUBLIC notes (§15.2, ADR-0047)', () => {
    const minor = student('viewer', { restrictedMinor: true })
    expect(can(minor, Action.NOTE_COMMENT, { kind: 'note', note: { ...note('SHARED'), shareRole: 'VIEWER' } })).toBe(true)
    expect(can(minor, Action.NOTE_COMMENT, { kind: 'note', note: { ...note('PUBLIC'), shareRole: 'VIEWER' } })).toBe(false)
    expect(can(minor, Action.NOTE_COMMENT, { kind: 'note', note: note('PUBLIC') })).toBe(false)
  })

  it('restricted minors cannot make a note PUBLIC but can share it (§15.2)', () => {
    const minor = student('owner', { restrictedMinor: true })
    expect(can(minor, Action.NOTE_PUBLISH, { kind: 'note', note: note('PRIVATE'), targetVisibility: 'PUBLIC' })).toBe(false)
    expect(can(minor, Action.NOTE_CHANGE_VISIBILITY, { kind: 'note', note: note('PRIVATE'), targetVisibility: 'SHARED' })).toBe(true)
  })

  describe('publishing a fork (ADR-0010)', () => {
    // The fork belongs to its forker, so the forker is `owner` here.
    const fork = (originVisibilityAtFork: Visibility, forkedAsOwnerOrEditor: boolean) =>
      note('PRIVATE', { fork: { originVisibilityAtFork, forkedAsOwnerOrEditor } })
    const toPublic = (n: NoteFacts) => can(owner, Action.NOTE_PUBLISH, { kind: 'note', note: n, targetVisibility: 'PUBLIC' })

    it('a fork of a PUBLIC note can be published publicly by anyone who forked it', () => {
      expect(toPublic(fork('PUBLIC', false))).toBe(true)
    })

    it("an Editor's fork of a SHARED note can be published publicly", () => {
      expect(toPublic(fork('SHARED', true))).toBe(true)
    })

    it("a viewer's or group member's fork of a SHARED note can never go public, only stay private or be shared", () => {
      expect(toPublic(fork('SHARED', false))).toBe(false)
      expect(can(owner, Action.NOTE_CHANGE_VISIBILITY, { kind: 'note', note: fork('SHARED', false), targetVisibility: 'SHARED' })).toBe(true)
    })

    it('an owner forking their own PRIVATE note may publish the copy', () => {
      expect(toPublic(fork('PRIVATE', true))).toBe(true)
    })

    it('without a target, publishing checks the current visibility', () => {
      const publicFork = { ...fork('SHARED', false), visibility: 'PUBLIC' as const }
      expect(can(owner, Action.NOTE_PUBLISH, { kind: 'note', note: publicFork })).toBe(false)
      expect(can(owner, Action.NOTE_PUBLISH, { kind: 'note', note: fork('SHARED', false) })).toBe(true)
    })
  })

  it('note actions that are not note actions are denied', () => {
    expect(can(owner, Action.GROUP_POST, { kind: 'note', note: note('PUBLIC') })).toBe(false)
  })
})

describe('group rows of §5', () => {
  const g = (role?: GroupRole) => ({ kind: 'group' as const, role })
  const roles = [undefined, GroupRole.MEMBER, GroupRole.MODERATOR, GroupRole.ADMIN, GroupRole.OWNER]
  const allowedFrom = (action: Action, min: number) =>
    roles.forEach((role, i) => expect([action, role, can(other, action, g(role))]).toEqual([action, role, i >= min]))

  it('post: members and up', () => allowedFrom(Action.GROUP_POST, 1))
  it('remove post, mute, moderate reports: moderators and up', () => {
    allowedFrom(Action.GROUP_MODERATE_POSTS, 2)
    allowedFrom(Action.GROUP_MODERATE_REPORTS, 2)
  })
  it('manage members, roles, settings: admin and owner', () => allowedFrom(Action.GROUP_MANAGE, 3))
  it('delete: owner only', () => allowedFrom(Action.GROUP_DELETE, 4))

  describe('join policy (ADR-0011)', () => {
    const open = { kind: 'group' as const, privacy: GroupPrivacy.PUBLIC, joinPolicy: GroupJoinPolicy.OPEN }

    it('a PUBLIC group set to OPEN is joined directly, without a request', () => {
      expect(can(other, Action.GROUP_JOIN, open)).toBe(true)
      expect(can(other, Action.GROUP_REQUEST_JOIN, open)).toBe(false)
    })

    it('a PUBLIC group set to APPROVAL needs a request', () => {
      const approval = { ...open, joinPolicy: GroupJoinPolicy.APPROVAL }
      expect(can(other, Action.GROUP_JOIN, approval)).toBe(false)
      expect(can(other, Action.GROUP_REQUEST_JOIN, approval)).toBe(true)
    })

    it('a PRIVATE group always needs a request, whatever the stored policy says', () => {
      const priv = { ...open, privacy: GroupPrivacy.PRIVATE }
      expect(can(other, Action.GROUP_JOIN, priv)).toBe(false)
      expect(can(other, Action.GROUP_REQUEST_JOIN, priv)).toBe(true)
    })

    it('members and anonymous visitors cannot join directly; an unverified account can', () => {
      expect(can(other, Action.GROUP_JOIN, { ...open, role: GroupRole.MEMBER })).toBe(false)
      expect(can(student('x', { institutionVerified: false }), Action.GROUP_JOIN, open)).toBe(true)
      expect(can(anon, Action.GROUP_JOIN, open)).toBe(false)
    })

    it('admins and the owner change the policy through group settings', () => allowedFrom(Action.GROUP_MANAGE, 3))
  })

  it('request to join: non-members without a pending request, verified or not (ADR-0009)', () => {
    expect(can(other, Action.GROUP_REQUEST_JOIN, g())).toBe(true)
    expect(can(other, Action.GROUP_REQUEST_JOIN, g(GroupRole.MEMBER))).toBe(false)
    expect(can(other, Action.GROUP_REQUEST_JOIN, { kind: 'group', pendingJoinRequest: true })).toBe(false)
    expect(can(student('x', { institutionVerified: false }), Action.GROUP_REQUEST_JOIN, g())).toBe(true)
  })

  it('review join requests: admin and owner only (ADR-0009)', () => allowedFrom(Action.GROUP_REVIEW_JOIN_REQUESTS, 3))

  it('anonymous visitors and unrelated actions are denied', () => {
    expect(can(anon, Action.GROUP_POST, g(GroupRole.OWNER))).toBe(false)
    expect(can(other, Action.NOTE_READ, g(GroupRole.OWNER))).toBe(false)
  })
})

describe('project workspaces (ADR-0015)', () => {
  const teacherActor = student('t', { globalRole: GlobalRole.TEACHER })
  const ws = (role?: GroupRole, extra: object = {}): Resource => ({ kind: 'group', type: GroupType.PROJECT, role, ...extra })
  const community = (role?: GroupRole, extra: object = {}): Resource => ({ kind: 'group', type: GroupType.COMMUNITY, role, ...extra })
  const team = [GroupRole.MEMBER, GroupRole.MODERATOR, GroupRole.ADMIN, GroupRole.OWNER]

  it('admins and the owner invite a teacher as mentor; only to project workspaces, never a student', () => {
    const invite = (role: GroupRole, inviteeGlobalRole: GlobalRole, scope = ws) =>
      can(other, Action.GROUP_INVITE_MENTOR, scope(role, { inviteeGlobalRole }))
    expect(invite(GroupRole.ADMIN, GlobalRole.TEACHER)).toBe(true)
    expect(invite(GroupRole.OWNER, GlobalRole.TEACHER)).toBe(true)
    expect(invite(GroupRole.MODERATOR, GlobalRole.TEACHER)).toBe(false)
    expect(invite(GroupRole.ADMIN, GlobalRole.STUDENT)).toBe(false)
    expect(invite(GroupRole.ADMIN, GlobalRole.TEACHER, community)).toBe(false)
  })

  it('the invited teacher accepts to become mentor', () => {
    expect(can(teacherActor, Action.GROUP_ACCEPT_MENTOR_INVITE, ws(undefined, { mentorInvitePending: true }))).toBe(true)
    expect(can(teacherActor, Action.GROUP_ACCEPT_MENTOR_INVITE, ws())).toBe(false)
    expect(can(other, Action.GROUP_ACCEPT_MENTOR_INVITE, ws(undefined, { mentorInvitePending: true }))).toBe(false)
    expect(can(teacherActor, Action.GROUP_ACCEPT_MENTOR_INVITE, ws(GroupRole.MEMBER, { mentorInvitePending: true }))).toBe(false)
    expect(can(teacherActor, Action.GROUP_ACCEPT_MENTOR_INVITE, community(undefined, { mentorInvitePending: true }))).toBe(false)
  })

  it('the team asks doubts; the team and the mentor answer them', () => {
    for (const role of team) {
      expect(can(other, Action.GROUP_ASK_DOUBT, ws(role))).toBe(true)
      expect(can(other, Action.GROUP_ANSWER_DOUBT, ws(role))).toBe(true)
    }
    expect(can(teacherActor, Action.GROUP_ASK_DOUBT, ws(GroupRole.MENTOR))).toBe(false)
    expect(can(teacherActor, Action.GROUP_ANSWER_DOUBT, ws(GroupRole.MENTOR))).toBe(true)
    for (const a of [Action.GROUP_ASK_DOUBT, Action.GROUP_ANSWER_DOUBT]) {
      expect(can(other, a, ws())).toBe(false)
      expect(can(other, a, community(GroupRole.MEMBER))).toBe(false)
    }
  })

  it('the mentor, admins, the owner and the asker resolve a doubt', () => {
    expect(can(teacherActor, Action.GROUP_RESOLVE_DOUBT, ws(GroupRole.MENTOR))).toBe(true)
    expect(can(other, Action.GROUP_RESOLVE_DOUBT, ws(GroupRole.ADMIN))).toBe(true)
    expect(can(other, Action.GROUP_RESOLVE_DOUBT, ws(GroupRole.MEMBER, { isDoubtAuthor: true }))).toBe(true)
    expect(can(other, Action.GROUP_RESOLVE_DOUBT, ws(GroupRole.MEMBER))).toBe(false)
    expect(can(other, Action.GROUP_RESOLVE_DOUBT, ws(undefined, { isDoubtAuthor: true }))).toBe(false)
    expect(can(other, Action.GROUP_RESOLVE_DOUBT, community(GroupRole.ADMIN))).toBe(false)
  })

  it('the mentor posts and moderates but never admits members, changes settings or deletes', () => {
    const mentor = ws(GroupRole.MENTOR)
    expect(can(teacherActor, Action.GROUP_POST, mentor)).toBe(true)
    expect(can(teacherActor, Action.GROUP_MODERATE_POSTS, mentor)).toBe(true)
    expect(can(teacherActor, Action.GROUP_MODERATE_REPORTS, mentor)).toBe(true)
    for (const a of [Action.GROUP_REVIEW_JOIN_REQUESTS, Action.GROUP_MANAGE, Action.GROUP_DELETE, Action.GROUP_INVITE_MENTOR]) {
      expect(can(teacherActor, a, ws(GroupRole.MENTOR, { inviteeGlobalRole: GlobalRole.TEACHER }))).toBe(false)
    }
  })
})

describe('classroom rows of §5', () => {
  const c = (role?: ClassroomRole, targetUserId?: string) => ({ kind: 'classroom' as const, role, targetUserId })

  it('request to join: non-members without a pending request (ADR-0009)', () => {
    expect(can(other, Action.CLASSROOM_REQUEST_JOIN, c())).toBe(true)
    expect(can(other, Action.CLASSROOM_REQUEST_JOIN, c(ClassroomRole.STUDENT))).toBe(false)
    expect(can(other, Action.CLASSROOM_REQUEST_JOIN, { kind: 'classroom', pendingJoinRequest: true })).toBe(false)
  })

  it('accept invite: only a non-member the staff invited (ADR-0009)', () => {
    expect(can(other, Action.CLASSROOM_ACCEPT_INVITE, { kind: 'classroom', invitedByStaff: true })).toBe(true)
    expect(can(other, Action.CLASSROOM_ACCEPT_INVITE, c())).toBe(false)
    expect(can(other, Action.CLASSROOM_ACCEPT_INVITE, { kind: 'classroom', role: ClassroomRole.STUDENT, invitedByStaff: true })).toBe(false)
  })

  it('post, publish quiz and moderate reports: teacher and TA, a teacher applicant too (ADR-0073)', () => {
    const applicant = student('p', { teacherApplicant: true })
    for (const a of [Action.CLASSROOM_POST, Action.CLASSROOM_PUBLISH_QUIZ, Action.CLASSROOM_MODERATE_REPORTS]) {
      expect(can(verifiedTeacher, a, c(ClassroomRole.TEACHER))).toBe(true)
      expect(can(applicant, a, c(ClassroomRole.TEACHER))).toBe(true)
      expect(can(other, a, c(ClassroomRole.TA))).toBe(true)
      expect(can(other, a, c(ClassroomRole.STUDENT))).toBe(false)
      expect(can(other, a, c())).toBe(false)
    }
  })

  it('admit people (join requests, invites): the class’s teacher only once verified as a teacher, and TAs (ADR-0073)', () => {
    expect(can(verifiedTeacher, Action.CLASSROOM_REVIEW_JOIN_REQUESTS, c(ClassroomRole.TEACHER))).toBe(true)
    expect(can(other, Action.CLASSROOM_REVIEW_JOIN_REQUESTS, c(ClassroomRole.TA))).toBe(true)
    expect(can(student('p', { teacherApplicant: true }), Action.CLASSROOM_REVIEW_JOIN_REQUESTS, c(ClassroomRole.TEACHER))).toBe(false)
    expect(can(other, Action.CLASSROOM_REVIEW_JOIN_REQUESTS, c(ClassroomRole.STUDENT))).toBe(false)
  })

  it('view performance: staff see everyone, students only themselves', () => {
    expect(can(other, Action.CLASSROOM_VIEW_PERFORMANCE, c(ClassroomRole.TA, 'someone'))).toBe(true)
    expect(can(verifiedTeacher, Action.CLASSROOM_VIEW_PERFORMANCE, c(ClassroomRole.TEACHER, 'someone'))).toBe(true)
    expect(can(student('p', { teacherApplicant: true }), Action.CLASSROOM_VIEW_PERFORMANCE, c(ClassroomRole.TEACHER, 'someone'))).toBe(false)
    expect(can(other, Action.CLASSROOM_VIEW_PERFORMANCE, c(ClassroomRole.STUDENT, 'other'))).toBe(true)
    expect(can(other, Action.CLASSROOM_VIEW_PERFORMANCE, c(ClassroomRole.STUDENT, 'someone'))).toBe(false)
    expect(can(other, Action.CLASSROOM_VIEW_PERFORMANCE, c(undefined, 'other'))).toBe(false)
  })

  it('anonymous visitors and unrelated actions are denied', () => {
    expect(can(anon, Action.CLASSROOM_REQUEST_JOIN, c())).toBe(false)
    expect(can(other, Action.GROUP_POST, c(ClassroomRole.TEACHER))).toBe(false)
  })
})

describe('teacher network (ADR-0013)', () => {
  const teacher = (id: string, extra: Partial<Actor> = {}) => student(id, { globalRole: GlobalRole.TEACHER, ...extra })
  const t1 = teacher('t1')
  const towards = (extra: object = {}, targetGlobalRole: GlobalRole = GlobalRole.TEACHER) =>
    ({ kind: 'user' as const, targetId: 't2', targetGlobalRole, ...extra })

  it('teachers follow other teachers, once', () => {
    expect(can(t1, Action.USER_FOLLOW, towards())).toBe(true)
    expect(can(t1, Action.USER_FOLLOW, towards({ following: true }))).toBe(false)
    expect(can(t1, Action.USER_UNFOLLOW, towards({ following: true }))).toBe(true)
    expect(can(t1, Action.USER_UNFOLLOW, towards())).toBe(false)
  })

  it('students and teachers follow teachers; never themselves or across a block (ADR-0014)', () => {
    expect(can(other, Action.USER_FOLLOW, towards())).toBe(true)
    expect(can(t1, Action.USER_FOLLOW, towards())).toBe(true)
    for (const actor of [other, t1]) expect(can(actor, Action.USER_FOLLOW, towards({ blocked: true }))).toBe(false)
    expect(can(t1, Action.USER_FOLLOW, { ...towards(), targetId: 't1' })).toBe(false)
    expect(can(anon, Action.USER_FOLLOW, towards())).toBe(false)
  })

  it('students and teachers follow students, never a restricted minor (ADR-0016, ADR-0020)', () => {
    const aStudent = (extra: object = {}) => towards(extra, GlobalRole.STUDENT)
    for (const actor of [other, t1]) {
      expect(can(actor, Action.USER_FOLLOW, aStudent())).toBe(true)
      expect(can(actor, Action.USER_FOLLOW, aStudent({ targetRestrictedMinor: true }))).toBe(false)
      expect(can(actor, Action.USER_FOLLOW, aStudent({ following: true }))).toBe(false)
      expect(can(actor, Action.USER_FOLLOW, aStudent({ blocked: true }))).toBe(false)
    }
    expect(can(t1, Action.USER_FOLLOW, towards({}, GlobalRole.PLATFORM_ADMIN))).toBe(false)
  })

  it('anyone removes a follower, blocks, restricts, and undoes their own block or restriction (ADR-0016)', () => {
    for (const actor of [other, t1]) {
      expect(can(actor, Action.USER_REMOVE_FOLLOWER, towards({ followsActor: true }))).toBe(true)
      expect(can(actor, Action.USER_REMOVE_FOLLOWER, towards())).toBe(false)
      expect(can(actor, Action.USER_BLOCK, towards())).toBe(true)
      expect(can(actor, Action.USER_BLOCK, towards({ blocked: true, blockedByActor: true }))).toBe(false)
      expect(can(actor, Action.USER_UNBLOCK, towards({ blocked: true, blockedByActor: true }))).toBe(true)
      expect(can(actor, Action.USER_UNBLOCK, towards({ blocked: true }))).toBe(false)
      expect(can(actor, Action.USER_RESTRICT, towards())).toBe(true)
      expect(can(actor, Action.USER_RESTRICT, towards({ restrictedByActor: true }))).toBe(false)
      expect(can(actor, Action.USER_RESTRICT, towards({ blocked: true, blockedByActor: true }))).toBe(false)
      expect(can(actor, Action.USER_UNRESTRICT, towards({ restrictedByActor: true }))).toBe(true)
      expect(can(actor, Action.USER_UNRESTRICT, towards())).toBe(false)
    }
  })

  it('you can block someone who blocked you, but never yourself', () => {
    expect(can(other, Action.USER_BLOCK, towards({ blocked: true }))).toBe(true)
    for (const a of [Action.USER_BLOCK, Action.USER_RESTRICT]) expect(can(t1, a, { ...towards(), targetId: 't1' })).toBe(false)
    expect(can(anon, Action.USER_BLOCK, towards())).toBe(false)
  })

  it('connect is teacher-to-teacher only, never yourself, never across a block', () => {
    expect(can(other, Action.USER_REQUEST_CONNECTION, towards())).toBe(false)
    expect(can(t1, Action.USER_REQUEST_CONNECTION, towards({}, GlobalRole.STUDENT))).toBe(false)
    expect(can(t1, Action.USER_REQUEST_CONNECTION, { ...towards(), targetId: 't1' })).toBe(false)
    expect(can(t1, Action.USER_REQUEST_CONNECTION, towards({ blocked: true }))).toBe(false)
    expect(can(anon, Action.USER_REQUEST_CONNECTION, towards())).toBe(false)
  })

  it('only the teacher sees who follows them; everyone else sees a count', () => {
    expect(can(t1, Action.USER_VIEW_FOLLOWERS, { ...towards(), targetId: 't1' })).toBe(true)
    expect(can(other, Action.USER_VIEW_FOLLOWERS, towards())).toBe(false)
  })

  it('anyone signed in writes notes and projects; blogs and posts are for teachers (ADR-0014, ADR-0015)', () => {
    const create = (actor: Actor | null, noteKind: NoteKind) => can(actor, Action.NOTE_CREATE, { kind: 'newNote', noteKind })
    expect(create(other, NoteKind.NOTE)).toBe(true)
    expect(create(other, NoteKind.PROJECT)).toBe(true)
    for (const k of [NoteKind.BLOG, NoteKind.POST]) {
      expect(create(t1, k)).toBe(true)
      expect(create(other, k)).toBe(false)
    }
    expect(create(anon, NoteKind.NOTE)).toBe(false)
    expect(can(t1, Action.NOTE_READ, { kind: 'newNote', noteKind: NoteKind.BLOG })).toBe(false)
  })

  it('connection requests: not already connected, nothing pending either way', () => {
    expect(can(t1, Action.USER_REQUEST_CONNECTION, towards())).toBe(true)
    expect(can(teacher('t1', { institutionVerified: false }), Action.USER_REQUEST_CONNECTION, towards())).toBe(true)
    expect(can(t1, Action.USER_REQUEST_CONNECTION, towards({ connected: true }))).toBe(false)
    expect(can(t1, Action.USER_REQUEST_CONNECTION, towards({ pendingConnection: 'OUTGOING' }))).toBe(false)
    expect(can(t1, Action.USER_REQUEST_CONNECTION, towards({ pendingConnection: 'INCOMING' }))).toBe(false)
  })

  it('only the recipient answers a request; either side removes a connection', () => {
    expect(can(t1, Action.USER_RESPOND_TO_CONNECTION, towards({ pendingConnection: 'INCOMING' }))).toBe(true)
    expect(can(t1, Action.USER_RESPOND_TO_CONNECTION, towards({ pendingConnection: 'OUTGOING' }))).toBe(false)
    expect(can(t1, Action.USER_RESPOND_TO_CONNECTION, towards({ pendingConnection: 'INCOMING', blocked: true }))).toBe(false)
    expect(can(t1, Action.USER_REMOVE_CONNECTION, towards({ connected: true }))).toBe(true)
    expect(can(t1, Action.USER_REMOVE_CONNECTION, towards())).toBe(false)
    expect(can(t1, Action.NOTE_READ, towards())).toBe(false)
  })

  describe('sharing a note', () => {
    const own = note('SHARED', { ownerId: 't1' })
    const share = (actor: Actor, shareTarget?: object) => can(actor, Action.NOTE_SHARE, { kind: 'note', note: { ...own, ownerId: actor.id }, shareTarget: shareTarget as never })

    it('a teacher shares with another teacher only when connected or co-teaching', () => {
      expect(share(t1, { kind: 'USER', recipientIsTeacher: true })).toBe(false)
      expect(share(t1, { kind: 'USER', recipientIsTeacher: true, connectedToRecipient: true })).toBe(true)
      expect(share(t1, { kind: 'USER', recipientIsTeacher: true, coTeachesWithRecipient: true })).toBe(true)
    })

    it('other user shares, group and classroom shares are unchanged', () => {
      expect(share(t1, { kind: 'USER', recipientIsTeacher: false })).toBe(true)
      expect(share(owner, { kind: 'USER', recipientIsTeacher: true })).toBe(true)
      expect(share(t1, { kind: 'GROUP' })).toBe(true)
      expect(share(t1, { kind: 'CLASSROOM' })).toBe(true)
      expect(share(t1)).toBe(true)
    })

    it('"all my connections" is for teachers, and only the owner shares', () => {
      expect(share(t1, { kind: 'CONNECTIONS' })).toBe(true)
      expect(share(owner, { kind: 'CONNECTIONS' })).toBe(false)
      expect(can(other, Action.NOTE_SHARE, { kind: 'note', note: own, shareTarget: { kind: 'CONNECTIONS' } })).toBe(false)
    })
  })
})

describe('verified account (ADR-0017)', () => {
  const unverified = student('u', { institutionVerified: false })
  const pub = { kind: 'note' as const, note: note('PUBLIC', { ownerId: 'u' }) }

  it('an unverified account reads, keeps private notes, imports, exports, reports and blocks', () => {
    expect(can(unverified, Action.NOTE_READ, pub)).toBe(true)
    expect(can(unverified, Action.NOTE_CREATE, { kind: 'newNote', noteKind: NoteKind.NOTE })).toBe(true)
    expect(can(unverified, Action.NOTE_EDIT_DRAFT, pub)).toBe(true)
    for (const a of [Action.ACCOUNT_IMPORT_NOTES, Action.ACCOUNT_EXPORT_DATA, Action.CONTENT_REPORT, Action.PERSONAL_STUDY_CREATE]) {
      expect(can(unverified, a)).toBe(true)
    }
    expect(can(unverified, Action.USER_BLOCK, { kind: 'user', targetId: 'x', targetGlobalRole: GlobalRole.STUDENT })).toBe(true)
  })

  it('publishing, sharing, contests, payouts, bulk AI and resource submission stay gated', () => {
    expect(can(unverified, Action.NOTE_PUBLISH, pub)).toBe(false)
    expect(can(unverified, Action.NOTE_SHARE, pub)).toBe(false)
    expect(can(unverified, Action.CONTEST_ENTER)).toBe(false)
    expect(can(unverified, Action.PAYOUT_REQUEST)).toBe(false)
    expect(can(unverified, Action.AI_BULK)).toBe(false)
    expect(can(unverified, Action.RESOURCE_SUBMIT)).toBe(false)
    expect(can(unverified, Action.NOTE_COMMENT, pub)).toBe(true)
    expect(can(unverified, Action.GROUP_CREATE)).toBe(true)
    expect(can(unverified, Action.GROUP_POST, { kind: 'group', role: GroupRole.MEMBER })).toBe(true)
    expect(can(unverified, Action.CLASSROOM_REQUEST_JOIN, { kind: 'classroom' })).toBe(true)
    expect(can(unverified, Action.USER_FOLLOW, { kind: 'user', targetId: 'x', targetGlobalRole: GlobalRole.TEACHER })).toBe(true)
    expect(can(unverified, Action.RESOURCE_RECOMMEND)).toBe(true)
  })

  it('visibility other than Public is not blocked by note.share; Public follows mayPublishPublic', () => {
    const mine = { kind: 'note' as const, note: note('PUBLIC', { ownerId: 'u' }) }
    expect(can(unverified, Action.NOTE_CHANGE_VISIBILITY, { ...mine, targetVisibility: 'PRIVATE' })).toBe(true)
    expect(can(unverified, Action.NOTE_CHANGE_VISIBILITY, { ...mine, targetVisibility: 'SHARED' })).toBe(true)
    expect(can(unverified, Action.NOTE_CHANGE_VISIBILITY, { ...mine, targetVisibility: 'UNLISTED' })).toBe(true)
    expect(can(unverified, Action.NOTE_CHANGE_VISIBILITY, { ...mine, targetVisibility: 'PUBLIC' })).toBe(false)
    expect(can({ ...unverified, mayPublishPublic: true }, Action.NOTE_CHANGE_VISIBILITY, { ...mine, targetVisibility: 'PUBLIC' })).toBe(true)
    const listed = { ...unverified, unverifiedGates: new Set<Action>([Action.NOTE_CHANGE_VISIBILITY]) }
    expect(can(listed, Action.NOTE_CHANGE_VISIBILITY, { ...mine, targetVisibility: 'PRIVATE' })).toBe(false)
    const open = { ...unverified, unverifiedGates: new Set<Action>() }
    expect(can(open, Action.NOTE_PUBLISH, pub)).toBe(true)
    expect(can(open, Action.NOTE_CHANGE_VISIBILITY, { ...mine, targetVisibility: 'PUBLIC' })).toBe(false)
    expect(can({ ...open, mayPublishPublic: true }, Action.NOTE_CHANGE_VISIBILITY, { ...mine, targetVisibility: 'PUBLIC' })).toBe(true)
  })

  it('parses the admin list, and verificationBlocks follows it', () => {
    const parsed = parseUnverifiedGateSetting('note.publish, ,note.share')
    expect(parsed.ok && [...parsed.actions].sort()).toEqual(['note.publish', 'note.share'])
    expect(parseUnverifiedGateSetting('not.real').ok).toBe(false)
    expect(unverifiedGatesFromSetting(null)).toBe(NEEDS_VERIFIED_ACCOUNT)
    expect([...unverifiedGatesFromSetting('')]).toEqual([])
    expect(unverifiedGatesFromSetting('not.real')).toBe(NEEDS_VERIFIED_ACCOUNT)
    const pub = { kind: 'note' as const, note: note('SHARED', { ownerId: 'u' }) }
    expect(verificationBlocks(null, Action.NOTE_PUBLISH)).toBe(false)
    expect(verificationBlocks(student('v'), Action.NOTE_PUBLISH)).toBe(false)
    expect(verificationBlocks(unverified, Action.NOTE_PUBLISH, pub)).toBe(true)
    expect(verificationBlocks(unverified, Action.NOTE_COMMENT, pub)).toBe(false)
    expect(can(unverified, Action.NOTE_CHANGE_VISIBILITY, pub)).toBe(true)
    expect(can(student('v'), Action.CONTEST_ENTER)).toBe(true)
    expect(can(student('v'), Action.PAYOUT_REQUEST)).toBe(true)
    expect(can(student('v'), Action.AI_BULK)).toBe(true)
  })

  it('the default gated set is the abuse-prone list, and a suspended account still blocks the broad set', () => {
    expect([...NEEDS_VERIFIED_ACCOUNT].sort()).toEqual([
      'ai.bulk', 'contest.enter', 'note.publish', 'note.share', 'payout.request', 'resource.submit',
    ])
    for (const a of NEEDS_VERIFIED_ACCOUNT) expect(BLOCKED_WHILE_SUSPENDED.has(a)).toBe(true)
    for (const a of [Action.NOTE_COMMENT, Action.USER_FOLLOW, Action.GROUP_CREATE, Action.ACCOUNT_REVIEW_VERIFICATION]) {
      expect(BLOCKED_WHILE_SUSPENDED.has(a)).toBe(true)
    }
  })
})

describe('verification without an institutional email (ADR-0019)', () => {
  const unverified = student('u', { institutionVerified: false })
  const byTeacher = (extra: object = {}): Resource => ({ kind: 'verification', method: VerificationMethod.TEACHER, ...extra })
  const byDocuments = (extra: object = {}): Resource => ({ kind: 'verification', method: VerificationMethod.DOCUMENTS, ...extra })
  const teacher = student('t', { globalRole: GlobalRole.TEACHER })
  const admin = student('a', { globalRole: GlobalRole.PLATFORM_ADMIN })

  it('an unverified user asks a verified teacher, or sends documents to platform admins — one request at a time', () => {
    expect(can(unverified, Action.ACCOUNT_REQUEST_VERIFICATION, byTeacher({ targetIsVerifiedTeacher: true }))).toBe(true)
    expect(can(unverified, Action.ACCOUNT_REQUEST_VERIFICATION, byTeacher())).toBe(false)
    expect(can(unverified, Action.ACCOUNT_REQUEST_VERIFICATION, byDocuments())).toBe(true)
    expect(can(unverified, Action.ACCOUNT_REQUEST_VERIFICATION, byDocuments({ pendingRequest: true }))).toBe(false)
    expect(can(other, Action.ACCOUNT_REQUEST_VERIFICATION, byDocuments())).toBe(false)
    expect(can(anon, Action.ACCOUNT_REQUEST_VERIFICATION, byDocuments())).toBe(false)
  })

  it('restricted minors never upload identity documents; a teacher vouches for them instead', () => {
    const minor = student('m', { institutionVerified: false, restrictedMinor: true })
    expect(can(minor, Action.ACCOUNT_REQUEST_VERIFICATION, byDocuments())).toBe(false)
    expect(can(minor, Action.ACCOUNT_REQUEST_VERIFICATION, byTeacher({ targetIsVerifiedTeacher: true }))).toBe(true)
  })

  it('a verified teacher reviews students who picked them or share their institution, documents included', () => {
    expect(can(teacher, Action.ACCOUNT_REVIEW_VERIFICATION, byTeacher({ addressedToActor: true }))).toBe(true)
    expect(can(teacher, Action.ACCOUNT_REVIEW_VERIFICATION, byTeacher())).toBe(false)
    expect(can(teacher, Action.ACCOUNT_REVIEW_VERIFICATION, byDocuments({ addressedToActor: true }))).toBe(true)
    expect(can(teacher, Action.ACCOUNT_REVIEW_VERIFICATION, byDocuments({ sameInstitution: true }))).toBe(true)
    expect(can(teacher, Action.ACCOUNT_REVIEW_VERIFICATION, byDocuments())).toBe(false)
    expect(can(teacher, Action.ACCOUNT_REVIEW_VERIFICATION, byDocuments({ purpose: 'TEACHER_ROLE', sameInstitution: true }))).toBe(false)
    expect(can(student('t2', { globalRole: GlobalRole.TEACHER, institutionVerified: false }), Action.ACCOUNT_REVIEW_VERIFICATION, byTeacher({ addressedToActor: true }))).toBe(false)
    expect(can(other, Action.ACCOUNT_REVIEW_VERIFICATION, byTeacher({ addressedToActor: true }))).toBe(false)
  })

  it('a manager reviews every student request, including documents, and not teacher applications', () => {
    const manager = student('m', { globalRole: GlobalRole.MANAGER })
    expect(can(manager, Action.ACCOUNT_REVIEW_VERIFICATION, byDocuments())).toBe(true)
    expect(can(manager, Action.ACCOUNT_REVIEW_VERIFICATION, byTeacher())).toBe(true)
    expect(can(manager, Action.ACCOUNT_REVIEW_VERIFICATION, byDocuments({ purpose: 'TEACHER_ROLE' }))).toBe(false)
    expect(can(student('m2', { globalRole: GlobalRole.MANAGER, institutionVerified: false }), Action.ACCOUNT_REVIEW_VERIFICATION, byDocuments())).toBe(true)
  })

  it('platform admins review every request, documents and teacher applications included', () => {
    expect(can(admin, Action.ACCOUNT_REVIEW_VERIFICATION, byDocuments())).toBe(true)
    expect(can(admin, Action.ACCOUNT_REVIEW_VERIFICATION, byTeacher())).toBe(true)
    expect(can(admin, Action.ACCOUNT_REVIEW_VERIFICATION, byDocuments({ purpose: 'TEACHER_ROLE' }))).toBe(true)
    expect(can(student('a2', { globalRole: GlobalRole.PLATFORM_ADMIN, institutionVerified: false }), Action.ACCOUNT_REVIEW_VERIFICATION, byDocuments())).toBe(true)
    expect(can(student('a2', { globalRole: GlobalRole.PLATFORM_ADMIN, institutionVerified: false, unverifiedGates: new Set([Action.ACCOUNT_REVIEW_VERIFICATION]) }), Action.ACCOUNT_REVIEW_VERIFICATION, byDocuments())).toBe(true)
    expect(can(anon, Action.ACCOUNT_REVIEW_VERIFICATION, byDocuments())).toBe(false)
    expect(can(admin, Action.NOTE_READ, byDocuments())).toBe(false)
  })
})

describe('actions without a resource', () => {
  it('any signed-in user creates groups, personal study items and reports, and exports and imports', () => {
    for (const a of [Action.GROUP_CREATE, Action.PERSONAL_STUDY_CREATE, Action.CONTENT_REPORT, Action.ACCOUNT_EXPORT_DATA, Action.ACCOUNT_IMPORT_NOTES, Action.ACCOUNT_CLAIM_LEGACY_DATA]) {
      expect(can(other, a)).toBe(true)
      expect(can(anon, a)).toBe(false)
    }
  })

  it('only platform admins moderate public content (ADR-0037)', () => {
    expect(can(student('a', { globalRole: GlobalRole.PLATFORM_ADMIN }), Action.CONTENT_MODERATE)).toBe(true)
    expect(can(student('t', { globalRole: GlobalRole.TEACHER }), Action.CONTENT_MODERATE)).toBe(false)
    expect(can(other, Action.CONTENT_MODERATE)).toBe(false)
    expect(can(anon, Action.CONTENT_MODERATE)).toBe(false)
  })

  it('the TEACHER role creates classrooms, and so does a teacher applicant, verified or not (ADR-0073)', () => {
    expect(can(student('t', { globalRole: GlobalRole.TEACHER }), Action.CLASSROOM_CREATE)).toBe(true)
    expect(can(student('p', { teacherApplicant: true, institutionVerified: false }), Action.CLASSROOM_CREATE)).toBe(true)
    expect(can(student('p', { teacherApplicant: true, suspended: true }), Action.CLASSROOM_CREATE)).toBe(false)
    expect(can(other, Action.CLASSROOM_CREATE)).toBe(false)
  })

  it('only a teacher edits a Skills tab, their own (ADR-0012, ADR-0044)', () => {
    expect(can(student('t', { globalRole: GlobalRole.TEACHER }), Action.TEACHER_EDIT_PROFILE)).toBe(true)
    expect(can(other, Action.TEACHER_EDIT_PROFILE)).toBe(false)
    expect(can(student('a', { globalRole: GlobalRole.PLATFORM_ADMIN }), Action.TEACHER_EDIT_PROFILE)).toBe(false)
    expect(can(anon, Action.TEACHER_EDIT_PROFILE)).toBe(false)
  })

  it('resource-bound actions need their resource', () => {
    expect(can(owner, Action.NOTE_READ)).toBe(false)
  })
})

describe('a suspended account (ADR-0053)', () => {
  const suspended = student('owner', { suspended: true })
  const teacher = student('owner', { globalRole: GlobalRole.TEACHER, suspended: true })
  const admin = student('a', { globalRole: GlobalRole.PLATFORM_ADMIN, suspended: true })
  const mine = (visibility: Visibility, targetVisibility?: Visibility): Resource => ({ kind: 'note', note: note(visibility), ...(targetVisibility ? { targetVisibility } : {}) })

  it('reaches nobody: no publishing, sharing, commenting, posting, joining, following or connecting', () => {
    expect(can(suspended, Action.NOTE_PUBLISH, mine(Visibility.SHARED))).toBe(false)
    expect(can(suspended, Action.NOTE_CHANGE_VISIBILITY, mine(Visibility.PRIVATE, Visibility.PUBLIC))).toBe(false)
    expect(can(suspended, Action.NOTE_SHARE, { kind: 'note', note: note(Visibility.SHARED), shareTarget: { kind: 'GROUP' } })).toBe(false)
    expect(can(suspended, Action.NOTE_COMMENT, { kind: 'note', note: note(Visibility.PUBLIC, { ownerId: 'x' }) })).toBe(false)
    expect(can(suspended, Action.GROUP_CREATE)).toBe(false)
    expect(can(suspended, Action.GROUP_POST, { kind: 'group', role: GroupRole.MEMBER })).toBe(false)
    expect(can(suspended, Action.GROUP_JOIN, { kind: 'group', privacy: GroupPrivacy.PUBLIC, joinPolicy: GroupJoinPolicy.OPEN })).toBe(false)
    expect(can(suspended, Action.CLASSROOM_REQUEST_JOIN, { kind: 'classroom' })).toBe(false)
    expect(can(suspended, Action.USER_FOLLOW, { kind: 'user', targetId: 't2', targetGlobalRole: GlobalRole.TEACHER })).toBe(false)
    expect(can(teacher, Action.TEACHER_EDIT_PROFILE)).toBe(false)
  })

  it('runs and moderates nothing for others while it lasts', () => {
    expect(can(suspended, Action.GROUP_MANAGE, { kind: 'group', role: GroupRole.OWNER })).toBe(false)
    expect(can(suspended, Action.GROUP_MODERATE_POSTS, { kind: 'group', role: GroupRole.OWNER })).toBe(false)
    expect(can(suspended, Action.CLASSROOM_REVIEW_JOIN_REQUESTS, { kind: 'classroom', role: ClassroomRole.TEACHER })).toBe(false)
    expect(can(admin, Action.CONTENT_MODERATE)).toBe(false)
  })

  it('keeps its own notes, takes them back to private, copies, blocks, reports and exports', () => {
    expect(can(suspended, Action.NOTE_CREATE, { kind: 'newNote', noteKind: NoteKind.NOTE })).toBe(true)
    expect(can(suspended, Action.NOTE_EDIT_DRAFT, mine(Visibility.PUBLIC))).toBe(true)
    expect(can(suspended, Action.NOTE_DELETE, mine(Visibility.PUBLIC))).toBe(true)
    expect(can(suspended, Action.NOTE_CHANGE_VISIBILITY, mine(Visibility.PUBLIC, Visibility.PRIVATE))).toBe(true)
    expect(can(suspended, Action.NOTE_CHANGE_VISIBILITY, mine(Visibility.PRIVATE, Visibility.UNLISTED))).toBe(false)
    expect(can(suspended, Action.NOTE_CHANGE_VISIBILITY, mine(Visibility.PRIVATE, Visibility.PUBLIC))).toBe(false)
    expect(can(suspended, Action.NOTE_FORK, { kind: 'note', note: note(Visibility.PUBLIC, { ownerId: 'x' }) })).toBe(true)
    expect(can(suspended, Action.USER_BLOCK, { kind: 'user', targetId: 't2', targetGlobalRole: GlobalRole.STUDENT })).toBe(true)
    expect(can(suspended, Action.CONTENT_REPORT)).toBe(true)
    expect(can(suspended, Action.ACCOUNT_EXPORT_DATA)).toBe(true)
  })

  it('every action that needs a verified account is blocked while suspended', () => {
    for (const a of NEEDS_VERIFIED_ACCOUNT) expect(BLOCKED_WHILE_SUSPENDED.has(a)).toBe(true)
  })
})

describe('resources (ADR-0074)', () => {
  const admin = student('a', { globalRole: GlobalRole.PLATFORM_ADMIN })
  const of = (status: ResourceStatus, submittedById = 'owner'): Resource => ({ kind: 'learningResource', submittedById, status })

  it('verified adults submit; child accounts, unverified and suspended accounts and visitors do not', () => {
    expect(can(other, Action.RESOURCE_SUBMIT)).toBe(true)
    expect(can(verifiedTeacher, Action.RESOURCE_SUBMIT)).toBe(true)
    expect(can(student('m', { restrictedMinor: true }), Action.RESOURCE_SUBMIT)).toBe(false)
    expect(can(student('u', { institutionVerified: false }), Action.RESOURCE_SUBMIT)).toBe(false)
    expect(can(student('s', { suspended: true }), Action.RESOURCE_SUBMIT)).toBe(false)
    expect(can(anon, Action.RESOURCE_SUBMIT)).toBe(false)
  })

  it('accounts recommend resources, child accounts too (within their own places); not suspended ones (ADR-0075)', () => {
    expect(can(other, Action.RESOURCE_RECOMMEND)).toBe(true)
    expect(can(student('m', { restrictedMinor: true }), Action.RESOURCE_RECOMMEND)).toBe(true)
    expect(can(student('u', { institutionVerified: false }), Action.RESOURCE_RECOMMEND)).toBe(true)
    expect(can(student('s', { suspended: true }), Action.RESOURCE_RECOMMEND)).toBe(false)
    expect(can(anon, Action.RESOURCE_RECOMMEND)).toBe(false)
  })

  it('an approved resource is everyone’s to read; a waiting or rejected one its submitter’s and the moderators’ alone', () => {
    for (const actor of [owner, other, anon, admin]) expect(can(actor, Action.RESOURCE_READ, of(ResourceStatus.APPROVED))).toBe(true)
    for (const status of [ResourceStatus.PENDING, ResourceStatus.REJECTED]) {
      expect(can(owner, Action.RESOURCE_READ, of(status))).toBe(true)
      expect(can(admin, Action.RESOURCE_READ, of(status))).toBe(true)
      expect(can(other, Action.RESOURCE_READ, of(status))).toBe(false)
      expect(can(verifiedTeacher, Action.RESOURCE_READ, of(status))).toBe(false)
      expect(can(anon, Action.RESOURCE_READ, of(status))).toBe(false)
    }
  })

  it('its submitter edits it until it is approved, and deletes it any time; moderators delete; nobody else does either', () => {
    expect(can(owner, Action.RESOURCE_EDIT, of(ResourceStatus.PENDING))).toBe(true)
    expect(can(owner, Action.RESOURCE_EDIT, of(ResourceStatus.REJECTED))).toBe(true)
    expect(can(owner, Action.RESOURCE_EDIT, of(ResourceStatus.APPROVED))).toBe(false)
    expect(can(student('owner', { suspended: true }), Action.RESOURCE_EDIT, of(ResourceStatus.REJECTED))).toBe(false)
    expect(can(admin, Action.RESOURCE_EDIT, of(ResourceStatus.PENDING))).toBe(false)
    expect(can(other, Action.RESOURCE_EDIT, of(ResourceStatus.PENDING))).toBe(false)
    // An action that is not about resources is refused for one.
    expect(can(owner, Action.NOTE_READ, of(ResourceStatus.APPROVED))).toBe(false)
    for (const status of Object.values(ResourceStatus)) {
      expect(can(owner, Action.RESOURCE_DELETE, of(status))).toBe(true)
      expect(can(admin, Action.RESOURCE_DELETE, of(status))).toBe(true)
      expect(can(other, Action.RESOURCE_DELETE, of(status))).toBe(false)
      expect(can(anon, Action.RESOURCE_DELETE, of(status))).toBe(false)
    }
  })
})
