import { markdownToCards } from '../../src/domain/markdown-import'

/** ADR-0018: Markdown from other apps (Obsidian, Notion, Joplin, plain files) becomes cards. */
const words = (card: { content: unknown }) => JSON.stringify(card.content)

describe('Markdown into cards', () => {
  it('turns a typical note into a title, headings, text, code, a checklist and a table', () => {
    const md = [
      '# Graph traversal',
      'BFS visits **level by level** with a `queue`; see [the docs](https://x.test/bfs).',
      '- first',
      '  - nested',
      '1. one',
      '## Code',
      '```python\nfrom collections import deque\n```',
      '- [x] read',
      '- [ ] revise',
      '| n | ops |\n| --- | --- |\n| 8 | 3 |',
      '<script>alert(1)</script>',
    ].join('\n\n')
    const { title, cards, warnings } = markdownToCards(md)
    expect(title).toBe('Graph traversal')
    expect(warnings).toEqual([])
    expect(cards.map((c) => c.type)).toEqual(['text', 'heading', 'code', 'checklist', 'table'])
    expect(cards[0]!.content).toEqual({
      doc: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'BFS visits ' }, { type: 'text', text: 'level by level', marks: [{ type: 'bold' }] }, { type: 'text', text: ' with a ' }, { type: 'text', text: 'queue', marks: [{ type: 'code' }] }, { type: 'text', text: '; see ' }, { type: 'text', text: 'the docs', marks: [{ type: 'link', attrs: { href: 'https://x.test/bfs' } }] }, { type: 'text', text: '.' }] },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'first' }] }, { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nested' }] }] }] }] }] },
          { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] }] },
        ],
      },
    })
    expect(cards[1]!.content).toEqual({ level: 2, content: [{ type: 'text', text: 'Code' }] })
    expect(cards[2]!.content).toEqual({ language: 'python', code: 'from collections import deque' })
    expect(cards[3]!.content).toMatchObject({ items: [{ checked: true, content: [{ type: 'text', text: 'read' }] }, { checked: false, content: [{ type: 'text', text: 'revise' }] }] })
    expect(words(cards[4]!)).toContain('"ops"')
    expect(words(cards[0]!)).not.toContain('alert')
  })

  it('reads callouts, quotes, mermaid and unsafe links', () => {
    const { cards } = markdownToCards('> [!TIP] Remember\n> Use a queue\n\n> Simple is good\n\n```mermaid\ngraph TD; A-->B\n```\n\n[click](javascript:alert(1))')
    expect(cards.map((c) => c.type)).toEqual(['callout', 'quote', 'diagram', 'text'])
    expect(cards[0]!.content).toMatchObject({ variant: 'tip', title: 'Remember' })
    expect(words(cards[3]!)).not.toContain('javascript')
  })

  it('lifts images into their own cards, Obsidian embeds included', () => {
    const { cards, images } = markdownToCards('Before\n\n![A tree](pics/tree%20one.png)\n\n![[diagram.png]]\n\nSee [[Other note|the other note]].')
    expect(cards.map((c) => c.type)).toEqual(['text', 'image', 'image', 'text'])
    expect(images).toEqual([
      { index: 1, src: 'pics/tree one.png' },
      { index: 2, src: 'diagram.png' },
    ])
    expect(cards[1]!.content).toEqual({ fileId: '', alt: 'A tree' })
    expect(words(cards[3]!)).toContain('See the other note.')
  })
})
