import { ClassroomRole, GlobalRole, GroupJoinPolicy, GroupPrivacy, GroupRole, GroupType, NoteKind, Visibility } from './enums'
import { Action, can, NEEDS_VERIFIED_ACCOUNT, type Actor, type NoteFacts, type Resource } from './permissions'

/**
 * One assertion per cell of the §5 table that has a defined value. If this file and the spec disagree,
 * the spec wins and this file (and permissions.ts) change in the same PR.
 */

const student = (id: string, extra: Partial<Actor> = {}): Actor => ({ id, globalRole: GlobalRole.STUDENT, institutionVerified: true, ...extra })
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
    expectRow(Action.NOTE_FORK, 'PUBLIC', ['owner', 'editor', 'viewer', 'groupShare', 'classShare', 'connectionShare', 'anyUser'])
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
      expectRow(a, 'PUBLIC', ['owner', 'editor', 'viewer', 'groupShare', 'classShare', 'connectionShare', 'anyUser'])
    }
  })

  it('an unverified account cannot comment or publish (§7.1, ADR-0017)', () => {
    const unverified = student('owner', { institutionVerified: false })
    expect(can(unverified, Action.NOTE_COMMENT, { kind: 'note', note: note('PUBLIC') })).toBe(false)
    expect(can(unverified, Action.NOTE_PUBLISH, { kind: 'note', note: note('PRIVATE') })).toBe(false)
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

    it('members, unverified users and anonymous visitors cannot join directly', () => {
      expect(can(other, Action.GROUP_JOIN, { ...open, role: GroupRole.MEMBER })).toBe(false)
      expect(can(student('x', { institutionVerified: false }), Action.GROUP_JOIN, open)).toBe(false)
      expect(can(anon, Action.GROUP_JOIN, open)).toBe(false)
    })

    it('admins and the owner change the policy through group settings', () => allowedFrom(Action.GROUP_MANAGE, 3))
  })

  it('request to join: verified non-members without a pending request (ADR-0009)', () => {
    expect(can(other, Action.GROUP_REQUEST_JOIN, g())).toBe(true)
    expect(can(other, Action.GROUP_REQUEST_JOIN, g(GroupRole.MEMBER))).toBe(false)
    expect(can(other, Action.GROUP_REQUEST_JOIN, { kind: 'group', pendingJoinRequest: true })).toBe(false)
    expect(can(student('x', { institutionVerified: false }), Action.GROUP_REQUEST_JOIN, g())).toBe(false)
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

  it('review join requests, publish quiz and moderate reports: teacher and TA', () => {
    for (const a of [Action.CLASSROOM_REVIEW_JOIN_REQUESTS, Action.CLASSROOM_PUBLISH_QUIZ, Action.CLASSROOM_MODERATE_REPORTS]) {
      expect(can(other, a, c(ClassroomRole.TEACHER))).toBe(true)
      expect(can(other, a, c(ClassroomRole.TA))).toBe(true)
      expect(can(other, a, c(ClassroomRole.STUDENT))).toBe(false)
      expect(can(other, a, c())).toBe(false)
    }
  })

  it('view performance: staff see everyone, students only themselves', () => {
    expect(can(other, Action.CLASSROOM_VIEW_PERFORMANCE, c(ClassroomRole.TA, 'someone'))).toBe(true)
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

  it('students follow students, except restricted minors; teachers do not follow students (ADR-0016)', () => {
    const aStudent = (extra: object = {}) => towards(extra, GlobalRole.STUDENT)
    expect(can(other, Action.USER_FOLLOW, aStudent())).toBe(true)
    expect(can(other, Action.USER_FOLLOW, aStudent({ targetRestrictedMinor: true }))).toBe(false)
    expect(can(other, Action.USER_FOLLOW, aStudent({ following: true }))).toBe(false)
    expect(can(other, Action.USER_FOLLOW, aStudent({ blocked: true }))).toBe(false)
    expect(can(t1, Action.USER_FOLLOW, aStudent())).toBe(false)
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

  it('connection requests: verified, not already connected, nothing pending either way', () => {
    expect(can(t1, Action.USER_REQUEST_CONNECTION, towards())).toBe(true)
    expect(can(teacher('t1', { institutionVerified: false }), Action.USER_REQUEST_CONNECTION, towards())).toBe(false)
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

  it('nothing that reaches other people works until the college or organisation email is confirmed', () => {
    expect(can(unverified, Action.NOTE_PUBLISH, pub)).toBe(false)
    expect(can(unverified, Action.NOTE_SHARE, pub)).toBe(false)
    expect(can(unverified, Action.NOTE_COMMENT, pub)).toBe(false)
    expect(can(unverified, Action.GROUP_CREATE)).toBe(false)
    expect(can(unverified, Action.GROUP_POST, { kind: 'group', role: GroupRole.MEMBER })).toBe(false)
    expect(can(unverified, Action.CLASSROOM_REQUEST_JOIN, { kind: 'classroom' })).toBe(false)
    expect(can(unverified, Action.USER_FOLLOW, { kind: 'user', targetId: 'x', targetGlobalRole: GlobalRole.TEACHER })).toBe(false)
  })

  it('the gated set is exactly the actions that reach other people', () => {
    expect([...NEEDS_VERIFIED_ACCOUNT].sort()).toEqual([
      'classroom.acceptInvite', 'classroom.create', 'classroom.requestJoin',
      'group.acceptMentorInvite', 'group.answerDoubt', 'group.askDoubt', 'group.create', 'group.join', 'group.post', 'group.requestJoin',
      'note.changeVisibility', 'note.comment', 'note.publish', 'note.share',
      'user.follow', 'user.requestConnection', 'user.respondToConnection',
    ])
  })
})

describe('actions without a resource', () => {
  it('any signed-in user creates groups, personal study items and reports, and exports and imports', () => {
    for (const a of [Action.GROUP_CREATE, Action.PERSONAL_STUDY_CREATE, Action.CONTENT_REPORT, Action.ACCOUNT_EXPORT_DATA, Action.ACCOUNT_IMPORT_NOTES]) {
      expect(can(other, a)).toBe(true)
      expect(can(anon, a)).toBe(false)
    }
  })

  it('only the TEACHER role creates classrooms; it is never self-selected', () => {
    expect(can(student('t', { globalRole: GlobalRole.TEACHER }), Action.CLASSROOM_CREATE)).toBe(true)
    expect(can(other, Action.CLASSROOM_CREATE)).toBe(false)
  })

  it('resource-bound actions need their resource', () => {
    expect(can(owner, Action.NOTE_READ)).toBe(false)
  })
})
