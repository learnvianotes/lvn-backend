import { citedSources, passagesOf, rerank, sourcesBlock, termsOf, type Passage } from '../../src/domain/ask'

/** Ask AI's pure steps (ADR-0060): passages of one note, the rerank, and the sources an answer cites. */
const passage = (noteId: string, text: string, similarity?: number): Passage => ({ noteId, versionId: 'v', title: `Note ${noteId}`, public: true, cardIds: [`${noteId}-card`], text, similarity })

describe('Ask AI', () => {
  it('groups a note’s cards into passages of about 2,000 characters, cutting a long card at a space', () => {
    const long = 'word '.repeat(700).trim()
    const passages = passagesOf([
      { id: 'a', text: 'Heaps' },
      { id: 'b', text: 'A min-heap keeps the smallest item on top.' },
      { id: 'c', text: long },
      { id: 'd', text: '' },
    ])
    // Short cards share a passage; a long card's pieces fill their own.
    expect(passages[0]).toEqual({ cardIds: ['a', 'b'], text: 'Heaps\n\nA min-heap keeps the smallest item on top.' })
    expect(passages[1]!.cardIds).toEqual(['c'])
    expect(passages.every((p) => p.text.length <= 2000)).toBe(true)
    expect(passages.at(-1)!.cardIds).toEqual(['c'])
    expect(passages.map((p) => p.text).join(' ').match(/word/g)).toHaveLength(700)
  })

  it('reads the question’s meaningful words', () => {
    expect(termsOf('What does a min-heap keep on top, and why?')).toEqual(['min', 'heap', 'keep', 'top'])
  })

  it('reranks by similarity and words, keeps at most three passages of one note, and eight in all', () => {
    const many = Array.from({ length: 6 }, (_, i) => passage('long', `heap part ${i}`, 0.9 - i * 0.01))
    const others = Array.from({ length: 8 }, (_, i) => passage(`n${i}`, i === 7 ? 'heap smallest root' : 'unrelated', 0.5))
    const kept = rerank('smallest heap root', [...many, ...others])
    expect(kept).toHaveLength(8)
    expect(kept.filter((p) => p.noteId === 'long')).toHaveLength(3)
    // Words lift a passage the vectors ranked level with the rest.
    expect(kept.findIndex((p) => p.noteId === 'n7')).toBeLessThan(kept.findIndex((p) => p.noteId === 'n0'))
  })

  it('keeps one note’s order when its passages share no words with the question', () => {
    const own = [passage('x', 'first'), passage('x', 'second'), passage('x', 'third')]
    expect(rerank('photosynthesis', own, 8, Infinity).map((p) => p.text)).toEqual(['first', 'second', 'third'])
  })

  it('numbers the sources for the prompt and returns the ones the answer cites, else the first three', () => {
    const ps = [passage('a', 'Alpha.'), passage('b', 'Beta.'), passage('c', 'Gamma.'), passage('d', `${'x '.repeat(200)}tail`)]
    expect(sourcesBlock(ps.slice(0, 2))).toBe('[1] Note a\nAlpha.\n\n[2] Note b\nBeta.')
    expect(citedSources('Beta holds [2], and Gamma [3][2]. Not [9].', ps).map((s) => s.n)).toEqual([2, 3])
    expect(citedSources('No citations here.', ps).map((s) => s.noteId)).toEqual(['a', 'b', 'c'])
    const [d] = citedSources('See [4].', ps)
    expect(d).toMatchObject({ n: 4, noteId: 'd', versionId: 'v', cardIds: ['d-card'] })
    expect(d!.snippet.length).toBeLessThanOrEqual(241)
    expect(d!.snippet.endsWith('…')).toBe(true)
  })
})
