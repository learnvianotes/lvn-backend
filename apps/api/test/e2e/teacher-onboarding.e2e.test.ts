import { PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { SAMPLES, upload } from '../support/flows'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Becoming a teacher (ADR-0073), "try now, verify later": anyone who is not a child account applies with where and
 * what they teach and some proof; while waiting they make a class, post and prepare, but admit no one; a platform
 * admin approves (the TEACHER role, and a verified account) or declines with a reason; a declined applicant may apply
 * again.
 */
describe('Teacher onboarding', () => {
  let t: TestApp
  let db: PrismaService
  type Person = { id: string; token: string; handle: string }
  let admin: Person
  const person = async (opts: { verified?: boolean; dob?: string } = {}): Promise<Person> => {
    const handle = `to${Date.now()}${Math.floor(Math.random() * 1e6)}`
    const u = await seedUser(t.app, { verified: opts.verified ?? false, handle, displayName: 'Asha Rao' })
    if (opts.dob) await db.user.update({ where: { id: u.id }, data: { dateOfBirth: new Date(opts.dob) } })
    return { id: u.id, token: tokenFor(t.config, u.id), handle }
  }
  type Payload = { request: { id: string; purpose: string; status: string; institution: string | null; subjects: string | null } | null; userErrors: { message: string; code: string }[] }
  /** The payload, with a refusal (a top-level error, as for every authorization error) folded into its userErrors. */
  const apply = async (who: Person, input: object): Promise<Payload> => {
    const res = await t.gql<{ applyToTeach: Payload }>('mutation ($input: ApplyToTeachInput!) { applyToTeach(input: $input) { request { id purpose status institution subjects } userErrors { message code } } }', { input }, who.token)
    return res.data?.applyToTeach ?? { request: null, userErrors: (res.errors ?? []).map((e) => ({ message: e.message, code: e.extensions.code as string })) }
  }
  const status = async (who: Person) => (await t.gql<{ viewer: { teacherStatus: string; globalRole: string; verified: boolean } }>('{ viewer { teacherStatus globalRole verified } }', {}, who.token)).data!.viewer
  const review = async (requestId: string, approve: boolean, reason?: string) =>
    (await t.gql<{ reviewVerificationRequest: Payload }>('mutation ($input: ReviewVerificationRequestInput!) { reviewVerificationRequest(input: $input) { request { id status purpose institution subjects } userErrors { message code } } }', { input: { requestId, approve, reason } }, admin.token)).data!.reviewVerificationRequest
  type Res = { data?: Record<string, { classroom?: { id: string } | null; userErrors: { message: string; code: string }[] } | null>; errors?: { message: string; extensions: { code: string } }[] }
  const classMutation = async (name: string, input: object, who: Person) => {
    const res = (await t.gql(`mutation ($input: ${name[0]!.toUpperCase()}${name.slice(1)}Input!) { ${name}(input: $input) { classroom { id } userErrors { message code } } }`, { input }, who.token)) as Res
    const payload = res.data?.[name]
    return { id: payload?.classroom?.id ?? null, message: res.errors?.[0]?.message ?? payload?.userErrors[0]?.message, code: res.errors?.[0]?.extensions.code ?? payload?.userErrors[0]?.code }
  }
  const doc = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    const a = await seedUser(t.app, { globalRole: 'PLATFORM_ADMIN', verified: true })
    admin = { id: a.id, token: tokenFor(t.config, a.id, undefined, ['PLATFORM_ADMIN']), handle: '' }
  })

  afterAll(async () => {
    await t?.close()
  })

  it('applies with proof, prepares a class while waiting but admits no one, and becomes a teacher on approval', async () => {
    const me = await person()
    expect((await status(me)).teacherStatus).toBe('NONE')
    // Before applying, a student makes no class.
    expect((await classMutation('createClassroom', { name: 'Physics 9A' }, me)).code).toBe('FORBIDDEN')
    expect((await apply(me, { institution: ' ' })).userErrors[0]!.message).toBe('Say where you teach.')
    const proof = await upload(t, me.token, 'VERIFICATION_DOCUMENT', 'application/pdf', SAMPLES.pdf, 'appointment.pdf')
    const applied = await apply(me, { institution: 'Govt. Junior College, Guntur', subjects: 'Physics', message: 'I teach 11th and 12th', fileIds: [proof] })
    expect(applied.request).toMatchObject({ purpose: 'TEACHER_ROLE', status: 'PENDING', institution: 'Govt. Junior College, Guntur', subjects: 'Physics' })
    expect((await apply(me, { institution: 'Again' })).userErrors[0]!.code).toBe('CONFLICT')
    expect(await status(me)).toEqual({ teacherStatus: 'PENDING', globalRole: 'STUDENT', verified: false })

    // A teacher applicant, not yet verified: makes a class and posts, but brings no one in.
    const classroomId = (await classMutation('createClassroom', { name: 'Physics 11A' }, me)).id!
    expect(classroomId).toBeTruthy()
    const posted = await t.gql<{ createClassroomPost: { classroom: { id: string } | null; userErrors: { message: string }[] } }>('mutation ($input: CreateClassroomPostInput!) { createClassroomPost(input: $input) { classroom { id } userErrors { message } } }', { input: { classroomId, body: doc('Welcome to Physics!') } }, me.token)
    expect(posted.data!.createClassroomPost.userErrors).toEqual([])
    const student = await person({ verified: true })
    const invited = await classMutation('inviteToClassroom', { classroomId, person: student.handle }, me)
    expect(invited).toMatchObject({ code: 'FORBIDDEN', message: 'Students can join once you are verified as a teacher.' })
    const seen = (await t.gql<{ classroom: { viewerCan: { review: boolean; post: boolean } } }>('query ($id: UUID!) { classroom(id: $id) { viewerCan { review post } } }', { id: classroomId }, me.token)).data!.classroom
    expect(seen.viewerCan).toEqual({ review: false, post: true })

    // The admin sees the application with its proof, and approves it.
    const queue = (await t.gql<{ verificationRequestsToReview: { id: string; purpose: string; institution: string | null; documents: { fileName: string }[] }[] }>('{ verificationRequestsToReview { id purpose institution documents { fileName } } }', {}, admin.token)).data!.verificationRequestsToReview
    expect(queue.find((r) => r.id === applied.request!.id)).toMatchObject({ purpose: 'TEACHER_ROLE', institution: 'Govt. Junior College, Guntur', documents: [{ fileName: 'appointment.pdf' }] })
    expect((await review(applied.request!.id, true)).request).toMatchObject({ status: 'APPROVED' })
    expect(await status(me)).toEqual({ teacherStatus: 'VERIFIED', globalRole: 'TEACHER', verified: true })
    expect(await db.auditLog.count({ where: { action: 'teacher.approved', targetId: applied.request!.id } })).toBe(1)

    // Now the class takes students.
    expect((await classMutation('inviteToClassroom', { classroomId, person: student.handle }, me)).code).toBeUndefined()
    const told = await db.notification.findMany({ where: { userId: me.id, category: 'VERIFICATION' } })
    expect(told.some((n) => (n.data as { purpose?: string }).purpose === 'TEACHER_ROLE')).toBe(true)
  })

  it('declines with a reason; the applicant stops making classes and may apply again', async () => {
    const me = await person({ verified: true })
    const applied = await apply(me, { institution: 'Somewhere' })
    expect((await review(applied.request!.id, false)).userErrors[0]!.message).toBe('Tell them why, so they can apply again.')
    expect((await review(applied.request!.id, false, 'We could not find you on the college’s staff page.')).request).toMatchObject({ status: 'REJECTED' })
    expect(await status(me)).toMatchObject({ teacherStatus: 'DECLINED', globalRole: 'STUDENT' })
    expect((await classMutation('createClassroom', { name: 'Chemistry' }, me)).code).toBe('FORBIDDEN')
    expect((await apply(me, { institution: 'Somewhere, with proof this time' })).request).toMatchObject({ status: 'PENDING' })
  })

  it('refuses child accounts and teachers; an account verification can wait beside an application', async () => {
    const child = await person({ dob: new Date(Date.now() - 12 * 365 * 86_400_000).toISOString().slice(0, 10) })
    expect((await apply(child, { institution: 'School' })).userErrors[0]).toMatchObject({ code: 'FORBIDDEN', message: 'Teacher accounts are for adults.' })
    const teacher = await seedUser(t.app, { globalRole: 'TEACHER', verified: true })
    expect((await apply({ id: teacher.id, token: tokenFor(t.config, teacher.id), handle: '' }, { institution: 'School' })).userErrors[0]!.code).toBe('CONFLICT')

    const me = await person()
    const file = await upload(t, me.token, 'VERIFICATION_DOCUMENT', 'image/png', SAMPLES.png, 'student-id.png')
    const account = await t.gql<{ requestDocumentVerification: Payload }>('mutation ($input: RequestDocumentVerificationInput!) { requestDocumentVerification(input: $input) { request { id purpose status institution subjects } userErrors { message code } } }', { input: { fileIds: [file] } }, me.token)
    expect(account.data!.requestDocumentVerification.request).toMatchObject({ purpose: 'ACCOUNT', status: 'PENDING' })
    expect((await apply(me, { institution: 'Govt. College' })).request).toMatchObject({ purpose: 'TEACHER_ROLE', status: 'PENDING' })
    expect((await t.gql('{ viewer { teacherStatus } }')).data).toEqual({ viewer: null })
  })
})
