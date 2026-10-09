import { readFileSync } from 'node:fs'
import path from 'node:path'
import { doclingToCards, headingLevel, pageRect, type DoclingDocument } from '../../src/domain/docling-cards'

/** ADR-0028 stage 5: what workers/pdf-engine read from a PDF becomes cards with their page and boxes. */
const fixture = (name: string) => JSON.parse(readFileSync(path.join(__dirname, '../fixtures', `${name}.docling.json`), 'utf8')) as DoclingDocument
const FILE = '01920000-0000-7000-8000-00000000f0a1'
const PICTURE = '01920000-0000-7000-8000-00000000f0a2'
type Any = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const text = (c: { content: unknown }) => JSON.stringify(c.content)

describe('Docling documents as cards', () => {
  it('turns a digital chapter into headings, text with its list, a table and a captioned picture, each with its page', () => {
    const { cards, warnings } = doclingToCards(fixture('chapter'), { fileId: FILE, picture: (ref) => (ref === '#/pictures/0' ? PICTURE : null), maxCards: 1000 })
    expect(warnings).toEqual([])
    expect(cards.map((c) => c.type)).toEqual(['heading', 'text', 'heading', 'text', 'heading', 'table', 'image', 'text'])
    const [title, intro, h31, needs, h32, table, picture, last] = cards as { type: string; content: Any }[]
    expect(title!.content).toMatchObject({ level: 1, content: [{ type: 'text', text: 'Chapter 3: Photosynthesis' }] })
    expect(h31!.content.level).toBe(2)
    expect(h32!.content.level).toBe(2)
    expect(text(intro!)).toContain('green plants turn light energy into chemical energy')
    // The list joins the paragraph after it, in one card.
    expect(needs!.content.doc.content.map((b: Any) => b.type)).toEqual(['bulletList', 'paragraph'])
    expect(needs!.content.doc.content[0].content).toHaveLength(3)
    expect(table!.content).toMatchObject({ hasHeaderRow: true })
    expect(table!.content.rows[0].map((cell: Any) => cell[0]?.text)).toEqual(['Stage', 'Where', 'Product'])
    expect(table!.content.rows[2][2][0].text).toBe('Glucose')
    // The figure's caption (which Docling reported as a header) and none of the words inside the figure.
    expect(picture!.content).toMatchObject({ fileId: PICTURE, caption: [{ text: 'Figure 3.1: Light energy becomes chemical energy in the chloroplast.' }] })
    expect(cards.some((c) => text(c).includes('"Chloroplast"'))).toBe(false)
    expect(text(last!)).toContain('light intensity')
    // Every card knows its page and where on it, from the top left.
    for (const card of cards) expect((card.content as Any).anchor).toMatchObject({ fileId: FILE, page: 1 })
    const [x0, y0, x1, y1] = title!.content.anchor.rects[0]
    expect(x0).toBeCloseTo(0.07, 2)
    expect(y0).toBeCloseTo(0.055, 2)
    expect(x1).toBeGreaterThan(x0)
    expect(y1).toBeGreaterThan(y0)
  })

  it('reads a scanned page that went through OCR', () => {
    const { cards } = doclingToCards(fixture('scanned'), { fileId: FILE, picture: () => null, maxCards: 1000 })
    expect(cards.map((c) => c.type)).toEqual(['heading', 'text'])
    expect(text(cards[1]!)).toContain('Respiration releases the energy stored in glucose')
  })

  it('keeps to the card limit and says so', () => {
    const { cards, warnings } = doclingToCards(fixture('chapter'), { fileId: FILE, picture: () => PICTURE, maxCards: 3 })
    expect(cards).toHaveLength(3)
    expect(warnings).toContain('Only the first 3 cards were kept')
  })

  it('leaves out pictures it could not store', () => {
    const { cards, warnings } = doclingToCards(fixture('chapter'), { fileId: FILE, picture: () => null, maxCards: 1000 })
    expect(cards.some((c) => c.type === 'image')).toBe(false)
    expect(warnings).toEqual(['A picture on page 1 could not be kept'])
  })

  it('takes heading levels from their numbering', () => {
    expect(headingLevel('Chapter 7 Waves', false)).toBe(1)
    expect(headingLevel('2 Kinematics', false)).toBe(1)
    expect(headingLevel('2.3 Velocity', false)).toBe(2)
    expect(headingLevel('2.3.1 Average velocity', false)).toBe(3)
    expect(headingLevel('Summary', false)).toBe(2)
    expect(headingLevel('Anything', true)).toBe(1)
  })

  it('places boxes from either corner', () => {
    expect(pageRect({ l: 60, t: 800, r: 300, b: 780, coord_origin: 'BOTTOMLEFT' }, { width: 600, height: 1000 })).toEqual([0.1, 0.2, 0.5, 0.22])
    expect(pageRect({ l: 60, t: 200, r: 300, b: 220, coord_origin: 'TOPLEFT' }, { width: 600, height: 1000 })).toEqual([0.1, 0.2, 0.5, 0.22])
  })
})
