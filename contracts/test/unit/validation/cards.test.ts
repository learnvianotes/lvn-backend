import { CardType } from '../../../src/domain/enums'
import { CARD_CONTENT, CARD_LIMITS, cardAnchor, cardPlainText, MEDIA_CARD_TYPES, parseCardContent } from '../../../src/validation/cards'

const p = (text: string, marks?: unknown[]) => ({ type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] })
const doc = (...blocks: unknown[]) => ({ type: 'doc', content: blocks })
const inline = (text: string) => [{ type: 'text', text }]
const fileId = '01920000-0000-7000-8000-000000000001'

/** One valid content per card type: every type the editors offer can be stored. */
const VALID: Record<CardType, unknown> = {
  text: { doc: doc(p('Hello', [{ type: 'bold' }]), { type: 'bulletList', content: [{ type: 'listItem', content: [p('one')] }] }) },
  heading: { level: 2, content: inline('Arrays') },
  markdown: { source: '# Title\n\n- item' },
  code: { language: 'python', code: 'print("hi")' },
  image: { fileId, alt: 'A diagram', caption: inline('Figure 1') },
  video: { fileId },
  audio: { fileId, caption: inline('Lecture') },
  file: { fileId },
  diagram: { syntax: 'mermaid', source: 'graph TD; A-->B' },
  quote: { doc: doc(p('To be or not to be')), attribution: 'Shakespeare' },
  callout: { variant: 'tip', title: 'Remember', doc: doc(p('Indexes start at 0')) },
  checklist: { items: [{ id: 'a', checked: true, content: inline('Read chapter 1') }] },
  table: { hasHeaderRow: true, rows: [[inline('n'), inline('n²')], [inline('2'), inline('4')]] },
  question: { prompt: doc(p('What is 2+2?')), answer: doc(p('4')) },
  quiz: { question: doc(p('Pick the prime')), choices: [{ id: 'a', content: inline('4') }, { id: 'b', content: inline('7') }], correct: ['b'], multiple: false },
  flashcard: { front: doc(p('Big-O of binary search')), back: doc(p('O(log n)')) },
}

