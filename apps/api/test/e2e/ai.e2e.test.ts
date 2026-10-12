import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { startFakeOllama, type FakeOllama } from '@lvn-backend/testing'
import { createTestApp, type TestApp } from '../support/app'
import { seedUser, tokenFor } from '../support/seed'

/** The AI gateway through the API (§10.1, ADR-0058): whether AI answers, and each person's allowance for the day. */
describe('AI gateway', () => {
  let off: TestApp
  let on: TestApp
  let ollama: FakeOllama

  beforeAll(async () => {
    ollama = await startFakeOllama()
    off = await createTestApp()
    on = await createTestApp({ AI_PROVIDER: 'ollama', OLLAMA_URL: ollama.url, AI_CHAT_MODEL: 'gemma4', AI_EMBED_MODEL: 'embeddinggemma' }, { resetDatabase: false })
  })

  afterAll(async () => {
    await on?.close()
    await off?.close()
    await ollama?.stop()
  })

  it('says AI is off where nothing is configured, and on where a model is', async () => {
    expect((await off.gql('{ aiStatus { available reason } }')).data).toEqual({ aiStatus: { available: false, reason: 'NOT_CONFIGURED' } })
    expect((await on.gql('{ aiStatus { available reason } }')).data).toEqual({ aiStatus: { available: true, reason: null } })
  })

  it('shows each signed-in person their tokens today and their plan’s limit (the FREE plan: §10.1’s numbers by role)', async () => {
    const student = await seedUser(on.app, { verified: true })
    const teacher = await seedUser(on.app, { verified: true, globalRole: 'TEACHER' })
    await on.app.get(PrismaService).aiUsage.create({ data: { id: newId(), userId: student.id, task: 'SUMMARIZE', provider: 'OLLAMA', model: 'gemma4', promptTokens: 1200, completionTokens: 300, latencyMs: 900, ok: true } })
    const allowance = async (id: string) => (await on.gql<{ myAiAllowance: { usedToday: number; limitToday: number; resetsAt: string } }>('{ myAiAllowance { usedToday limitToday resetsAt } }', {}, tokenFor(on.config, id))).data!.myAiAllowance
    const mine = await allowance(student.id)
    expect(mine).toMatchObject({ usedToday: 1500, limitToday: 200_000 })
    expect(new Date(mine.resetsAt).getUTCHours()).toBe(0)
    expect(await allowance(teacher.id)).toMatchObject({ usedToday: 0, limitToday: 1_000_000 })
    expect((await on.gql('{ myAiAllowance { usedToday } }')).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED')
  })
})
