import { parseCardContent } from '@lvn/contracts/validation'
import { contentHash, problemNote, topicNote, unflatten, type LegacyFlatNode, type LegacyNode } from '../../src/domain/legacy-content'

/**
 * The old site's content trees as cards (ADR-0098). The trees are written here as the old seeder stored them in
 * Firestore: flat, each node pointing at its parent.
 */

/** Flattens a tree the way the old seeder did (old repo schema/content.ts flatten). */
function flat(nodes: LegacyNode[]): LegacyFlatNode[] {
  const out: LegacyFlatNode[] = []
  const walk = (list: LegacyNode[], parent: number) => {
    for (const { children, ...rest } of list) {
      const index = out.push({ ...rest, parent }) - 1
      if (children?.length) walk(children, index)
    }
  }
  walk(nodes, -1)
  return out
}

const t = (value: string): LegacyNode => ({ type: 'text', value })
const el = (type: string, children: LegacyNode[] = [], extra: Partial<LegacyNode> = {}): LegacyNode => ({ type, children, ...extra })
const topic = (content: LegacyNode[]) => topicNote({ subjectId: 'dsa-basics', id: 'analysis', title: '  Analysis of Algorithms ', group: 'Foundations', order: 1, content: flat(content) })
const doc = (...paragraphs: unknown[]) => ({ doc: { type: 'doc', content: paragraphs } })
const p = (...content: unknown[]) => ({ type: 'paragraph', content })
const txt = (text: string, ...marks: string[]) => ({ type: 'text', text, ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}) })

describe('old content trees', () => {
  it('unflattens what the old seeder flattened', () => {
    const tree = [el('section', [el('heading', [t('A')], { level: 3 }), el('paragraph', [t('b')])])]
    expect(unflatten(flat(tree))).toEqual(tree)
  })
})