describe('card content (§4.1)', () => {
  it('has a schema for every card type', () => {
    expect(Object.keys(CARD_CONTENT).sort()).toEqual(Object.values(CardType).sort())
  })

  it.each(Object.entries(VALID))('accepts a %s card', (type, content) => {
    expect(parseCardContent(type as CardType, content)).toMatchObject({ ok: true })
  })

  it('drops attributes it does not know, so editors cannot smuggle markup through', () => {
    const r = parseCardContent('text', { doc: doc({ type: 'paragraph', attrs: { style: 'x' }, content: [{ type: 'text', text: 'a', onclick: 'x' }] }), extra: 1 })
    expect(r).toEqual({ ok: true, content: { doc: doc({ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }) } })
  })

  it.each([
    ['a script link', 'text', { doc: doc(p('x', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])) }],
    ['a data link', 'text', { doc: doc(p('x', [{ type: 'link', attrs: { href: 'data:text/html,hi' } }])) }],
    ['a relative link', 'text', { doc: doc(p('x', [{ type: 'link', attrs: { href: '/admin' } }])) }],
    ['an unknown node', 'text', { doc: doc({ type: 'iframe', attrs: { src: 'https://evil' } }) }],
    ['an unknown mark', 'text', { doc: doc(p('x', [{ type: 'script' }])) }],
    ['an empty text node', 'text', { doc: doc({ type: 'paragraph', content: [{ type: 'text', text: '' }] }) }],
    ['a heading level 4', 'heading', { level: 4, content: inline('x') }],
    ['a media card without a file', 'image', { alt: 'x' }],
    ['a file given as a URL', 'file', { fileId: 'https://bucket/key' }],
    ['a ragged table', 'table', { hasHeaderRow: false, rows: [[inline('a'), inline('b')], [inline('c')]] }],
    ['a quiz answer that is not a choice', 'quiz', { ...(VALID.quiz as object), correct: ['z'] }],
    ['a single-answer quiz with two answers', 'quiz', { ...(VALID.quiz as object), correct: ['a', 'b'] }],
    ['repeated quiz choice ids', 'quiz', { ...(VALID.quiz as object), choices: [{ id: 'a', content: inline('x') }, { id: 'a', content: inline('y') }], correct: ['a'] }],
    ['a code language with spaces', 'code', { language: 'my lang', code: '' }],
    ['a mermaid diagram with another syntax', 'diagram', { syntax: 'plantuml', source: '' }],
  ])('refuses %s', (_, type, content) => {
    const r = parseCardContent(type as CardType, content)
    expect(r.ok).toBe(false)
  })

  it('refuses lists nested deeper than five levels', () => {
    let node: unknown = p('deep')
    for (let i = 0; i < 6; i++) node = { type: 'bulletList', content: [{ type: 'listItem', content: [node] }] }
    expect(parseCardContent('text', { doc: doc(node) })).toEqual({ ok: false, message: 'Lists can nest at most 5 levels deep (doc)' })
  })

  it('refuses oversized cards before parsing them', () => {
    expect(parseCardContent('markdown', { source: 'x'.repeat(250_000) })).toEqual({ ok: false, message: 'This card is too large; split it into several cards' })
  })

  it('says which part of a card is wrong', () => {
    const r = parseCardContent('heading', { level: 1, content: [{ type: 'text', text: 7 }] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/content\.0\.text/)
  })

  it('knows which cards carry files', () => {
    expect([...MEDIA_CARD_TYPES].sort()).toEqual(['audio', 'file', 'image', 'video'])
  })

  it('reads the words of every card type aloud', () => {
    expect(cardPlainText('text', VALID.text)).toBe('Hello\none')
    expect(cardPlainText('heading', VALID.heading)).toBe('Arrays')
    expect(cardPlainText('table', VALID.table)).toBe('n\tn²\n2\t4')
    expect(cardPlainText('quiz', VALID.quiz)).toBe('Pick the prime\n4\n7')
    expect(cardPlainText('callout', VALID.callout)).toBe('Remember\nIndexes start at 0')
    expect(cardPlainText('image', VALID.image)).toBe('A diagram\nFigure 1')
    for (const type of Object.values(CardType)) expect(typeof cardPlainText(type, VALID[type])).toBe('string')
    expect(cardPlainText('text', { nonsense: true })).toBe('')
  })
})

describe('card anchors (ADR-0040)', () => {
  const anchor = { fileId, page: 12, rects: [[0.1, 0.2, 0.6, 0.25]], quote: 'The mitochondria is the powerhouse of the cell' }

  it.each(Object.entries(VALID))('keeps the anchor of a %s card', (type, content) => {
    const r = parseCardContent(type as CardType, { ...(content as object), anchor })
    expect(r).toMatchObject({ ok: true, content: { anchor } })
  })

  it('anchors a page without a passage', () => {
    expect(parseCardContent('text', { ...(VALID.text as object), anchor: { fileId, page: 3 } })).toMatchObject({ ok: true, content: { anchor: { fileId, page: 3 } } })
    expect(cardAnchor({ anchor: { fileId, page: 3 } })).toEqual({ fileId, page: 3 })
    expect(cardAnchor({ doc: {} })).toBeNull()
  })

  it.each([
    ['a page before the first', { fileId, page: 0 }],
    ['a page that is not whole', { fileId, page: 1.5 }],
    ['a rectangle off the page', { fileId, page: 1, rects: [[0, 0, 1.2, 0.5]] }],
    ['a rectangle drawn backwards', { fileId, page: 1, rects: [[0.5, 0.5, 0.1, 0.6]] }],
    ['too many rectangles', { fileId, page: 1, rects: Array.from({ length: CARD_LIMITS.anchorRects + 1 }, () => [0, 0, 0.1, 0.1]) }],
    ['a quote that is too long', { fileId, page: 1, quote: 'x'.repeat(CARD_LIMITS.anchorQuote + 1) }],
    ['a file that is not an id', { fileId: 'https://example.com/a.pdf', page: 1 }],
  ])('refuses %s', (_, bad) => {
    expect(parseCardContent('quote', { ...(VALID.quote as object), anchor: bad })).toMatchObject({ ok: false })
    expect(cardAnchor({ anchor: bad })).toBeNull()
  })
})
