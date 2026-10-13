import { acceptReading, pageText, replacePage } from '../../src/domain/escalation'

/** Stage 4 of ADR-0028 (ADR-0063): taking a page's new reading, or not, and putting it in the OCR's place. */
const FILE = '01920000-0000-7000-8000-00000000f0f0'
const text = (s: string, page?: number) => ({ type: 'text' as const, content: { doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] }, ...(page ? { anchor: { fileId: FILE, page, rects: [] } } : {}) } })
const OCR = 'Photosynthesis turns light into chemical energy inside the chloroplast of every green plant cell'

describe('escalation', () => {
  it('takes a reading that shares enough of the OCR’s words, and rejects one that disagrees sharply', () => {
    expect(acceptReading(OCR, 'Photosynthesis turns light into chemical energy in the chloroplast.', 0.7)).toBe(true)
    expect(acceptReading(OCR, 'The French Revolution began in 1789 with the storming of the Bastille.', 0.7)).toBe(false)
    // A text layer's words are judged by too (formula pages).
    expect(acceptReading(OCR, 'Something else entirely about rivers and mountains and valleys.', null)).toBe(false)
  })

  it('takes any reading of a page the OCR read poorly, or of a page with too few words to judge by, but never an empty one', () => {
    expect(acceptReading('xq zzv lllk prrt qqmn', 'A handwritten note about enzymes and catalysts.', 0.3)).toBe(true)
    expect(acceptReading('E = mc2', 'E = mc^2, mass and energy', 0.9)).toBe(true)
    expect(acceptReading(OCR, '  ', 0.3)).toBe(false)
  })

  it('puts the reading where the page’s OCR cards were, with the page’s anchor', () => {
    const cards = [text('one', 1), text('two a', 2), text('two b', 2), text('three', 3)]
    expect(pageText(cards, 2)).toBe('two a\ntwo b')
    const out = replacePage(cards, 2, [text('TWO')], FILE)
    expect(out.map((c) => pageText([c], (c.content as { anchor: { page: number } }).anchor.page))).toEqual(['one', 'TWO', 'three'])
    expect((out[1]!.content as { anchor: unknown }).anchor).toEqual({ fileId: FILE, page: 2 })
    // The page's pictures stay where they were: the vision model only transcribes.
    const picture = { type: 'image' as const, content: { fileId: FILE, alt: '', anchor: { fileId: FILE, page: 2, rects: [] } } }
    expect(replacePage([text('one', 1), text('two a', 2), picture, text('two b', 2)], 2, [text('TWO')], FILE).map((c) => c.type)).toEqual(['text', 'text', 'image'])
    expect(pageText([text('two a', 2), picture], 2)).toBe('two a')
    // A page the OCR made nothing of: after the earlier pages' cards.
    expect(replacePage([text('one', 1), text('three', 3)], 2, [text('TWO')], FILE).map((c) => (c.content as { anchor: { page: number } }).anchor.page)).toEqual([1, 2, 3])
  })
})
