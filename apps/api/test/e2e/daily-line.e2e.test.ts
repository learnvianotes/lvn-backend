import { DailyLineService } from '@lvn-backend/core'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { startFakeOllama, type FakeOllama } from '@lvn-backend/testing'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/**
 * Home's line for the day (ADR-0087): a chosen line until AI has written one; then the person's own line, from what
 * is known of their learning, the same all day and new the next; a chosen line again when AI cannot write one.
 */
describe('Home’s line for the day', () => {
  let t: TestApp
  let db: PrismaService
  let ollama: FakeOllama
  let lines: DailyLineService
  let person: { id: string; token: string }
  const QUERY = 'query { dailyLine { day title line fromAi pending } }'
  const read = async () => (await t.gql<{ dailyLine: { day: string; title: string; line: string; fromAi: boolean; pending: boolean } }>(QUERY, {}, person.token)).data!.dailyLine

  beforeAll(async () => {
    ollama = await startFakeOllama()
    t = await createTestApp({ AI_PROVIDER: 'ollama', OLLAMA_URL: ollama.url, AI_CHAT_MODEL: 'gemma4', AI_EMBED_MODEL: 'embeddinggemma' })
    db = t.app.get(PrismaService)
    lines = t.app.get(DailyLineService)
    const s = await seedUser(t.app, { verified: true, displayName: 'Asha Rao' })
    person = { id: s.id, token: tokenFor(t.config, s.id) }
  })

  afterAll(async () => {
    await t?.close()
    await ollama?.stop()
  })

  it('shows a chosen line while AI writes the person’s own, then theirs all day', async () => {
    const day = new Date()
    day.setUTCDate(day.getUTCDate() + 20)
    await db.exam.create({ data: { id: newId(), userId: person.id, name: 'Biology mid-term', date: day } })
    const first = await read()
    expect(first).toMatchObject({ fromAi: false, pending: true })
    expect(first.title.length).toBeGreaterThan(2)

    ollama.answer = () => JSON.stringify({ title: '“Biology, step by step!”', line: 'Twenty days to your Biology mid-term: one topic today keeps you on track. 🚀' })
    expect(await lines.write(person.id, first.day)).toBe(true)
    const asked = ollama.chats.at(-1)!.messages.map((m) => m.content).join('\n')
    expect(asked).toContain('Next exam: Biology mid-term, in 20 days.')
    expect(asked).toContain('Has not had a learning day in the app yet.')

    // Quotes, the emoji and the headline's "!" are left out; the same line all day, written once.
    const written = { day: first.day, title: 'Biology, step by step', line: 'Twenty days to your Biology mid-term: one topic today keeps you on track.', fromAi: true, pending: false }
    expect(await read()).toEqual(written)
    expect(await lines.write(person.id, first.day)).toBe(false)
    expect(await read()).toEqual(written)
  })

  it('changes with the day, and falls back to a chosen line when AI cannot write one', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000)
    const next = await lines.forViewer(person.id, tomorrow)
    expect(next).toMatchObject({ fromAi: false, pending: true })
    expect(next.day).not.toBe((await read()).day)

    ollama.answer = () => ({ status: 500 })
    expect(await lines.write(person.id, next.day, tomorrow)).toBe(false)
    // Not asked again for a while: the chosen line, without waiting.
    expect(await lines.forViewer(person.id, tomorrow)).toEqual({ ...next, pending: false })
  })

  it('is for signed-in people only', async () => {
    const res = await t.gql(QUERY, {})
    expect(res.errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
  })
})
