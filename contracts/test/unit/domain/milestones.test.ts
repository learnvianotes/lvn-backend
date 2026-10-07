import { milestoneFor } from '../../../src/domain/milestones'

describe('milestoneFor', () => {
  it('shows nothing below 1,000', () => {
    for (const n of [0, 1, 999, -5, Number.NaN]) expect(milestoneFor(n)).toBeNull()
  })

  it('rounds down to the highest rung reached', () => {
    expect(milestoneFor(1_000)).toBe(1_000)
    expect(milestoneFor(1_999)).toBe(1_000)
    expect(milestoneFor(4_999)).toBe(2_000)
    expect(milestoneFor(10_001)).toBe(10_000)
    expect(milestoneFor(999_999)).toBe(500_000)
  })

  it('counts whole millions above the ladder', () => {
    expect(milestoneFor(1_000_000)).toBe(1_000_000)
    expect(milestoneFor(3_400_000)).toBe(3_000_000)
  })
})
