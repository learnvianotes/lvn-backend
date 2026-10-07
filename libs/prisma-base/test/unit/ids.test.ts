import { idTime, isUuid, newId } from '../../src/ids'

describe('newId', () => {
  it('produces RFC 9562 version-7 UUIDs', () => {
    const id = newId()
    expect(isUuid(id)).toBe(true)
    expect(id[14]).toBe('7')
    expect('89ab').toContain(id[19])
  })

  it('encodes the creation time', () => {
    const at = Date.UTC(2026, 9, 8, 12, 0, 0)
    expect(idTime(newId(at)).getTime()).toBeGreaterThanOrEqual(at)
  })

  it('sorts by creation order, even within one millisecond', () => {
    const now = Date.now() + 10_000
    const ids = Array.from({ length: 5000 }, () => newId(now))
    expect([...ids].sort()).toEqual(ids)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('isUuid', () => {
  it.each(['', 'not-a-uuid', '01234567-89ab-cdef-0123-456789abcdef0', '01234567-89ab-0def-0123-456789abcdef'])('rejects %j', (v) => {
    expect(isUuid(v)).toBe(false)
  })
})
