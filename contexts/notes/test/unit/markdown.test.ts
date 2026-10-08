import { cardToMarkdown, docToMarkdown } from '../../src/domain/markdown'

/** ADR-0018: exported notes read well as Markdown in any editor. */
const t = (text: string, marks?: { type: string; attrs?: object }[]) => ({ type: 'text', text, ...(marks ? { marks } : {}) })
const p = (...content: object[]) => ({ type: 'paragraph', content })
const none = () => null

describe('cards as Markdown', () => {
  it('writes rich text with marks, links and nested lists', () => {
    const doc = {
      type: 'doc',
      content: [
        p(t('Use '), t('BFS', [{ type: 'bold' }]), t(' or '), t('dfs()', [{ type: 'code' }]), t(' — see '), t('docs', [{ type: 'link', attrs: { href: 'https://x.test/a' } }])),
        { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('queue')), { type: 'orderedList', content: [{ type: 'listItem', content: [p(t('push'))] }] }] }] },
      ],
    }
    expect(docToMarkdown(doc as never)).toBe('Use **BFS** or `dfs()` — see [docs](https://x.test/a)\n\n- queue\n  1. push')
  })

  it('writes each card type', () => {
    expect(cardToMarkdown('heading', { level: 1, content: [t('Graphs')] }, none)).toBe('## Graphs')
    expect(cardToMarkdown('checklist', { items: [{ checked: true, content: [t('read')] }, { checked: false, content: [t('revise')] }] }, none)).toBe('- [x] read\n- [ ] revise')
    expect(cardToMarkdown('code', { language: 'python', code: 'print(1)' }, none)).toBe('```python\nprint(1)\n```')
    expect(cardToMarkdown('quote', { doc: { type: 'doc', content: [p(t('Simple'))] }, attribution: 'Dijkstra' }, none)).toBe('> Simple\n>\n> — Dijkstra')
    expect(cardToMarkdown('callout', { variant: 'tip', title: 'Remember', doc: { type: 'doc', content: [p(t('Use a queue'))] } }, none)).toBe('> [!TIP] Remember\n> Use a queue')
    expect(cardToMarkdown('table', { hasHeaderRow: true, rows: [[[t('n')], [t('ops | cost')]], [[t('8')], [t('3')]]] }, none)).toBe('| n | ops \\| cost |\n| --- | --- |\n| 8 | 3 |')
    expect(cardToMarkdown('quiz', { question: { type: 'doc', content: [p(t('BFS uses'))] }, choices: [{ id: 'a', content: [t('stack')] }, { id: 'b', content: [t('queue')] }], correct: ['b'], multiple: false }, none)).toBe('**Quiz:** BFS uses\n\n- [ ] stack\n- [x] queue')
    expect(cardToMarkdown('image', { fileId: 'f1', alt: 'A tree', caption: [t('Fig. 1')] }, () => ({ path: 'media/f1 tree.png', name: 'tree.png' }))).toBe('![A tree](media/f1%20tree.png)\n\n_Fig. 1_')
    expect(cardToMarkdown('video', { fileId: 'f2' }, none)).toBe('_(video not included in this export)_')
  })
})
