import { Action } from '@lvn/contracts/domain'
import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * The permission matrix of Phase 3 (§5, §15.1), action by action through the API (spec §18, Phase 3 exit): for every
 * community action, someone the matrix refuses is refused by the API, and someone it allows gets through. The
 * domain function `can()` is tested row by row in @lvn/contracts; this checks that every channel applies it.
 *
 * Every action of groups, classrooms, people, teachers and moderation has a case below, or is named in NOT_YET with
 * the phase that brings its channel; a new action without either fails the last test. MATRIX_WHY=1 prints why each
 * case went as it did, to check that refusals come from the rule and not from a bad input.
 */
describe('security: the permission matrix, action by action', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  type Person = { id: string; handle: string; token: string }
  const person = async (opts: { verified?: boolean; teacher?: boolean; admin?: boolean; minor?: boolean; name?: string } = {}): Promise<Person> => {
    const u = await seedUser(t.app, { verified: opts.verified ?? true, globalRole: opts.admin ? 'PLATFORM_ADMIN' : opts.teacher ? 'TEACHER' : 'STUDENT', displayName: opts.name ?? 'Someone' })
    if (opts.minor) await db.user.update({ where: { id: u.id }, data: { dateOfBirth: new Date('2015-03-01') } })
    return { id: u.id, handle: u.handle, token: tokenFor(t.config, u.id) }
  }
  const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })

  const INPUT: Record<string, string> = {
    createGroup: 'CreateGroupInput', joinGroup: 'GroupIdInput', requestToJoinGroup: 'RequestToJoinGroupInput', reviewGroupJoinRequest: 'ReviewGroupJoinRequestInput',
    createGroupPost: 'CreateGroupPostInput', deleteGroupPost: 'GroupPostIdInput', pinGroupPost: 'PinGroupPostInput', updateGroup: 'UpdateGroupInput', deleteGroup: 'GroupIdInput',
    setGroupRole: 'SetGroupRoleInput', inviteMentor: 'InviteMentorInput', answerMentorInvite: 'AnswerMentorInviteInput', askDoubt: 'AskDoubtInput', answerDoubt: 'AnswerDoubtInput',
    resolveDoubt: 'DoubtIdInput', createClassroom: 'CreateClassroomInput', requestToJoinClassroom: 'RequestToJoinClassroomInput', reviewClassroomJoinRequest: 'ReviewClassroomJoinRequestInput',
    inviteToClassroom: 'InviteToClassroomInput', answerClassroomInvite: 'AnswerClassroomInviteInput', createClassroomPost: 'CreateClassroomPostInput', followUser: 'PersonInput',
    unfollowUser: 'PersonInput', removeFollower: 'PersonInput', blockUser: 'PersonInput', unblockUser: 'PersonInput', restrictUser: 'PersonInput', unrestrictUser: 'PersonInput',
    requestConnection: 'PersonInput', respondToConnectionRequest: 'RespondToConnectionRequestInput', removeConnection: 'PersonInput', updateTeacherProfile: 'UpdateTeacherProfileInput',
    reportContent: 'ReportContentInput', addComment: 'AddCommentInput', moderateContent: 'ModerateContentInput', publishClassQuiz: 'PublishClassQuizInput',
    submitResource: 'SubmitResourceInput', updateResource: 'UpdateResourceInput', deleteResource: 'ResourceIdInput', recommendResource: 'RecommendResourceInput',
  }
  type Outcome = 'allowed' | 'refused'
  /** A mutation's outcome: refused on a GraphQL error (FORBIDDEN, NOT_FOUND, UNAUTHENTICATED) or a user error. */
  const run = async (who: Person | null, name: string, input: object): Promise<{ outcome: Outcome; why: string }> => {
    const res = await t.gql<Record<string, { userErrors: { code: string; message: string }[] }>>(`mutation ($input: ${INPUT[name]}!) { ${name}(input: $input) { userErrors { code message } } }`, { input }, who?.token)
    const error = res.errors?.[0] as { message: string; extensions?: { code?: string } } | undefined
    if (error) return { outcome: 'refused', why: `${error.extensions?.code}: ${error.message}` }
    const userError = res.data![name]!.userErrors[0]
    return userError ? { outcome: 'refused', why: `${userError.code}: ${userError.message}` } : { outcome: 'allowed', why: '' }
  }
  const query = async (who: Person | null, q: string, variables: object = {}): Promise<{ outcome: Outcome; why: string }> => {
    const res = await t.gql(q, variables as Record<string, unknown>, who?.token)
    const error = res.errors?.[0] as { message: string; extensions?: { code?: string } } | undefined
    return error ? { outcome: 'refused', why: `${error.extensions?.code}: ${error.message}` } : { outcome: 'allowed', why: '' }
  }
  /** Runs the cases of one action in order; the test compares "who: outcome" lines, so a failure names the case. */
  const expectCases = async (cases: [label: string, expected: Outcome, attempt: () => Promise<{ outcome: Outcome; why: string }>][]) => {
    const got: string[] = []
    for (const [label, , attempt] of cases) {
      const r = await attempt()
      if (process.env.MATRIX_WHY) console.log(`${label}: ${r.outcome} ${r.why}`)
      got.push(`${label}: ${r.outcome}${r.outcome === 'refused' && cases.find((c) => c[0] === label)![1] === 'allowed' ? ` (${r.why})` : ''}`)
    }
    expect(got).toEqual(cases.map(([label, expected]) => `${label}: ${expected}`))
  }
  const covered = new Set<string>()
  const action = (a: string) => covered.add(a)

  // The world: groups with every role, a project workspace with a mentor, a class with staff and a student.
  let owner: Person, admin: Person, moderator: Person, member: Person, outsider: Person, unverified: Person, minor: Person
  let teacher: Person, teacher2: Person, ta: Person, student: Person, platformAdmin: Person
  let group: string, openGroup: string, privateGroup: string, workspace: string, klass: { id: string; joinCode: string }
  const gid = async (who: Person, input: object) => (await t.gql<{ createGroup: { group: { id: string } } }>('mutation ($input: CreateGroupInput!) { createGroup(input: $input) { group { id } } }', { input }, who.token)).data!.createGroup.group.id
  const join = (who: Person, groupId: string) => run(who, 'joinGroup', { groupId })
  const role = (groupId: string, who: Person, r: string) => run(owner, 'setGroupRole', { groupId, userId: who.id, role: r })
  const postIn = async (who: Person, groupId: string, kind = 'POST') => (await t.gql<{ createGroupPost: { post: { id: string } } }>('mutation ($input: CreateGroupPostInput!) { createGroupPost(input: $input) { post { id } } }', { input: { groupId, body: doc('Hello'), kind } }, who.token)).data!.createGroupPost.post.id
  const requestsOf = async (groupId: string) => (await t.gql<{ group: { joinRequests: { id: string; user: { id: string } }[] } }>('query ($id: UUID!) { group(id: $id) { joinRequests { id user { id } } } }', { id: groupId }, owner.token)).data!.group.joinRequests
  const freshRequest = async () => {
    const who = await person({ name: 'Asker' })
    await run(who, 'requestToJoinGroup', { groupId: group })
    return (await requestsOf(group)).find((r) => r.user.id === who.id)!.id
  }
  const classRequest = async () => {
    const who = await person({ name: 'Pupil' })
    await run(who, 'requestToJoinClassroom', { code: klass.joinCode })
    const list = (await t.gql<{ classroom: { joinRequests: { id: string; user: { id: string } }[] } }>('query ($id: UUID!) { classroom(id: $id) { joinRequests { id user { id } } } }', { id: klass.id }, teacher.token)).data!.classroom.joinRequests
    return list.find((r) => r.user.id === who.id)!.id
  }
  const invite = async (classroomId: string, who: Person, r = 'STUDENT') => {
    await run(teacher, 'inviteToClassroom', { classroomId, person: who.handle, role: r })
    return (await db.classroomInvite.findFirstOrThrow({ where: { classroomId, invitedUserId: who.id }, orderBy: { createdAt: 'desc' } })).id
  }

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
    owner = await person({ name: 'Owner' })
    admin = await person({ name: 'Admin' })
    moderator = await person({ name: 'Moderator' })
    member = await person({ name: 'Member' })
    outsider = await person({ name: 'Outsider' })
    unverified = await person({ verified: false, name: 'Unverified' })
    minor = await person({ minor: true, name: 'Young learner' })
    teacher = await person({ teacher: true, name: 'Teacher' })
    teacher2 = await person({ teacher: true, name: 'Teacher Two' })
    ta = await person({ name: 'TA' })
    student = await person({ name: 'Student' })
    platformAdmin = await person({ admin: true, name: 'Platform admin' })

    group = await gid(owner, { name: 'Matrix group', privacy: 'PUBLIC', joinPolicy: 'APPROVAL' })
    openGroup = await gid(owner, { name: 'Open group', privacy: 'PUBLIC', joinPolicy: 'OPEN' })
    privateGroup = await gid(owner, { name: 'Private group', privacy: 'PRIVATE' })
    for (const [who, r] of [[admin, 'ADMIN'], [moderator, 'MODERATOR'], [member, 'MEMBER']] as const) {
      await run(who, 'requestToJoinGroup', { groupId: group })
      const req = (await requestsOf(group)).find((x) => x.user.id === who.id)!
      await run(owner, 'reviewGroupJoinRequest', { requestId: req.id, decision: 'APPROVED' })
      if (r !== 'MEMBER') await role(group, who, r)
    }
    workspace = await gid(owner, { name: 'Matrix project', privacy: 'PRIVATE', type: 'PROJECT' })
    await db.groupMember.create({ data: { groupId: workspace, userId: member.id, role: 'MEMBER' } })
    klass = (await t.gql<{ createClassroom: { classroom: { id: string; joinCode: string } } }>('mutation { createClassroom(input: { name: "Matrix class" }) { classroom { id joinCode } } }', {}, teacher.token)).data!.createClassroom.classroom
    for (const [who, r] of [[ta, 'TA'], [student, 'STUDENT']] as const) await run(who, 'answerClassroomInvite', { inviteId: await invite(klass.id, who, r), accept: true })
    await bus.drain()
  })
  afterAll(() => t.close())

  it('groups: create, join, ask to join, and review requests (ADR-0009, ADR-0011, ADR-0045)', async () => {
    ;[Action.GROUP_CREATE, Action.GROUP_JOIN, Action.GROUP_REQUEST_JOIN, Action.GROUP_REVIEW_JOIN_REQUESTS].forEach(action)
    await expectCases([
      ['create: an unverified account', 'allowed', () => run(unverified, 'createGroup', { name: 'Nope', privacy: 'PUBLIC' })],
      ['create: a verified account', 'allowed', () => run(outsider, 'createGroup', { name: 'Mine', privacy: 'PUBLIC' })],
      ['join an approval group directly', 'refused', () => join(outsider, group)],
      ['join a private group directly', 'refused', () => join(outsider, privateGroup)],
      ['join an open group, unverified', 'allowed', () => join(unverified, openGroup)],
      ['join an open group, verified', 'allowed', () => join(outsider, openGroup)],
      ['ask to join, already a member', 'refused', () => run(member, 'requestToJoinGroup', { groupId: group })],
      ['ask to join, unverified', 'allowed', () => run(unverified, 'requestToJoinGroup', { groupId: group })],
      ['ask to join, verified outsider', 'allowed', () => run(outsider, 'requestToJoinGroup', { groupId: group })],
      ['review a request as a moderator', 'refused', async () => run(moderator, 'reviewGroupJoinRequest', { requestId: await freshRequest(), decision: 'APPROVED' })],
      ['review a request as a member', 'refused', async () => run(member, 'reviewGroupJoinRequest', { requestId: await freshRequest(), decision: 'APPROVED' })],
      ['review a request as an admin', 'allowed', async () => run(admin, 'reviewGroupJoinRequest', { requestId: await freshRequest(), decision: 'REJECTED' })],
    ])
  })

  it('groups: post, moderate posts and reports, manage, delete (ADR-0045, ADR-0051)', async () => {
    ;[Action.GROUP_POST, Action.GROUP_MODERATE_POSTS, Action.GROUP_MODERATE_REPORTS, Action.GROUP_MANAGE, Action.GROUP_DELETE].forEach(action)
    const doomed = await gid(owner, { name: 'To delete', privacy: 'PUBLIC', joinPolicy: 'OPEN' })
    await join(admin, doomed)
    await role(doomed, admin, 'ADMIN')
    await expectCases([
      ['post, not a member', 'refused', () => run(outsider, 'createGroupPost', { groupId: group, body: doc('Hi') })],
      ['post, a member', 'allowed', () => run(member, 'createGroupPost', { groupId: group, body: doc('Hi') })],
      ['remove another’s post, a member', 'refused', async () => run(member, 'deleteGroupPost', { postId: await postIn(owner, group) })],
      ['pin a post, a member', 'refused', async () => run(member, 'pinGroupPost', { postId: await postIn(owner, group), pinned: true })],
      ['remove another’s post, a moderator', 'allowed', async () => run(moderator, 'deleteGroupPost', { postId: await postIn(member, group) })],
      ['pin a post, a moderator', 'allowed', async () => run(moderator, 'pinGroupPost', { postId: await postIn(member, group), pinned: true })],
      ['read the group’s reports, a member', 'refused', () => query(member, 'query ($scope: ModerationScopeInput) { moderationQueue(scope: $scope) { edges { cursor } } }', { scope: { scope: 'GROUP', id: group } })],
      ['read the group’s reports, a moderator', 'allowed', () => query(moderator, 'query ($scope: ModerationScopeInput) { moderationQueue(scope: $scope) { edges { cursor } } }', { scope: { scope: 'GROUP', id: group } })],
      ['change settings, a moderator', 'refused', () => run(moderator, 'updateGroup', { groupId: group, description: 'Mine now' })],
      ['change settings, an admin', 'allowed', () => run(admin, 'updateGroup', { groupId: group, description: 'Weekly problems' })],
      ['give a role, a moderator', 'refused', () => run(moderator, 'setGroupRole', { groupId: group, userId: member.id, role: 'MODERATOR' })],
      ['delete, an admin', 'refused', () => run(admin, 'deleteGroup', { groupId: doomed })],
      ['delete, the owner', 'allowed', () => run(owner, 'deleteGroup', { groupId: doomed })],
    ])
  })

  it('project workspaces: mentors, doubts (ADR-0015, ADR-0048)', async () => {
    ;[Action.GROUP_INVITE_MENTOR, Action.GROUP_ACCEPT_MENTOR_INVITE, Action.GROUP_ASK_DOUBT, Action.GROUP_ANSWER_DOUBT, Action.GROUP_RESOLVE_DOUBT].forEach(action)
    const mentorInvite = async () => (await t.gql<{ myMentorInvites: { id: string; group: { id: string } }[] }>('{ myMentorInvites { id group { id } } }', {}, teacher.token)).data!.myMentorInvites.find((i) => i.group.id === workspace)!.id
    const ask = async (who: Person) => (await t.gql<{ askDoubt: { doubt: { id: string } } }>('mutation ($input: AskDoubtInput!) { askDoubt(input: $input) { doubt { id } } }', { input: { groupId: workspace, title: 'Why?', body: doc('Why a heap?') } }, who.token)).data!.askDoubt.doubt.id
    await expectCases([
      ['invite a mentor, a member', 'refused', () => run(member, 'inviteMentor', { groupId: workspace, person: teacher.handle })],
      ['invite a student as mentor, the owner', 'refused', () => run(owner, 'inviteMentor', { groupId: workspace, person: student.handle })],
      ['invite a mentor to a community group, the owner', 'refused', () => run(owner, 'inviteMentor', { groupId: group, person: teacher.handle })],
      ['invite a teacher as mentor, the owner', 'allowed', () => run(owner, 'inviteMentor', { groupId: workspace, person: teacher.handle })],
      ['accept someone else’s mentor invite', 'refused', async () => run(teacher2, 'answerMentorInvite', { inviteId: await mentorInvite(), accept: true })],
      ['accept one’s own mentor invite', 'allowed', async () => run(teacher, 'answerMentorInvite', { inviteId: await mentorInvite(), accept: true })],
      ['ask a doubt in a community group', 'refused', () => run(member, 'askDoubt', { groupId: group, title: 'Why?', body: doc('?') })],
      ['ask a doubt, not on the team', 'refused', () => run(outsider, 'askDoubt', { groupId: workspace, title: 'Why?', body: doc('?') })],
      ['ask a doubt, on the team', 'allowed', () => run(member, 'askDoubt', { groupId: workspace, title: 'Why?', body: doc('?') })],
      ['answer a doubt, not on the team', 'refused', async () => run(outsider, 'answerDoubt', { doubtId: await ask(owner), body: doc('Because') })],
      ['answer a doubt, the mentor', 'allowed', async () => run(teacher, 'answerDoubt', { doubtId: await ask(owner), body: doc('Because') })],
      ['resolve someone else’s doubt, a member', 'refused', async () => run(member, 'resolveDoubt', { doubtId: await ask(owner) })],
      ['resolve one’s own doubt', 'allowed', async () => run(member, 'resolveDoubt', { doubtId: await ask(member) })],
      ['resolve a doubt, the mentor', 'allowed', async () => run(teacher, 'resolveDoubt', { doubtId: await ask(member) })],
    ])
  })

  it('classrooms: create, join, invites, requests, announcements and reports (ADR-0009, ADR-0046, ADR-0051)', async () => {
    ;[Action.CLASSROOM_CREATE, Action.CLASSROOM_REQUEST_JOIN, Action.CLASSROOM_ACCEPT_INVITE, Action.CLASSROOM_REVIEW_JOIN_REQUESTS, Action.CLASSROOM_POST, Action.CLASSROOM_MODERATE_REPORTS].forEach(action)
    const queue = 'query ($scope: ModerationScopeInput) { moderationQueue(scope: $scope) { edges { cursor } } }'
    const newcomer = await person({ name: 'Newcomer' })
    // A teacher applicant (ADR-0073), not yet verified: prepares a class of their own but admits no one.
    const applicant = await person({ verified: false, name: 'Applicant' })
    await t.gql('mutation ($input: ApplyToTeachInput!) { applyToTeach(input: $input) { request { id } } }', { input: { institution: 'Govt. College' } }, applicant.token)
    const applicantClass = (await t.gql<{ createClassroom: { classroom: { id: string } } }>('mutation ($input: CreateClassroomInput!) { createClassroom(input: $input) { classroom { id } } }', { input: { name: 'Prepared' } }, applicant.token)).data!.createClassroom.classroom.id
    await expectCases([
      ['create a class, a student', 'refused', () => run(student, 'createClassroom', { name: 'Mine' })],
      ['create a class, a teacher', 'allowed', () => run(teacher2, 'createClassroom', { name: 'Theirs' })],
      ['create a class, a teacher applicant', 'allowed', () => run(applicant, 'createClassroom', { name: 'Another' })],
      ['invite someone to their class, a teacher applicant', 'refused', () => run(applicant, 'inviteToClassroom', { classroomId: applicantClass, person: newcomer.handle })],
      ['post an announcement in their class, a teacher applicant', 'allowed', () => run(applicant, 'createClassroomPost', { classroomId: applicantClass, body: doc('Coming soon') })],
      ['ask to join, already in it', 'refused', () => run(student, 'requestToJoinClassroom', { code: klass.joinCode })],
      ['ask to join, unverified', 'allowed', () => run(unverified, 'requestToJoinClassroom', { code: klass.joinCode })],
      ['ask to join with the code', 'allowed', () => run(outsider, 'requestToJoinClassroom', { code: klass.joinCode })],
      ['accept someone else’s invite', 'refused', async () => run(outsider, 'answerClassroomInvite', { inviteId: await invite(klass.id, newcomer), accept: true })],
      ['accept one’s own invite', 'allowed', async () => run(newcomer, 'answerClassroomInvite', { inviteId: (await db.classroomInvite.findFirstOrThrow({ where: { classroomId: klass.id, invitedUserId: newcomer.id } })).id, accept: true })],
      ['invite someone, a student', 'refused', () => run(student, 'inviteToClassroom', { classroomId: klass.id, person: member.handle })],
      ['answer a request, a student', 'refused', async () => run(student, 'reviewClassroomJoinRequest', { requestId: await classRequest(), decision: 'APPROVED' })],
      ['answer a request, the TA', 'allowed', async () => run(ta, 'reviewClassroomJoinRequest', { requestId: await classRequest(), decision: 'APPROVED' })],
      ['post an announcement, a student', 'refused', () => run(student, 'createClassroomPost', { classroomId: klass.id, body: doc('Hi') })],
      ['post an announcement, the TA', 'allowed', () => run(ta, 'createClassroomPost', { classroomId: klass.id, body: doc('Quiz on Monday') })],
      ['read the class’s reports, a student', 'refused', () => query(student, queue, { scope: { scope: 'CLASSROOM', id: klass.id } })],
      ['read the class’s reports, another teacher', 'refused', () => query(teacher2, queue, { scope: { scope: 'CLASSROOM', id: klass.id } })],
      ['read the class’s reports, the TA', 'allowed', () => query(ta, queue, { scope: { scope: 'CLASSROOM', id: klass.id } })],
    ])
  })

  it('classroom quizzes: only the class’s staff publish them (ADR-0064)', async () => {
    action(Action.CLASSROOM_PUBLISH_QUIZ)
    const quiz = { classroomId: klass.id, title: 'Cells', questions: [{ question: doc('What makes ATP?'), choices: [{ id: 'c1', content: [{ type: 'text', text: 'Mitochondria' }] }, { id: 'c2', content: [{ type: 'text', text: 'Ribosomes' }] }], correct: ['c1'], multiple: false }] }
    await expectCases([
      ['publish a quiz, signed out', 'refused', () => run(null, 'publishClassQuiz', quiz)],
      ['publish a quiz, someone outside the class', 'refused', () => run(outsider, 'publishClassQuiz', quiz)],
      ['publish a quiz, another teacher', 'refused', () => run(teacher2, 'publishClassQuiz', quiz)],
      ['publish a quiz, a student', 'refused', () => run(student, 'publishClassQuiz', quiz)],
      ['publish a quiz, the TA', 'allowed', () => run(ta, 'publishClassQuiz', quiz)],
      ['publish a quiz, the teacher', 'allowed', () => run(teacher, 'publishClassQuiz', quiz)],
    ])
  })

  it('people: follow, remove a follower, block and restrict (ADR-0016, ADR-0020, ADR-0043)', async () => {
    ;[Action.USER_FOLLOW, Action.USER_UNFOLLOW, Action.USER_REMOVE_FOLLOWER, Action.USER_BLOCK, Action.USER_UNBLOCK, Action.USER_RESTRICT, Action.USER_UNRESTRICT, Action.USER_VIEW_FOLLOWERS].forEach(action)
    const fan = await person({ name: 'Fan' })
    const target = await person({ name: 'Target' })
    await expectCases([
      ['follow, unverified', 'allowed', () => run(unverified, 'followUser', { userId: teacher.id })],
      ['follow a restricted minor', 'refused', () => run(fan, 'followUser', { userId: minor.id })],
      ['follow oneself', 'refused', () => run(fan, 'followUser', { userId: fan.id })],
      ['follow a teacher', 'allowed', () => run(fan, 'followUser', { userId: teacher.id })],
      ['unfollow, signed out', 'refused', () => run(null, 'unfollowUser', { userId: teacher.id })],
      ['unfollow', 'allowed', () => run(fan, 'unfollowUser', { userId: teacher.id })],
      ['remove a follower, signed out', 'refused', () => run(null, 'removeFollower', { userId: fan.id })],
      ['remove a follower', 'allowed', async () => (await run(fan, 'followUser', { userId: target.id }), run(target, 'removeFollower', { userId: fan.id }))],
      ['block oneself', 'refused', () => run(fan, 'blockUser', { userId: fan.id })],
      ['block', 'allowed', () => run(fan, 'blockUser', { userId: target.id })],
      ['unblock, signed out', 'refused', () => run(null, 'unblockUser', { userId: target.id })],
      ['unblock', 'allowed', () => run(fan, 'unblockUser', { userId: target.id })],
      ['restrict oneself', 'refused', () => run(fan, 'restrictUser', { userId: fan.id })],
      ['restrict', 'allowed', () => run(fan, 'restrictUser', { userId: target.id })],
      ['unrestrict, signed out', 'refused', () => run(null, 'unrestrictUser', { userId: target.id })],
      ['unrestrict', 'allowed', () => run(fan, 'unrestrictUser', { userId: target.id })],
      ['list one’s own followers', 'allowed', () => query(target, '{ myFollowers { edges { node { id } } } }')],
      ['list followers, signed out', 'refused', () => query(null, '{ myFollowers { edges { node { id } } } }')],
    ])
    // Nobody lists another person's followers: the schema has no such field (the count is a milestone, ADR-0027).
    const user = await t.gql<{ __type: { fields: { name: string }[] } }>('{ __type(name: "User") { fields { name } } }')
    expect(user.data!.__type.fields.map((f) => f.name).filter((n) => /^followers?$|followerList/i.test(n))).toEqual([])
  })

  it('teachers: connections and the Skills tab (ADR-0012, ADR-0013, ADR-0044)', async () => {
    ;[Action.USER_REQUEST_CONNECTION, Action.USER_RESPOND_TO_CONNECTION, Action.USER_REMOVE_CONNECTION, Action.TEACHER_EDIT_PROFILE].forEach(action)
    const t3 = await person({ teacher: true, name: 'Teacher Three' })
    const requestId = async () => (await t.gql<{ myConnectionRequests: { id: string; person: { id: string } }[] }>('{ myConnectionRequests { id person { id } } }', {}, t3.token)).data!.myConnectionRequests.find((r) => r.person.id === teacher.id)!.id
    await expectCases([
      ['ask a teacher to connect, a student', 'refused', () => run(student, 'requestConnection', { userId: teacher.id })],
      ['ask a student to connect, a teacher', 'refused', () => run(teacher, 'requestConnection', { userId: student.id })],
      ['ask a teacher to connect, a teacher', 'allowed', () => run(teacher, 'requestConnection', { userId: t3.id })],
      ['answer a request addressed to someone else', 'refused', async () => run(teacher2, 'respondToConnectionRequest', { requestId: await requestId(), accept: true })],
      ['answer one’s own request', 'allowed', async () => run(t3, 'respondToConnectionRequest', { requestId: await requestId(), accept: true })],
      ['remove a connection, signed out', 'refused', () => run(null, 'removeConnection', { userId: t3.id })],
      ['remove a connection', 'allowed', () => run(teacher, 'removeConnection', { userId: t3.id })],
      ['edit the Skills tab, a student', 'refused', () => run(student, 'updateTeacherProfile', { headline: 'Me', skills: [] })],
      ['edit the Skills tab, a teacher', 'allowed', () => run(teacher, 'updateTeacherProfile', { headline: 'Heaps and graphs', skills: [] })],
    ])
  })

  it('reports and moderation: report anything one sees, moderate in one’s own scope (ADR-0037, ADR-0051)', async () => {
    ;[Action.CONTENT_REPORT, Action.CONTENT_MODERATE, Action.NOTE_COMMENT].forEach(action)
    const noteId = (await t.gql<{ createNote: { note: { id: string } } }>('mutation ($input: CreateNoteInput!) { createNote(input: $input) { note { id } } }', { input: { title: 'Heaps', cards: [{ id: newId(), type: 'text', position: 'a0', content: { doc: doc('A heap.') } }] } }, owner.token)).data!.createNote.note.id
    await t.gql('mutation ($input: NoteIdInput!) { publishNote(input: $input) { note { id } } }', { input: { noteId } }, owner.token)
    await t.gql('mutation ($input: ChangeNoteVisibilityInput!) { changeNoteVisibility(input: $input) { note { id } } }', { input: { noteId, visibility: 'PUBLIC' } }, owner.token)
    await bus.drain()
    const target = { type: 'NOTE', id: noteId }
    const postId = await postIn(member, group)
    await expectCases([
      ['comment on a public note, unverified', 'allowed', () => run(unverified, 'addComment', { target, body: doc('Hi') })],
      ['comment on a public note, a restricted minor', 'refused', () => run(minor, 'addComment', { target, body: doc('Hi') })],
      ['comment on a public note, verified', 'allowed', () => run(outsider, 'addComment', { target, body: doc('Hi') })],
      ['report, signed out', 'refused', () => run(null, 'reportContent', { entityType: 'USER', entityId: teacher.id, reason: 'SPAM' })],
      ['report a post in a group one is not in', 'refused', () => run(outsider, 'reportContent', { entityType: 'GROUP_POST', entityId: postId, reason: 'SPAM' })],
      ['report a person', 'allowed', () => run(outsider, 'reportContent', { entityType: 'USER', entityId: teacher.id, reason: 'SPAM' })],
      ['report a post in one’s group', 'allowed', () => run(admin, 'reportContent', { entityType: 'GROUP_POST', entityId: postId, reason: 'SPAM' })],
      ['read the platform queue, a teacher', 'refused', () => query(teacher, '{ moderationQueue { edges { cursor } } }')],
      ['read the platform queue, a group moderator', 'refused', () => query(moderator, '{ moderationQueue(scope: { scope: PLATFORM }) { edges { cursor } } }')],
      ['read every queue, a platform admin', 'allowed', () => query(platformAdmin, '{ moderationQueue { edges { cursor } } }')],
      ['decide on a group post, someone outside the group', 'refused', () => run(teacher, 'moderateContent', { entityType: 'GROUP_POST', entityId: postId, action: 'DISMISS' })],
      ['decide on a group post, the group’s moderator', 'allowed', () => run(moderator, 'moderateContent', { entityType: 'GROUP_POST', entityId: postId, action: 'DISMISS' })],
      ['decide on a person, a group moderator', 'refused', () => run(moderator, 'moderateContent', { entityType: 'USER', entityId: teacher.id, action: 'DISMISS' })],
      ['decide on a person, a platform admin', 'allowed', () => run(platformAdmin, 'moderateContent', { entityType: 'USER', entityId: teacher.id, action: 'DISMISS' })],
    ])
  })

  it('a suspension (ADR-0053): only platform admins suspend; the suspended moderator, owner or teacher acts for nobody', async () => {
    const suspended = await person({ name: 'Suspended moderator' })
    await run(suspended, 'joinGroup', { groupId: openGroup })
    await t.gql('mutation ($input: SetGroupRoleInput!) { setGroupRole(input: $input) { group { id } } }', { input: { groupId: openGroup, userId: suspended.id, role: 'MODERATOR' } }, owner.token)
    const theirPost = await postIn(owner, openGroup)
    await expectCases([
      ['suspend, a group moderator', 'refused', () => run(moderator, 'moderateContent', { entityType: 'USER', entityId: suspended.id, action: 'SUSPEND', reason: 'Spam', suspendDays: 7 })],
      ['suspend, a teacher', 'refused', () => run(teacher, 'moderateContent', { entityType: 'USER', entityId: suspended.id, action: 'SUSPEND', reason: 'Spam', suspendDays: 7 })],
      ['suspend, a platform admin', 'allowed', () => run(platformAdmin, 'moderateContent', { entityType: 'USER', entityId: suspended.id, action: 'SUSPEND', reason: 'Spam', suspendDays: 7 })],
      ['post while suspended', 'refused', () => run(suspended, 'createGroupPost', { groupId: openGroup, body: doc('Hi') })],
      ['moderate one’s group while suspended', 'refused', () => run(suspended, 'deleteGroupPost', { postId: theirPost })],
      ['follow while suspended', 'refused', () => run(suspended, 'followUser', { userId: teacher.id })],
      ['create a group while suspended', 'refused', () => run(suspended, 'createGroup', { name: 'Again', privacy: 'PUBLIC', joinPolicy: 'OPEN' })],
      ['report while suspended', 'allowed', () => run(suspended, 'reportContent', { entityType: 'GROUP_POST', entityId: theirPost, reason: 'SPAM' })],
      ['block while suspended', 'allowed', () => run(suspended, 'blockUser', { userId: outsider.id })],
      ['lift it, a group moderator', 'refused', () => run(moderator, 'moderateContent', { entityType: 'USER', entityId: suspended.id, action: 'APPROVE' })],
      ['lift it, a platform admin', 'allowed', () => run(platformAdmin, 'moderateContent', { entityType: 'USER', entityId: suspended.id, action: 'APPROVE' })],
      ['post once it is lifted', 'allowed', () => run(suspended, 'createGroupPost', { groupId: openGroup, body: doc('Back') })],
    ])
  })

  it('resources (ADR-0074): verified adults submit; a waiting one is its submitter’s and the moderators’ alone; moderators decide', async () => {
    ;[Action.RESOURCE_SUBMIT, Action.RESOURCE_READ, Action.RESOURCE_EDIT, Action.RESOURCE_DELETE, Action.RESOURCE_RECOMMEND].forEach(action)
    const topicId = (await db.topic.findFirstOrThrow({ where: { origin: 'CURATED', children: { none: {} } }, select: { id: true } })).id
    const fields = () => ({ type: 'COURSE', title: 'Operating Systems, NPTEL', url: `https://nptel.ac.in/courses/${newId()}`, topicIds: [topicId] })
    const made = async (who: Person) => (await t.gql<{ submitResource: { resource: { id: string } } }>('mutation ($input: SubmitResourceInput!) { submitResource(input: $input) { resource { id } } }', { input: fields() }, who.token)).data!.submitResource.resource.id
    /** Reading is refused when the resource comes back null: hidden things are "not found" (§5). */
    const read = async (who: Person | null, id: string) => {
      const res = await t.gql<{ resource: { id: string } | null }>('query ($id: UUID!) { resource(id: $id) { id } }', { id }, who?.token)
      return res.data?.resource ? { outcome: 'allowed' as const, why: '' } : { outcome: 'refused' as const, why: 'null' }
    }
    const waiting = await made(member)
    const doomed = await made(member)
    await expectCases([
      ['submit, signed out', 'refused', () => run(null, 'submitResource', fields())],
      ['submit, unverified', 'refused', () => run(unverified, 'submitResource', fields())],
      ['submit, a restricted minor', 'refused', () => run(minor, 'submitResource', fields())],
      ['submit, a verified student', 'allowed', () => run(outsider, 'submitResource', fields())],
      ['read a waiting one, a guest', 'refused', () => read(null, waiting)],
      ['read a waiting one, someone else', 'refused', () => read(outsider, waiting)],
      ['read a waiting one, a teacher', 'refused', () => read(teacher, waiting)],
      ['read a waiting one, its submitter', 'allowed', () => read(member, waiting)],
      ['read a waiting one, a platform admin', 'allowed', () => read(platformAdmin, waiting)],
      ['edit a waiting one, someone else', 'refused', () => run(outsider, 'updateResource', { id: waiting, ...fields() })],
      ['edit a waiting one, its submitter', 'allowed', () => run(member, 'updateResource', { id: waiting, ...fields() })],
      ['approve, a teacher', 'refused', () => run(teacher, 'moderateContent', { entityType: 'RESOURCE', entityId: waiting, action: 'APPROVE' })],
      ['approve, a group moderator', 'refused', () => run(moderator, 'moderateContent', { entityType: 'RESOURCE', entityId: waiting, action: 'APPROVE' })],
      ['approve, a platform admin', 'allowed', () => run(platformAdmin, 'moderateContent', { entityType: 'RESOURCE', entityId: waiting, action: 'APPROVE' })],
      ['read an approved one, a guest', 'allowed', () => read(null, waiting)],
      ['edit an approved one, its submitter', 'refused', () => run(member, 'updateResource', { id: waiting, ...fields() })],
      ['delete, someone else', 'refused', () => run(outsider, 'deleteResource', { id: waiting })],
      ['recommend to a group one is not in', 'refused', () => run(outsider, 'recommendResource', { resourceId: waiting, to: { groupId: group } })],
      ['recommend to one’s group', 'allowed', () => run(member, 'recommendResource', { resourceId: waiting, to: { groupId: group } })],
      ['recommend to a class, a student in it', 'refused', () => run(student, 'recommendResource', { resourceId: waiting, to: { classroomId: klass.id } })],
      ['recommend to a class, its teacher', 'allowed', () => run(teacher, 'recommendResource', { resourceId: waiting, to: { classroomId: klass.id } })],
      ['recommend, unverified', 'refused', () => run(unverified, 'recommendResource', { resourceId: waiting, to: { groupId: group } })],
      ['delete, its submitter', 'allowed', () => run(member, 'deleteResource', { id: waiting })],
      ['delete someone’s, a platform admin', 'allowed', () => run(platformAdmin, 'deleteResource', { id: doomed })],
    ])
  })

  /** Actions whose channel arrives in a later phase; each stays here until it has cases above. */
  const NOT_YET: Record<string, string> = {
    [Action.CLASSROOM_VIEW_PERFORMANCE]: 'Phase 6: progress, from quiz attempts and learning events (plans/phase-4.md)',
  }

  it('every community action has cases above or a phase that brings it', () => {
    const community = Object.values(Action).filter((a) => /^(group|classroom|user|teacher|content|resource)\./.test(a))
    expect(community.filter((a) => !covered.has(a) && !NOT_YET[a])).toEqual([])
  })
})
