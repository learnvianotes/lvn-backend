import { chunkCards, CHUNK_CHARS, OVERLAP_CHARS, toVector, tokensOf } from '../../src/domain/chunking'

/** Chunks of a published version (§10.2, ADR-0060): about 500 tokens, 50 of overlap, each knowing its cards. */
const sentence = (i: number) => `Sentence ${i} says something about heaps and their order. `

describe('chunkCards', () => {
  it('keeps a short note whole, with every card it holds', () => {
    const chunks = chunkCards([
      { id: 'a', text: 'Binary heaps' },
      { id: 'b', text: '' },
      { id: 'c', text: 'A min-heap keeps the smallest item on top.' },
    ])
    expect(chunks).toEqual([{ position: 0, cardIds: ['a', 'c'], text: 'Binary heaps\n\nA min-heap keeps the smallest item on top.', tokens: tokensOf('Binary heaps\n\nA min-heap keeps the smallest item on top.') }])
  })

  it('cuts a long note into windows of about 500 tokens that overlap and end on sentences', () => {
    const long = Array.from({ length: 120 }, (_, i) => sentence(i)).join('')
    const chunks = chunkCards([{ id: 'a', text: long }, { id: 'b', text: 'The last card.' }])
    expect(chunks.length).toBeGreaterThan(3)
    for (const c of chunks.slice(0, -1)) {
      expect(c.text.length).toBeLessThanOrEqual(CHUNK_CHARS)
      expect(c.text.length).toBeGreaterThan(CHUNK_CHARS * 0.5)
      expect(c.text.endsWith('.')).toBe(true)
    }
    // Each window repeats the end of the one before it.
    for (let i = 1; i < chunks.length; i++) {
      const tail = chunks[i - 1]!.text.slice(-OVERLAP_CHARS / 2)
      expect(chunks[i]!.text.includes(tail.trim().slice(-40))).toBe(true)
    }
    expect(chunks.map((c) => c.position)).toEqual(chunks.map((_, i) => i))
    expect(chunks.at(-1)!.cardIds).toContain('b')
    expect(chunks[0]!.cardIds).toEqual(['a'])
  })

  it('makes nothing of a note with no words, and always moves forward on text without spaces', () => {
    expect(chunkCards([{ id: 'a', text: '   ' }])).toEqual([])
    const chunks = chunkCards([{ id: 'a', text: 'x'.repeat(5000) }])
    expect(chunks.map((c) => c.text.length)).toEqual([2000, 2000, 1400])
  })

  it('writes vectors as pgvector reads them', () => {
    expect(toVector([0.5, -1, Number.NaN])).toBe('[0.5,-1,0]')
  })
})
