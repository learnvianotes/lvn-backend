import { DailyLineLabelResolver } from '../../src/graphql/daily-line.resolver'

describe('DailyLine AI label', () => {
  it('follows fromAi, so a chosen line is not marked as model text', () => {
    const labels = new DailyLineLabelResolver()
    expect(labels.aiGenerated({ fromAi: true })).toBe(true)
    expect(labels.aiGenerated({ fromAi: false })).toBe(false)
  })
})
