import { isEnumType, isInputObjectType, isInterfaceType, isObjectType, type GraphQLSchema } from 'graphql'
import { AchievementsService, ContestsService, PointsService } from '@lvn-backend/core'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'
import { publicSchema } from './support/fuzz'

/**
 * Phase 8's exit (plans/phase-8.md): anything ranked leaves minors out by default, and there are no company features
 * (ADR-0080, ADR-0082, ADR-0083). Also the engagement rules a person could try to bend: points cannot be farmed by
 * oneself, a new or unverified account, or one friend over and over; achievements and levels are private by default.
 */
describe('security: engagement', () => {
  type Person = { id: string; token: string }
  let t: TestApp
  let db: PrismaService
  let schema: GraphQLSchema
  const DAY = 86_400_000

  beforeAll(async () => {
    t = await createTestApp()
    db = t.app.get(PrismaService)
    schema = await publicSchema(t)
  })
  afterAll(async () => {
    await t?.close()
  })

  const person = async (opts: { dob?: string; ageDays?: number; verified?: boolean; role?: 'STUDENT' | 'PLATFORM_ADMIN' } = {}): Promise<Person> => {
    const u = await seedUser(t.app, { verified: opts.verified ?? true, ...(opts.role ? { globalRole: opts.role } : {}) })
    await db.user.update({ where: { id: u.id }, data: { createdAt: new Date(Date.now() - (opts.ageDays ?? 30) * DAY), ...(opts.dob ? { dateOfBirth: new Date(opts.dob) } : {}) } })
    return { id: u.id, token: tokenFor(t.config, u.id, undefined, [opts.role ?? 'STUDENT']) }
  }
  const minorDob = () => `${new Date().getUTCFullYear() - 15}-01-01`

  it('a contest band never goes to a minor and never counts one, whatever is stored', async () => {
    const contests = t.app.get(ContestsService)
    const admin = await person({ role: 'PLATFORM_ADMIN' })
    const now = new Date()
    const id = await contests.create(admin.id, { title: 'Exit contest', opensAt: new Date(now.getTime() - 3_600_000), closesAt: new Date(now.getTime() + 3_600_000), minutes: 10, questionCount: 3, questions: [1, 2, 3].map((n) => ({ prompt: `Q${n}?`, choices: ['Right', 'Wrong'], correct: 0, explanation: 'Because.' })) })
    await contests.publish(admin.id, id)
    const take = async (who: Person, right: number) => {
      const c = await contests.start(who.id, id)
      const a = c.viewerAttempt!
      for (const [i, q] of a.questions.entries()) await contests.answer(who.id, { attemptId: a.id, questionId: q.id, choiceId: q.choices.find((x) => x.text === (i < right ? 'Right' : 'Wrong'))!.id })
      await contests.submit(who.id, a.id)
    }
    const minors = [await person({ dob: minorDob() }), await person({ dob: minorDob() })]
    const adult = await person()
    const others = [await person(), await person(), await person()]
    for (const m of minors) await take(m, 3)
    await take(adult, 3)
    for (const [i, o] of others.entries()) await take(o, 2 - i)
    // Every setting on, the minors' stored by hand.
    for (const p of [adult, ...minors]) await db.learnerSettings.upsert({ where: { userId: p.id }, create: { userId: p.id, contestBands: true }, update: { contestBands: true } })
    await db.contest.update({ where: { id }, data: { closesAt: new Date(Date.now() - 1000) } })
    // The adult is first of four adults (top 25 %); counting the minors would make them third of six (top half).
    expect((await contests.one(adult.id, id))!.viewerAttempt!.band).toBe('TOP_25')
    for (const m of minors) expect((await contests.one(m.id, id))!.viewerAttempt!.band).toBeNull()
    expect(await contests.settings(minors[0]!.id)).toEqual({ showBands: false, canShowBands: false })
  })

  it('a minor’s achievements and level are never shown to anyone else, and nothing is shown by default', async () => {
    const achievements = t.app.get(AchievementsService)
    const minor = await person({ dob: minorDob() })
    const adult = await person()
    const viewer = await person()
    for (const p of [minor, adult]) await db.achievement.create({ data: { id: newId(), userId: p.id, kind: 'RHYTHM_WEEKS', tier: 4, key: 'RHYTHM_WEEKS:4' } })
    // By default: their own only.
    expect(await achievements.of(viewer.id, adult.id)).toBeNull()
    expect((await achievements.of(adult.id, adult.id))!.length).toBe(1)
    // Shown by the adult; never for the minor, even with the setting stored.
    for (const p of [minor, adult]) await db.learnerSettings.upsert({ where: { userId: p.id }, create: { userId: p.id, showAchievements: true }, update: { showAchievements: true } })
    expect((await achievements.of(viewer.id, adult.id))!.length).toBe(1)
    expect(await achievements.of(viewer.id, minor.id)).toBeNull()
    expect(await achievements.contributionOf(viewer.id, minor.id)).toBeNull()
    expect(await achievements.of(null, minor.id)).toBeNull()
  })

  it('points cannot be farmed: oneself, a new or unverified account, a blocked one, or one friend over and over', async () => {
    const points = t.app.get(PointsService)
    const author = await person()
    const award = (actorId: string | null, sourceId = newId()) => points.award({ rule: 'REACTION', recipientId: author.id, actorId, sourceType: 'NOTE', sourceId })
    expect(await award(author.id)).toBe(false)
    expect(await award((await person({ ageDays: 3 })).id)).toBe(false)
    expect(await award((await person({ verified: false })).id)).toBe(false)
    const blocker = await person()
    await db.block.create({ data: { blockerId: author.id, blockedId: blocker.id } })
    expect(await award(blocker.id)).toBe(false)
    const friend = await person()
    const awarded = []
    for (let i = 0; i < 8; i++) awarded.push(await award(friend.id))
    expect(awarded.filter(Boolean)).toHaveLength(5)
    // The same action twice counts once.
    const same = newId()
    const other = await person()
    expect([await award(other.id, same), await award(other.id, same)]).toEqual([true, false])
    expect(await points.balance(author.id)).toBe(6)
  })

  it('has no company features: no type, field, argument or value about companies, jobs, hiring or interviews', () => {
    const names: string[] = []
    for (const type of Object.values(schema.getTypeMap())) {
      if (type.name.startsWith('__')) continue
      names.push(type.name)
      if (isObjectType(type) || isInterfaceType(type) || isInputObjectType(type))
        for (const field of Object.values(type.getFields())) {
          names.push(`${type.name}.${field.name}`)
          if ('args' in field) for (const arg of field.args) names.push(`${type.name}.${field.name}(${arg.name})`)
        }
      if (isEnumType(type)) for (const value of type.getValues()) names.push(`${type.name}.${value.name}`)
    }
    const words = (name: string) =>
      name
        .split(/[.(]/)
        .filter(Boolean)
        .pop()!
        .replace(/\)$/, '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .toLowerCase()
        .split(' ')
    const company = ['company', 'companies', 'employer', 'job', 'jobs', 'recruit', 'recruiter', 'recruitment', 'hiring', 'hire', 'career', 'careers', 'salary', 'referral', 'interview', 'interviews', 'resume', 'candidate', 'vacancy', 'placement']
    expect(names.length).toBeGreaterThan(500)
    expect(names.filter((n) => words(n).some((w) => company.includes(w)))).toEqual([])
  })
})
