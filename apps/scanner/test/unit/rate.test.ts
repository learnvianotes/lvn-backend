import { CallerRate } from '../../src/rate'

describe('scanner caller rate', () => {
  it('allows the cap and then says when the window moves', () => {
    const rate = new CallerRate(2, 60_000)
    expect(rate.take('10.0.0.8', 0)).toBeNull()
    expect(rate.take('10.0.0.8', 1_000)).toBeNull()
    expect(rate.take('10.0.0.8', 2_000)).toBe(58)
    expect(rate.take('10.0.0.9', 2_000)).toBeNull()
    expect(rate.take('10.0.0.8', 60_001)).toBeNull()
  })
})