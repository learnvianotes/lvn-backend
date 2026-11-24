import { RecommendationsService } from '../../src/application/recommendations.service'

describe('recommendations for a minor', () => {
  it('uses popular and recent public notes and not the person’s behaviour', async () => {
    const exams = { list: jest.fn(), weakTopics: jest.fn() }
    const notes = { recentPublic: jest.fn(async () => [{ noteId: 'n1', title: 'Cells', topicIds: [] }]), publicOnTopics: jest.fn() }
    const people = { isMinorForAi: jest.fn(async () => true), interestTopicIds: jest.fn(async () => ['secret']) }
    const db = {
      $queryRaw: jest.fn(async () => [{ noteId: 'n1', n: 4n }]),
      $transaction: jest.fn(async (ops: unknown[]) => ops),
      recommendation: { deleteMany: jest.fn(async () => ({})), createMany: jest.fn(async () => ({})) },
    }
    const service = new RecommendationsService(db as never, exams as never, {} as never, {} as never, notes as never, {} as never, people as never, {} as never)
    const items = await service.compute('child')
    expect(items).toEqual([expect.objectContaining({ kind: 'POPULAR_NOTE', entityId: 'n1', reason: 'Popular right now' })])
    expect(JSON.stringify(items)).not.toMatch(/you were reading|your exam|your topics/i)
    expect(exams.list).not.toHaveBeenCalled()
    expect(people.interestTopicIds).not.toHaveBeenCalled()
    expect(notes.publicOnTopics).not.toHaveBeenCalled()
  })

  it('says a note is recently published when nobody has opened it', async () => {
    const notes = { recentPublic: jest.fn(async () => [{ noteId: 'n2', title: 'New', topicIds: [] }]) }
    const db = {
      $queryRaw: jest.fn(async () => []),
      $transaction: jest.fn(async (ops: unknown[]) => ops),
      recommendation: { deleteMany: jest.fn(async () => ({})), createMany: jest.fn(async () => ({})) },
    }
    const service = new RecommendationsService(db as never, {} as never, {} as never, {} as never, notes as never, {} as never, { isMinorForAi: async () => true } as never, {} as never)
    const items = await service.compute('unknown-age')
    expect(items[0]).toMatchObject({ kind: 'POPULAR_NOTE', reason: 'Recently published' })
  })
})
