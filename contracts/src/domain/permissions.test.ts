import { ClassroomRole, GlobalRole, GroupRole, Visibility } from './enums'
import { Action, can, type Actor, type NoteFacts } from './permissions'

/**
 * One assertion per cell of the §5 table that has a defined value. If this file and the spec disagree,
 * the spec wins and this file (and permissions.ts) change in the same PR.
 */

const student = (id: string, extra: Partial<Actor> = {}): Actor => ({ id, globalRole: GlobalRole.STUDENT, emailVerified: true, ...extra })
const owner = student('owner')
const other = student('other')
const anon = null

const note = (visibility: Visibility, extra: Partial<NoteFacts> = {}): NoteFacts => ({ ownerId: 'owner', visibility, forkingEnabled: true, ...extra })

type Relation = 'owner' | 'editor' | 'viewer' | 'groupShare' | 'classShare' | 'anyUser' | 'anonymous'
const RELATIONS: Relation[] = ['owner', 'editor', 'viewer', 'groupShare', 'classShare', 'anyUser', 'anonymous']

function as(relation: Relation, n: NoteFacts): [Actor | null, NoteFacts] {
  switch (relation) {
    case 'owner': return [owner, n]
    case 'editor': return [other, { ...n, shareRole: 'EDITOR' }]
    case 'viewer': return [other, { ...n, shareRole: 'VIEWER' }]
    case 'groupShare': return [other, { ...n, sharedToActorsGroup: true }]
    case 'classShare': return [other, { ...n, sharedToActorsClassroom: true }]
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
    expectRow(Action.NOTE_READ, 'SHARED', ['owner', 'editor', 'viewer', 'groupShare', 'classShare'])
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

  it('edit draft: owner always, share editor only while SHARED (§4.2)', () => {
    expectRow(Action.NOTE_EDIT_DRAFT, 'PRIVATE', ['owner'])
    expectRow(Action.NOTE_EDIT_DRAFT, 'SHARED', ['owner', 'editor'])
    expectRow(Action.NOTE_EDIT_DRAFT, 'PUBLIC', ['owner'])
  })

  it('publish / change visibility / delete / share: owner only', () => {
    for (const a of [Action.NOTE_PUBLISH, Action.NOTE_CHANGE_VISIBILITY, Action.NOTE_DELETE, Action.NOTE_SHARE]) {
      for (const v of Object.values(Visibility)) expectRow(a, v, ['owner'])
    }
  })

  it('fork: readable, never PRIVATE, any signed-in user for PUBLIC', () => {
    expectRow(Action.NOTE_FORK, 'PRIVATE', [])
    expectRow(Action.NOTE_FORK, 'SHARED', ['owner', 'editor', 'viewer', 'groupShare', 'classShare'])
    expectRow(Action.NOTE_FORK, 'PUBLIC', ['owner', 'editor', 'viewer', 'groupShare', 'classShare', 'anyUser'])
  })

  it('fork: disabled forking blocks everyone but the owner (§4.4)', () => {
    const facts = note('PUBLIC', { forkingEnabled: false })
    expect(can(other, Action.NOTE_FORK, { kind: 'note', note: facts })).toBe(false)
    expect(can(owner, Action.NOTE_FORK, { kind: 'note', note: facts })).toBe(true)
  })

  it('comment and ask AI: readable and signed in', () => {
    for (const a of [Action.NOTE_COMMENT, Action.NOTE_ASK_AI]) {
      expectRow(a, 'PRIVATE', ['owner'])
      expectRow(a, 'SHARED', ['owner', 'editor', 'viewer', 'groupShare', 'classShare'])
      expectRow(a, 'PUBLIC', ['owner', 'editor', 'viewer', 'groupShare', 'classShare', 'anyUser'])
    }
  })

  it('unverified email cannot comment or publish (§7.1)', () => {
    const unverified = student('owner', { emailVerified: false })
    expect(can(unverified, Action.NOTE_COMMENT, { kind: 'note', note: note('PUBLIC') })).toBe(false)
    expect(can(unverified, Action.NOTE_PUBLISH, { kind: 'note', note: note('PRIVATE') })).toBe(false)
  })

  it('restricted minors cannot make a note PUBLIC but can share it (§15.2)', () => {
    const minor = student('owner', { restrictedMinor: true })
    expect(can(minor, Action.NOTE_PUBLISH, { kind: 'note', note: note('PRIVATE'), targetVisibility: 'PUBLIC' })).toBe(false)
    expect(can(minor, Action.NOTE_CHANGE_VISIBILITY, { kind: 'note', note: note('PRIVATE'), targetVisibility: 'SHARED' })).toBe(true)
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

  it('join: verified non-members only', () => {
    expect(can(other, Action.GROUP_JOIN, g())).toBe(true)
    expect(can(other, Action.GROUP_JOIN, g(GroupRole.MEMBER))).toBe(false)
    expect(can(student('x', { emailVerified: false }), Action.GROUP_JOIN, g())).toBe(false)
  })

  it('anonymous visitors and unrelated actions are denied', () => {
    expect(can(anon, Action.GROUP_POST, g(GroupRole.OWNER))).toBe(false)
    expect(can(other, Action.NOTE_READ, g(GroupRole.OWNER))).toBe(false)
  })
})

describe('classroom rows of §5', () => {
  const c = (role?: ClassroomRole, targetUserId?: string) => ({ kind: 'classroom' as const, role, targetUserId })

  it('join: non-members via code or invite', () => {
    expect(can(other, Action.CLASSROOM_JOIN, c())).toBe(true)
    expect(can(other, Action.CLASSROOM_JOIN, c(ClassroomRole.STUDENT))).toBe(false)
  })

  it('publish quiz and moderate reports: teacher and TA', () => {
    for (const a of [Action.CLASSROOM_PUBLISH_QUIZ, Action.CLASSROOM_MODERATE_REPORTS]) {
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
    expect(can(anon, Action.CLASSROOM_JOIN, c())).toBe(false)
    expect(can(other, Action.GROUP_POST, c(ClassroomRole.TEACHER))).toBe(false)
  })
})

describe('actions without a resource', () => {
  it('any signed-in user creates groups, personal study items and reports', () => {
    for (const a of [Action.GROUP_CREATE, Action.PERSONAL_STUDY_CREATE, Action.CONTENT_REPORT]) {
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
