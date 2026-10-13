import { batches, batchText, CLEAN_UP_BATCH, CLEAN_UP_CHARS, isRepair } from '../../src/domain/clean-up'
import { blocksText, blocksToCards, pageSchema } from '../../src/application/page-vision'

/** PDF pages read again and converted notes cleaned up (ADR-0063): what the model's answers become, and what is refused. */
describe('a page read again', () => {
  it('turns each block into the card our types have for it, in reading order', () => {
    const blocks = pageSchema.parse({
      blocks: [
        { kind: 'heading', text: 'Chapter 3: Photosynthesis', level: 1 },
        { kind: 'paragraph', text: 'Green plants turn light into chemical energy.' },
        { kind: 'list', text: '', items: ['1. Carbon dioxide', '2. Water'], ordered: true },
        { kind: 'formula', text: '6CO_2 + 6H_2O \\rightarrow C_6H_{12}O_6 + 6O_2' },
        { kind: 'table', text: '', rows: [['Input', 'Source'], ['Water']] },
        { kind: 'code', text: 'print(1)', language: 'Python 3' },
        { kind: 'paragraph', text: '   ' },
      ],
    }).blocks
    const cards = blocksToCards(blocks)
    expect(cards.map((c) => c.type)).toEqual(['heading', 'text', 'markdown', 'markdown', 'table', 'code'])
    expect(cards[0]!.content).toMatchObject({ level: 1 })
    // A list keeps its own numbering out: the card numbers it.
    expect(cards[2]!.content).toEqual({ source: '1. Carbon dioxide\n2. Water' })
    expect(cards[3]!.content).toEqual({ source: '$$\n6CO_2 + 6H_2O \\rightarrow C_6H_{12}O_6 + 6O_2\n$$' })
    // A short row is filled out to the table's width.
    expect((cards[4]!.content as { rows: unknown[][] }).rows.map((r) => r.length)).toEqual([2, 2])
    expect(cards[5]!.content).toMatchObject({ language: 'python3' })
    expect(blocksText(blocks)).toContain('Carbon dioxide')
    expect(blocksText(blocks)).toContain('Source')
  })

  it('refuses an answer that is not blocks of our kinds', () => {
    expect(pageSchema.safeParse({ blocks: [{ kind: 'image', text: 'a cat' }] }).success).toBe(false)
  })
})

describe('clean-up', () => {
  it('takes repairs of what conversion broke', () => {
    expect(isRepair('The chloro- plast turns light into energy.', 'The chloroplast turns light into energy.')).toBe(true)
    expect(isRepair('Plants make glucose 12 Biology Class X from carbon dioxide and water.', 'Plants make glucose from carbon dioxide and water.')).toBe(true)
    expect(isRepair('Tbe leaf is green.', 'The leaf is green.')).toBe(true)
  })

  it('refuses rewrites, additions, cuts and changes that change nothing', () => {
    expect(isRepair('Plants make glucose from carbon dioxide and water.', 'Vegetation synthesises sugar using CO2 plus H2O.')).toBe(false)
    expect(isRepair('Plants make glucose.', 'Plants make glucose, a sugar they store as starch in their leaves.')).toBe(false)
    expect(isRepair('Plants make glucose from carbon dioxide and water in their leaves.', 'Plants make glucose.')).toBe(false)
    expect(isRepair('Plants make glucose.', '  Plants   make glucose. ')).toBe(false)
    expect(isRepair('Plants make glucose.', '')).toBe(false)
  })

  it('reads a note in batches of about 6,000 characters, up to its limit', () => {
    const card = (n: number, size: number) => ({ id: `c${n}`, text: 'x'.repeat(size) })
    const some = batches([card(1, 2_500), card(2, 2_500), card(3, 2_500)])
    expect(some.batches.map((b) => b.map((c) => c.id))).toEqual([['c1', 'c2'], ['c3']])
    expect(some.cut).toBe(false)
    const many = batches(Array.from({ length: 20 }, (_, i) => card(i, CLEAN_UP_BATCH / 2)))
    expect(many.batches.flat()).toHaveLength(CLEAN_UP_CHARS / (CLEAN_UP_BATCH / 2))
    expect(many.cut).toBe(true)
    expect(batchText([{ text: 'One' }, { text: 'Two' }])).toBe('[[1]]\nOne\n\n[[2]]\nTwo')
  })
})