describe('a topic as a note', () => {
  it('turns sections into heading cards and their prose into one text card, as the page read', () => {
    const note = topic([
      el('paragraph', [t('Why '), el('strong', [t('analyse')]), t('   algorithms?\n  ')], { variant: 'lead' }),
      el('section', [
        el('heading', [el('icon', [], { value: 'ti-bolt' }), t(' Big-O ')], { level: 3 }),
        el('paragraph', [t('An '), el('em', [t('upper')]), t(' bound: '), el('code', [t('O(n)')]), el('br'), t('read '), el('link', [t('more')], { href: 'https://example.com/big-o' })]),
        el('list', [el('listItem', [t('constants drop')]), el('listItem', [t('lower terms drop')])], { ordered: true }),
        el('heading', [t('Loops')], { level: 4 }),
      ]),
    ])
    expect(note.title).toBe('Analysis of Algorithms')
    expect(note.cards).toEqual([
      { type: 'text', content: doc(p(txt('Why '), txt('analyse', 'bold'), txt(' algorithms?'))) },
      { type: 'heading', content: { level: 1, content: [txt('Big-O')] } },
      {
        type: 'text',
        content: doc(
          p(txt('An '), txt('upper', 'italic'), txt(' bound: '), txt('O(n)', 'code'), { type: 'hardBreak' }, txt('read '), { type: 'text', text: 'more', marks: [{ type: 'link', attrs: { href: 'https://example.com/big-o' } }] }),
          { type: 'orderedList', content: [{ type: 'listItem', content: [p(txt('constants drop'))] }, { type: 'listItem', content: [p(txt('lower terms drop'))] }] },
        ),
      },
      { type: 'heading', content: { level: 2, content: [txt('Loops')] } },
    ])
  })

  it('keeps code as code cards, one per tab of tabbed code, in the editors’ language names', () => {
    const note = topic([
      el('codeBlock', [], { lang: 'py', value: 'print(1)\n\n', label: 'hello.py' }),
      el('tabs', [el('tabPanel', [el('codeBlock', [], { lang: 'cpp', value: 'int main() {}' })], { label: 'C++' }), el('tabPanel', [el('codeBlock', [], { lang: 'js', value: 'f()' })], { label: 'JavaScript' })]),
      el('codeBlock', [], { lang: 'text', value: '   ' }),
    ])
    expect(note.cards).toEqual([
      { type: 'code', content: { language: 'python', code: 'print(1)', filename: 'hello.py' } },
      { type: 'code', content: { language: 'cpp', code: 'int main() {}', filename: 'C++' } },
      { type: 'code', content: { language: 'javascript', code: 'f()', filename: 'JavaScript' } },
    ])
  })

  it('makes callouts and boxed cards callout cards, with code inside them as monospaced lines', () => {
    const note = topic([
      el('callout', [el('calloutLabel', [el('icon'), t('Pitfall')]), el('paragraph', [t('Big-O is not the worst case.')]), el('codeBlock', [], { lang: 'py', value: 'a = 1\nb = 2' })], { variant: 'warn' }),
      el('grid', [el('card', [el('heading', [t('Direct (1:1)')], { level: 4 }), el('paragraph', [t('One queue.')])])], { cols: 2 }),
      el('callout', [t('Loose '), el('strong', [t('text')])], { variant: 'def' }),
    ])
    expect(note.cards).toEqual([
      { type: 'callout', content: { variant: 'warning', title: 'Pitfall', ...doc(p(txt('Big-O is not the worst case.')), p(txt('a = 1', 'code'), { type: 'hardBreak' }, txt('b = 2', 'code'))) } },
      { type: 'callout', content: { variant: 'note', title: 'Direct (1:1)', ...doc(p(txt('One queue.'))) } },
      { type: 'callout', content: { variant: 'info', ...doc(p(txt('Loose '), txt('text', 'bold'))) } },
    ])
  })

  it('makes tables table cards, filling cells that spanned columns', () => {
    const cell = (s: string, extra: Partial<LegacyNode> = {}) => el('tableCell', [t(s)], extra)
    const note = topic([
      el('table', [
        el('tableHead', [el('tableRow', [cell('Case', { header: true }), cell('Time', { header: true }), cell('Space', { header: true })])]),
        el('tableBody', [el('tableRow', [cell('Best'), cell('O(1)', { colspan: 2 })]), el('tableRow', [cell('Worst'), el('tableCell', [el('code', [t('O(n)')])]), cell('O(1)')])]),
      ]),
    ])
    expect(note.cards).toEqual([
      {
        type: 'table',
        content: {
          hasHeaderRow: true,
          rows: [
            [[txt('Case')], [txt('Time')], [txt('Space')]],
            [[txt('Best')], [txt('O(1)')], []],
            [[txt('Worst')], [txt('O(n)', 'code')], [txt('O(1)')]],
          ],
        },
      },
    ])
  })

  it('makes interview Q&A question cards whose answer the reader reveals', () => {
    const note = topic([el('qa', [el('qaQuestion', [t('Is Big-O the worst case?')]), el('group', [el('paragraph', [t('No: it is an upper bound.')])])])])
    expect(note.cards).toEqual([{ type: 'question', content: { prompt: doc(p(txt('Is Big-O the worst case?'))).doc, answer: doc(p(txt('No: it is an upper bound.'))).doc } }])
  })

  it('reads steps, chips, flows, formulas, key–value rows, bit diagrams and schedules as text', () => {
    const note = topic([
      el('step', [el('stepNum', [t('1')]), el('stepBody', [el('stepTitle', [t('Guess')]), el('stepDesc', [t('a bound')])])]),
      el('step', [el('stepNum', [t('2')]), el('stepBody', [el('stepTitle', [t('Prove')]), el('stepDesc', [t('it')])])]),
      el('chips', [el('chip', [t('RabbitMQ')]), el('chip', [t('Kafka')])]),
      el('flow', [el('flowNode', [t('Client')]), el('flowArrow', []), el('flowNode', [t('Server')])]),
      el('formula', [t('T(n) = 2T(n/2) + n')]),
      el('kv', [el('kvKey', [t('DAU')]), el('kvValue', [t('90M')])]),
      el('bits', [el('bit', [t('1')]), el('bit', [t('0')])]),
      el('gantt', [el('ganttBlock', [t('P1')]), el('ganttBlock', [t('P2')]), el('ganttScale', [el('span', [t('0')]), el('span', [t('4')])])]),
    ])
    expect(note.cards).toEqual([
      {
        type: 'text',
        content: doc(
          { type: 'orderedList', content: [{ type: 'listItem', content: [p(txt('Guess', 'bold')), p(txt('a bound'))] }, { type: 'listItem', content: [p(txt('Prove', 'bold')), p(txt('it'))] }] },
          p(txt('RabbitMQ · Kafka')),
          p(txt('Client → Server')),
          p(txt('T(n) = 2T(n/2) + n', 'code')),
          p(txt('DAU', 'bold'), txt(': 90M')),
          p(txt('1 0', 'code')),
          p(txt('P1 | P2', 'code')),
          p(txt('0 4', 'code')),
        ),
      },
    ])
  })

  it('leaves out what a note cannot show, and says so: an inline SVG diagram, unsafe links, icons', () => {
    const note = topic([el('svg', [], { value: '<circle r="4"/>' }), el('paragraph', [el('icon'), el('link', [t('run')], { href: 'javascript:alert(1)' })])])
    expect(note.cards).toEqual([{ type: 'text', content: doc(p(txt('run'))) }])
    expect(note.leftOut).toEqual({ svg: 1 })
  })

  it('keeps lists at most five deep and long prose in cards of a comfortable size', () => {
    let deep: LegacyNode = el('listItem', [t('6')])
    for (let i = 5; i >= 1; i--) deep = el('listItem', [t(String(i)), el('list', [deep])])
    const long = Array.from({ length: 300 }, (_, i) => el('paragraph', [t(`Paragraph ${i}`)]))
    const note = topic([el('list', [deep]), ...long])
    expect(note.cards.length).toBeGreaterThan(2)
    for (const c of note.cards) expect(parseCardContent(c.type, c.content)).toMatchObject({ ok: true })
  })
})

