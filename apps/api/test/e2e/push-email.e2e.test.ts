import { createVerify, generateKeyPairSync } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { COMMS_PUSH_QUEUE, EmailNotificationsService, MailService, NotificationService, PushService, unsubscribeToken } from '@lvn-backend/communication'
import { InProcessEventBus } from '@lvn-backend/event-bus'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Push and email (ADR-0021, ADR-0050) against a stand-in FCM: a signed service-account token exchanged for an access
 * token, ids-only messages, preferences and quiet hours, pruning of gone tokens; class announcement emails and the
 * weekly digest with one-click unsubscribe.
 */
describe('push and email', () => {
  let t: TestApp
  let db: PrismaService
  let bus: InProcessEventBus
  let fcm: Server
  const sends: { token: string; message: { notification: { title: string; body: string }; data: Record<string, string> } }[] = []
  const assertions: string[] = []
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
  type Person = { id: string; handle: string; email: string; token: string }
  const person = async (opts: { teacher?: boolean; minor?: boolean; name?: string } = {}): Promise<Person> => {
    const u = await seedUser(t.app, { verified: true, globalRole: opts.teacher ? 'TEACHER' : 'STUDENT', displayName: opts.name ?? 'Someone' })
    if (opts.minor) await db.user.update({ where: { id: u.id }, data: { dateOfBirth: new Date('2015-03-01') } })
    return { id: u.id, handle: u.handle, email: u.email, token: tokenFor(t.config, u.id) }
  }
  const gql = async <T>(query: string, variables: object, who?: Person) => t.gql<T>(query, variables as Record<string, unknown>, who?.token)
  const register = (who: Person, token: string) => gql<{ registerDevice: { ok: boolean; userErrors: { message: string }[] } }>('mutation ($input: RegisterDeviceInput!) { registerDevice(input: $input) { ok userErrors { message } } }', { input: { token, platform: 'ANDROID' } }, who)
  const deviceToken = (name: string) => `${name}-${newId()}-fcm-token-padding`
  const notify = (userId: string, actorId: string | null, category = 'FOLLOW') => t.app.get(NotificationService).notify({ userId, category: category as never, path: '/u/x', actorId })

  beforeAll(async () => {
    fcm = createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        res.setHeader('content-type', 'application/json')
        if (req.url === '/token') {
          assertions.push(new URLSearchParams(raw).get('assertion') ?? '')
          return res.end(JSON.stringify({ access_token: 'stand-in-access', expires_in: 3600 }))
        }
        if (req.url === '/v1/projects/lvn-test/messages:send' && req.headers.authorization === 'Bearer stand-in-access') {
          const { message } = JSON.parse(raw) as { message: { token: string; notification: { title: string; body: string }; data: Record<string, string> } }
          if (message.token.startsWith('gone-')) {
            res.statusCode = 404
            return res.end(JSON.stringify({ error: { status: 'NOT_FOUND', message: 'Requested entity was not found.', details: [{ errorCode: 'UNREGISTERED' }] } }))
          }
          sends.push({ token: message.token, message })
          return res.end(JSON.stringify({ name: 'projects/lvn-test/messages/1' }))
        }
        res.statusCode = 401
        res.end('{}')
      })
    })
    await new Promise<void>((resolve) => fcm.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${(fcm.address() as AddressInfo).port}`
    const account = { client_email: 'push@lvn-test.iam.gserviceaccount.com', private_key: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'lvn-test' }
    t = await createTestApp({ FCM_API_URL: base, GOOGLE_OAUTH_TOKEN_URL: `${base}/token`, FCM_SERVICE_ACCOUNT_JSON: JSON.stringify(account) })
    db = t.app.get(PrismaService)
    bus = t.app.get(InProcessEventBus)
  })
  afterAll(async () => {
    await t.close()
    await new Promise((resolve) => fcm.close(resolve))
  })
  beforeEach(() => void (sends.length = 0))

  it('a notification is queued for push and sent to the person’s phones with ids and short text', async () => {
    const asha = await person({ name: 'Asha' })
    const priya = await person({ name: 'Priya' })
    expect((await register(asha, 'short')).data!.registerDevice.userErrors[0]!.message).toBe('That is not a push token.')
    const token = deviceToken('asha')
    expect((await register(asha, token)).data!.registerDevice.ok).toBe(true)
    // Quiet hours off for this test: start and end equal.
    await gql('mutation ($input: UpdateNotificationSettingsInput!) { updateNotificationSettings(input: $input) { userErrors { message } } }', { input: { quietStart: '00:00', quietEnd: '00:00' } }, asha)
    const queued = await t.app.get(Queues).queue(COMMS_PUSH_QUEUE).count()
    const id = (await notify(asha.id, priya.id))!
    expect(await t.app.get(Queues).queue(COMMS_PUSH_QUEUE).count()).toBe(queued + 1)
    expect(await t.app.get(PushService).deliver(id)).toBe(1)
    expect(sends).toEqual([{ token, message: { token, notification: { title: 'LearnViaNotes', body: 'Priya started following you' }, data: { notificationId: id, category: 'FOLLOW', path: '/u/x' }, android: { priority: 'high' } } as never }])
    // The access token came from a JWT the service account signed for FCM's scope.
    const [head, claims, signature] = assertions.at(-1)!.split('.')
    expect(createVerify('RSA-SHA256').update(`${head}.${claims}`).verify(keys.publicKey, signature!, 'base64url')).toBe(true)
    expect(JSON.parse(Buffer.from(claims!, 'base64url').toString())).toMatchObject({ iss: 'push@lvn-test.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/firebase.messaging' })
  })

  it('respects the category switch and quiet hours, and forgets a token FCM says is gone', async () => {
    const ravi = await person({ name: 'Ravi' })
    const priya = await person({ name: 'Priya' })
    await register(ravi, deviceToken('ravi'))
    await register(ravi, `gone-${newId()}-fcm-token-padding`)
    const settings = (input: object) => gql('mutation ($input: UpdateNotificationSettingsInput!) { updateNotificationSettings(input: $input) { settings { quietStart } userErrors { message } } }', { input }, ravi)
    await settings({ quietStart: '00:00', quietEnd: '00:00', timeZone: 'UTC' })
    const push = t.app.get(PushService)
    expect(await push.deliver((await notify(ravi.id, priya.id))!)).toBe(1)
    expect(await db.deviceToken.count({ where: { userId: ravi.id } })).toBe(1)
    // Turned off for follows.
    await settings({ categories: [{ category: 'FOLLOW', push: false }] })
    expect(await push.deliver((await notify(ravi.id, priya.id))!)).toBe(0)
    // Quiet from 22:00 to 07:00 UTC; at 23:30 UTC nothing goes out, at 12:00 it does.
    await settings({ categories: [{ category: 'FOLLOW', push: true }], quietStart: '22:00', quietEnd: '07:00' })
    const id = (await notify(ravi.id, priya.id))!
    expect(await push.deliver(id, new Date('2026-10-12T23:30:00Z'))).toBe(0)
    expect(await push.deliver(id, new Date('2026-10-12T12:00:00Z'))).toBe(1)
    // A notification read in the meantime is not pushed.
    await db.notification.update({ where: { id }, data: { readAt: new Date() } })
    expect(await push.deliver(id, new Date('2026-10-12T12:00:00Z'))).toBe(0)
  })

  it('a restricted minor’s push names nobody', async () => {
    const minor = await person({ minor: true })
    const priya = await person({ name: 'Priya' })
    const built = await t.app.get(PushService).message((await notify(minor.id, priya.id, 'SHARE'))!)
    expect(built!.message.body).toBe('Someone shared a note with you')
  })

  it('settings: defaults, validation, and what each category sends', async () => {
    const asha = await person()
    const read = await gql<{ notificationSettings: { quietStart: string; quietEnd: string; timeZone: string; weeklyDigest: boolean; pushAvailable: boolean; devices: number; categories: { category: string; push: boolean; email: boolean | null }[] } }>('{ notificationSettings { quietStart quietEnd timeZone weeklyDigest pushAvailable devices categories { category push email } } }', {}, asha)
    const s = read.data!.notificationSettings
    expect(s).toMatchObject({ quietStart: '22:00', quietEnd: '07:00', timeZone: 'Asia/Kolkata', weeklyDigest: true, pushAvailable: true, devices: 0 })
    expect(s.categories.find((c) => c.category === 'CLASSROOM_POST')).toEqual({ category: 'CLASSROOM_POST', push: true, email: true })
    expect(s.categories.find((c) => c.category === 'COMMENT')).toEqual({ category: 'COMMENT', push: true, email: null })
    const problem = async (input: object) => (await gql<{ updateNotificationSettings: { userErrors: { message: string }[] } }>('mutation ($input: UpdateNotificationSettingsInput!) { updateNotificationSettings(input: $input) { userErrors { message } } }', { input }, asha)).data!.updateNotificationSettings.userErrors[0]?.message
    expect(await problem({ quietStart: '25:00' })).toBe('Use a time like 22:00.')
    expect(await problem({ timeZone: 'Mars/Olympus' })).toBe('Choose a time zone from the list.')
    expect(await problem({ categories: [{ category: 'REVISION_REMINDER', push: false }] })).toBe('That kind of notification cannot be set yet.')
    expect((await gql('{ notificationSettings { timeZone } }', {})).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
  })

  it('a class announcement is emailed to members who keep it on; one click turns it off', async () => {
    const teacher = await person({ teacher: true, name: 'Ms Rao' })
    const pupil = await person({ name: 'Kiran' })
    const classroomId = (await gql<{ createClassroom: { classroom: { id: string } } }>('mutation { createClassroom(input: { name: "Physics 9A" }) { classroom { id } } }', {}, teacher)).data!.createClassroom.classroom.id
    await gql('mutation ($input: InviteToClassroomInput!) { inviteToClassroom(input: $input) { classroom { id } } }', { input: { classroomId, person: pupil.handle } }, teacher)
    const invite = await db.classroomInvite.findFirstOrThrow({ where: { classroomId, invitedUserId: pupil.id } })
    await gql('mutation ($input: AnswerClassroomInviteInput!) { answerClassroomInvite(input: $input) { classroom { id } } }', { input: { inviteId: invite.id, accept: true } }, pupil)
    const emails = await t.app.get(Queues).queue('comms.email').count()
    await gql('mutation ($input: CreateClassroomPostInput!) { createClassroomPost(input: $input) { classroom { id } } }', { input: { classroomId, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test on Friday' }] }] } } }, teacher)
    await bus.drain()
    expect(await t.app.get(Queues).queue('comms.email').count()).toBe(emails + 1)
    const postId = (await db.classroomPost.findFirstOrThrow({ where: { classroomId } })).id

    const sent = jest.spyOn(t.app.get(MailService), 'send').mockResolvedValue()
    const service = t.app.get(EmailNotificationsService)
    expect(await service.sendClassroomPost(postId, pupil.id)).toBe(true)
    const [to, template, data, options] = sent.mock.calls[0]!
    expect(template).toBe('classroomPost')
    expect(data).toMatchObject({ displayName: 'Kiran', teacherName: 'Ms Rao', classroomName: 'Physics 9A', text: 'Test on Friday', link: expect.stringMatching(new RegExp(`/classes/${classroomId}$`)) })
    expect(to).toMatch(/@example\.com$/)
    // The page in the email asks for a click; mail clients POST to the one-click address with the same token.
    expect(options?.unsubscribeUrl).toBe((data as { unsubscribeLink: string }).unsubscribeLink.replace('/unsubscribe?', '/unsubscribe/one-click?'))

    // One click, no sign-in: the token from the link turns class emails off.
    const token = new URL((data as { unsubscribeLink: string }).unsubscribeLink).searchParams.get('t')!
    const res = await gql<{ unsubscribeEmail: { kind: string | null; userErrors: { message: string }[] } }>('mutation ($input: UnsubscribeEmailInput!) { unsubscribeEmail(input: $input) { kind userErrors { message } } }', { input: { token } })
    expect(res.data!.unsubscribeEmail).toEqual({ kind: 'CLASSROOM_POST', userErrors: [] })
    expect(await service.sendClassroomPost(postId, pupil.id)).toBe(false)
    const forged = await gql<{ unsubscribeEmail: { userErrors: { message: string }[] } }>('mutation ($input: UnsubscribeEmailInput!) { unsubscribeEmail(input: $input) { userErrors { message } } }', { input: { token: `${token}x` } })
    expect(forged.data!.unsubscribeEmail.userErrors[0]!.message).toMatch(/not valid/)
    sent.mockRestore()
  })

  it('the weekly digest counts the week’s unread notifications, once in six days, unless turned off', async () => {
    const asha = await person({ name: 'Asha' })
    const quiet = await person({ name: 'Quiet' })
    const priya = await person({ name: 'Priya' })
    for (const who of [asha, quiet]) {
      await notify(who.id, priya.id, 'FOLLOW')
      await notify(who.id, priya.id, 'COMMENT')
      await notify(who.id, priya.id, 'COMMENT')
    }
    // Quiet left the digest by its one-click link.
    await gql('mutation ($input: UnsubscribeEmailInput!) { unsubscribeEmail(input: $input) { kind } }', { input: { token: unsubscribeToken(t.config.CODE_HMAC_SECRET, quiet.id, 'DIGEST') } })
    const sent = jest.spyOn(t.app.get(MailService), 'send').mockResolvedValue()
    const service = t.app.get(EmailNotificationsService)
    await service.sendDigests()
    const mine = sent.mock.calls.filter((c) => c[0] === asha.email)
    expect(mine).toHaveLength(1)
    expect(mine[0]![2]).toMatchObject({ lines: ['2 comments and replies', '1 new follower'], link: expect.stringMatching(/\/notifications$/) })
    expect(sent.mock.calls.some((c) => c[0] === quiet.email)).toBe(false)
    sent.mockClear()
    await service.sendDigests()
    expect(sent.mock.calls.some((c) => c[0] === asha.email)).toBe(false)
    sent.mockRestore()
  })
})
