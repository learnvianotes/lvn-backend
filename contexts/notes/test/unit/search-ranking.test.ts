import { fuse, RRF_K } from '../../src/application/search-ranking'

/** Reciprocal rank fusion (ADR-0057). */
describe('fuse', () => {
  it('keeps a single list as it is', () => {
    expect(fuse([['a', 'b', 'c']])).toEqual(['a', 'b', 'c'])
    expect(fuse([['a', 'b'], []])).toEqual(['a', 'b'])
  })

  it('lifts what both lists rank, and keeps the keyword order on ties', () => {
    // c is third by keywords and first by meaning: 1/63 + 1/61 beats a's 1/61 alone; b and d tie at 1/62, b first.
    expect(fuse([['a', 'b', 'c'], ['c', 'd']])).toEqual(['c', 'a', 'b', 'd'])
    // Same score (first place in one list each): the first list's comes first.
    expect(fuse([['a'], ['z']])).toEqual(['a', 'z'])
  })

  it('scores 1 / (k + rank)', () => {
    const k = 1
    // a: 1/2 + 1/4 = 0.75; b: 1/3 + 1/2 = 0.833…; c: 1/4 + 1/3 = 0.583…
    expect(fuse([['a', 'b', 'c'], ['b', 'c', 'a']], k)).toEqual(['b', 'a', 'c'])
    expect(RRF_K).toBe(60)
  })
})
