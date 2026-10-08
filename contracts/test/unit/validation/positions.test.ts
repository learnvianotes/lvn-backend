import { isValidPosition, positionBetween, positionsBetween } from '../../../src/validation/positions'

/** A small deterministic generator, so a failing sequence can be replayed. */
function random(seed: number) {
  return () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31
    return seed / 2 ** 31
  }
}

describe('card positions (fractional indexes, §13.2)', () => {
  it('starts in the middle and grows in both directions', () => {
    const first = positionBetween(null, null)
    expect(first).toBe('a0')
    expect(positionBetween(first, null) > first).toBe(true)
    expect(positionBetween(null, first) < first).toBe(true)
  })

  it('always finds a key strictly between two keys, and every key it makes is valid', () => {
    const next = random(42)
    const keys = [positionBetween(null, null)]
    for (let i = 0; i < 3_000; i++) {
      const at = Math.floor(next() * (keys.length + 1))
      const key = positionBetween(keys[at - 1] ?? null, keys[at] ?? null)
      expect(isValidPosition(key)).toBe(true)
      if (at > 0) expect(key > keys[at - 1]!).toBe(true)
      if (at < keys.length) expect(key < keys[at]!).toBe(true)
      keys.splice(at, 0, key)
    }
    expect(new Set(keys).size).toBe(keys.length)
    expect([...keys].sort()).toEqual(keys)
  })

  it('keeps keys short when appending, as typing new cards does', () => {
    let key = positionBetween(null, null)
    for (let i = 0; i < 10_000; i++) key = positionBetween(key, null)
    expect(key.length).toBeLessThanOrEqual(4)
  })

  it('makes n ordered keys at once (imports, restores, pasted blocks)', () => {
    for (const [a, b] of [[null, null], ['a0', null], [null, 'a0'], ['a0', 'a1']] as const) {
      const keys = positionsBetween(a, b, 25)
      expect(keys).toHaveLength(25)
      expect([...keys].sort()).toEqual(keys)
      if (a) expect(keys[0]! > a).toBe(true)
      if (b) expect(keys.at(-1)! < b).toBe(true)
    }
    expect(positionsBetween(null, null, 0)).toEqual([])
  })

  it('refuses keys it could not have made', () => {
    for (const bad of ['', 'a', 'a00', 'b0', '!!', `A${'0'.repeat(26)}`, 'a0'.padEnd(80, 'z'), 42, null]) expect(isValidPosition(bad)).toBe(false)
    expect(() => positionBetween('a1', 'a0')).toThrow()
    expect(() => positionBetween('a0', 'a0')).toThrow()
  })
})