describe('a Sheet 150 problem as a note', () => {
  const content = (s: string) => flat([el('paragraph', [t(s)])])
  const problem = {
    id: 'lc-1',
    lc: 1,
    title: 'Two Sum',
    difficulty: 'Easy',
    category: 'arrays-hashing',
    leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
    youtubeUrl: '',
    statement: content('Return indices of the two numbers that add up to target.'),
    constraints: content('2 ≤ n ≤ 10^4'),
    approach: content('Store each number in a map.'),
    naive: { title: 'Naive Solution — O(n²)', content: [], code: { py: 'def f(): pass', cpp: '', java: 'class S {}' }, complexity: ['Time: O(n²)', 'Space: O(1)'] },
    takeaway: content('Complement lookups.'),
  }

  it('has its difficulty and link, its parts in the old page’s order, and a code card per language', () => {
    const note = problemNote(problem)
    expect(note.title).toBe('Two Sum')
    const outline = note.cards.map((c) => (c.type === 'heading' ? `# ${(c.content as { content: { text: string }[] }).content[0]!.text}` : c.type === 'code' ? `code ${(c.content as { filename: string }).filename}` : c.type))
    expect(outline).toEqual(['text', '# Problem', 'text', '# Constraints', 'text', '# Approach', 'text', '# Naive Solution — O(n²)', 'code Python', 'code Java', 'text', '# Takeaway', 'text'])
    expect(note.cards[0]).toEqual({
      type: 'text',
      content: doc(p(txt('Difficulty: '), txt('Easy', 'bold'), txt(' · '), { type: 'text', text: 'LeetCode 1', marks: [{ type: 'link', attrs: { href: 'https://leetcode.com/problems/two-sum/' } }] })),
    })
    expect(note.cards[10]).toEqual({ type: 'text', content: doc(p(txt('Time: O(n²) · Space: O(1)', 'bold'))) })
    for (const c of note.cards) expect(parseCardContent(c.type, c.content)).toMatchObject({ ok: true })
  })

  it('fingerprints what would be written: the same source gives the same hash, and the topic counts', () => {
    const a = problemNote(problem)
    expect(contentHash(a, ['t1'])).toBe(contentHash(problemNote(structuredClone(problem)), ['t1']))
    expect(contentHash(a, ['t1'])).not.toBe(contentHash(a, ['t2']))
    expect(contentHash(a, ['t1'])).not.toBe(contentHash(problemNote({ ...problem, takeaway: content('Something else.') }), ['t1']))
  })
})
