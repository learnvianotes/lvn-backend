import { createHash } from 'node:crypto'
import type { CardType } from '@lvn/contracts/domain'
import { CARD_LIMITS, NOTE_LIMITS, parseCardContent, RICH_TEXT_LIMITS, safeHref } from '@lvn/contracts/validation'
import type { ImportedCard } from './markdown-import'

/**
 * The old learnvianotes.in study content (ADR-0098) as cards. The old site stored every topic, and every rich field of a
 * Sheet 150 problem, as a tree of typed nodes (old repo schema/content.ts), flattened for Firestore. Here each tree
 * becomes the cards a note is made of:
 *
 * - section headings become heading cards; paragraphs, lists, steps, chips, flows, formulas and key–value rows become
 *   text cards;
 * - code blocks (and tabbed code, one card per language) become code cards, callouts and boxed cards callout cards,
 *   tables table cards, and interview Q&A question cards;
 * - inside a callout, question or table, where cards only hold text, code becomes monospaced lines and tables rows;
 * - icons are dropped and the one inline SVG diagram is left out (counted, never silently).
 *
 * Pure: it only converts. Study-content sync stores the pages; this does not read Firestore. Every card it returns
 * passes the card schema the editors use.
 */

/** A node of the old content tree (old repo schema/content.ts ContentNode). */
export interface LegacyNode {
  type: string
  children?: LegacyNode[]
  value?: string
  level?: number
  variant?: string
  ordered?: boolean
  lang?: string
  label?: string
  href?: string
  header?: boolean
  colspan?: number
  cols?: number
  inline?: boolean
}

/** How Firestore holds a tree: nodes in document order, each pointing at its parent's index (−1 at the top). */
export type LegacyFlatNode = Omit<LegacyNode, 'children'> & { parent: number }

/** A topic document (`subjects/{subjectId}/topics/{topicId}`). */
export interface LegacyTopic {
  subjectId: string
  id: string
  title: string
  group: string
  order: number
  content: LegacyFlatNode[]
}

export interface LegacySolution {
  title: string
  content: LegacyFlatNode[]
  code?: Partial<Record<string, string>>
  complexity?: string[]
}

/** A Sheet 150 problem document (`subjects/{subjectId}/problems/{problemId}`). */
export interface LegacyProblem {
  id: string
  lc?: number
  title: string
  difficulty?: string
  category: string
  leetcodeUrl?: string
  youtubeUrl?: string
  order?: number
  statement?: LegacyFlatNode[]
  io?: LegacyFlatNode[]
  constraints?: LegacyFlatNode[]
  understanding?: LegacyFlatNode[]
  intuition?: LegacyFlatNode[]
  approach?: LegacyFlatNode[]
  variants?: LegacyFlatNode[]
  takeaway?: LegacyFlatNode[]
  naive?: LegacySolution
  optimal?: LegacySolution
  extra?: { title: string; content: LegacyFlatNode[] }[]
}

/** What converting left out, by node type (e.g. `svg`), so the report can say so. */
export type LeftOut = Record<string, number>

export interface ConvertedNote {
  title: string
  cards: ImportedCard[]
  leftOut: LeftOut
}

export function unflatten(flat: readonly LegacyFlatNode[]): LegacyNode[] {
  const nodes: LegacyNode[] = flat.map(({ parent: _parent, ...rest }) => ({ ...rest }))
  const roots: LegacyNode[] = []
  flat.forEach((f, i) => {
    if (f.parent < 0 || !nodes[f.parent]) roots.push(nodes[i]!)
    else (nodes[f.parent]!.children ??= []).push(nodes[i]!)
  })
  return roots
}

// ── Inline ──────────────────────────────────────────────────────────────────────────────────────────────────────

type Mark = { type: string; attrs?: { href: string } }
type InlineNode = { type: 'text'; text: string; marks?: Mark[] } | { type: 'hardBreak' }
type ListBlock = { type: 'bulletList' | 'orderedList'; content: { type: 'listItem'; content: Block[] }[] }
type Block = { type: 'paragraph'; content?: InlineNode[] } | ListBlock

const MARKS: Record<string, string> = { strong: 'bold', em: 'italic', i: 'italic', u: 'underline', code: 'code', sup: 'superscript', sub: 'subscript' }
const INLINE = new Set(['text', 'br', 'icon', 'link', 'span', 'small', ...Object.keys(MARKS)])

const isInline = (n: LegacyNode) => INLINE.has(n.type) || n.inline === true

function textNodes(text: string, marks: Mark[]): InlineNode[] {
  const out: InlineNode[] = []
  for (let i = 0; i < text.length; i += RICH_TEXT_LIMITS.textNode) {
    out.push({ type: 'text', text: text.slice(i, i + RICH_TEXT_LIMITS.textNode), ...(marks.length ? { marks } : {}) })
  }
  return out
}

function withMark(marks: Mark[], mark: Mark): Mark[] {
  return marks.some((m) => m.type === mark.type) ? marks : [...marks, mark]
}

/** Inline content as the old site showed it: HTML collapses runs of white space, so this does too. */
function inlineOf(nodes: readonly LegacyNode[] | undefined, marks: Mark[] = []): InlineNode[] {
  const out: InlineNode[] = []
  for (const n of nodes ?? []) {
    switch (n.type) {
      case 'text':
        if (n.value) out.push(...textNodes(n.value.replace(/\s+/g, ' '), marks))
        break
      case 'br':
        out.push({ type: 'hardBreak' })
        break
      case 'icon':
        break
      case 'link': {
        const href = n.href && safeHref.safeParse(n.href).success ? n.href : null
        out.push(...inlineOf(n.children, href ? withMark(marks, { type: 'link', attrs: { href } }) : marks))
        break
      }
      default: {
        const mark = MARKS[n.type]
        out.push(...inlineOf(n.children, mark ? withMark(marks, { type: mark }) : marks))
        if (n.value && !n.children?.length) out.push(...textNodes(n.value.replace(/\s+/g, ' '), marks))
      }
    }
  }
  return tidy(out)
}

/** Joins neighbouring text with the same marks, and trims the white space HTML would not show at either end. */
function tidy(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = []
  for (const n of nodes) {
    const last = out[out.length - 1]
    if (n.type === 'text' && last?.type === 'text' && JSON.stringify(last.marks ?? []) === JSON.stringify(n.marks ?? []) && last.text.length + n.text.length <= RICH_TEXT_LIMITS.textNode) {
      out[out.length - 1] = { ...last, text: (last.text + n.text).replace(/ {2,}/g, ' ') }
    } else out.push(n)
  }
  const first = out[0]
  if (first?.type === 'text') out[0] = { ...first, text: first.text.replace(/^\s+/, '') }
  const end = out[out.length - 1]
  if (end?.type === 'text') out[out.length - 1] = { ...end, text: end.text.replace(/\s+$/, '') }
  // A space after a line break is not shown either.
  return out.filter((n) => n.type !== 'text' || n.text.length > 0)
}

const hasText = (inline: readonly InlineNode[]) => inline.some((n) => n.type === 'text' && n.text.trim())
const plain = (inline: readonly InlineNode[]) => inline.map((n) => (n.type === 'text' ? n.text : ' ')).join('').replace(/\s+/g, ' ').trim()
const textOf = (n: LegacyNode): string => plain(inlineOf([n]))
const bold = (inline: InlineNode[]): InlineNode[] => inline.map((n) => (n.type === 'text' ? { ...n, marks: withMark(n.marks ?? [], { type: 'bold' }) } : n))
const text = (t: string, marks: Mark[] = []): InlineNode[] => (t ? textNodes(t, marks) : [])

/** Code as monospaced lines, for places that hold only text (a callout, a question's answer, a table cell). */
function codeLines(code: string): InlineNode[] {
  const out: InlineNode[] = []
  code.replace(/\s+$/, '').split('\n').forEach((line, i) => {
    if (i) out.push({ type: 'hardBreak' })
    if (line) out.push(...textNodes(line, [{ type: 'code' }]))
  })
  return out
}

// ── Blocks ──────────────────────────────────────────────────────────────────────────────────────────────────────

const LANGUAGES: Record<string, string> = { py: 'python', js: 'javascript', ts: 'typescript', sh: 'bash', shell: 'bash', 'c++': 'cpp', text: 'text', txt: 'text' }
const language = (lang: string | undefined) => {
  const l = (lang ?? '').toLowerCase()
  return (LANGUAGES[l] ?? l).replace(/[^a-z0-9+#.-]/g, '').slice(0, CARD_LIMITS.codeLanguage)
}
const CALLOUT_VARIANTS: Record<string, 'note' | 'info' | 'tip' | 'warning' | 'danger'> = { def: 'info', example: 'tip', note: 'note', warn: 'warning', good: 'tip', bad: 'danger', plain: 'note' }
/** The old pages' section headings were h3, sub-headings h4 and h5; a note's headings are levels 1 to 3. */
const headingLevel = (level: number | undefined): 1 | 2 | 3 => (level === 4 ? 2 : level && level >= 5 ? 3 : 1)

/** Text cards stay well under the card size limit and the editor's comfortable length. */
const TEXT_CARD = { blocks: 120, bytes: 120_000 }

class Cards {
  readonly cards: ImportedCard[] = []
  readonly leftOut: LeftOut = {}
  private blocks: Block[] = []
  private steps: ListBlock | null = null

  /** `textOnly`: everything becomes paragraphs and lists (inside a callout, a question's answer, a boxed card). */
  constructor(private readonly textOnly = false) {}

  skip(type: string) {
    this.leftOut[type] = (this.leftOut[type] ?? 0) + 1
  }

  paragraph(inline: InlineNode[]) {
    if (hasText(inline)) this.blocks.push({ type: 'paragraph', content: inline })
  }

  block(b: Block) {
    this.blocks.push(b)
  }

  /** A step of a numbered procedure: consecutive steps make one numbered list. */
  step(item: Block[]) {
    if (!item.length) return
    if (!this.steps || this.blocks[this.blocks.length - 1] !== this.steps) {
      this.steps = { type: 'orderedList', content: [] }
      this.blocks.push(this.steps)
    }
    this.steps.content.push({ type: 'listItem', content: item })
  }

  card(type: CardType, content: unknown) {
    if (this.textOnly) {
      for (const b of asBlocks(type, content)) this.blocks.push(b)
      return
    }
    this.flush()
    this.cards.push({ type, content })
  }

  heading(level: 1 | 2 | 3, inline: InlineNode[]) {
    if (hasText(inline)) this.card('heading' as CardType, { level, content: inline.filter((n) => n.type === 'text') })
  }

  /** The paragraphs and lists collected so far, as one text card or more. */
  flush() {
    let chunk: Block[] = []
    let bytes = 0
    const emit = () => {
      if (chunk.length) this.cards.push({ type: 'text' as CardType, content: { doc: { type: 'doc', content: chunk } } })
      chunk = []
      bytes = 0
    }
    for (const b of this.blocks) {
      const size = JSON.stringify(b).length
      if (chunk.length >= TEXT_CARD.blocks || (chunk.length && bytes + size > TEXT_CARD.bytes)) emit()
      chunk.push(b)
      bytes += size
    }
    emit()
    this.blocks = []
    this.steps = null
  }

  /** For a text-only builder: the blocks it collected. */
  takeBlocks(): Block[] {
    const blocks = this.blocks
    this.blocks = []
    return blocks
  }
}

/** What a card says, as paragraphs and lists, for places that hold only text. */
function asBlocks(type: CardType, content: unknown): Block[] {
  const c = content as Record<string, unknown>
  switch (type) {
    case 'heading':
      return [{ type: 'paragraph', content: bold(c.content as InlineNode[]) }]
    case 'code':
      return [{ type: 'paragraph', content: codeLines(c.code as string) }]
    case 'callout': {
      const title = c.title ? [{ type: 'paragraph' as const, content: text(c.title as string, [{ type: 'bold' }]) }] : []
      return [...title, ...((c.doc as { content: Block[] }).content ?? [])]
    }
    case 'table':
      return (c.rows as InlineNode[][][]).map((row, i) => ({
        type: 'paragraph' as const,
        content: tidy(row.flatMap((cell, j) => [...(j ? text(' | ') : []), ...(i === 0 && c.hasHeaderRow ? bold(cell) : cell)])),
      }))
    case 'question':
      return [...(c.prompt as { content: Block[] }).content.map((b) => (b.type === 'paragraph' ? { ...b, content: bold(b.content ?? []) } : b)), ...(c.answer as { content: Block[] }).content]
    case 'text':
      return (c.doc as { content: Block[] }).content
    default:
      return []
  }
}

/** Children that mix inline nodes with blocks (a group with loose text): runs of inline nodes become paragraphs. */
function mixed(nodes: readonly LegacyNode[] | undefined, out: Cards, depth: number) {
  let run: LegacyNode[] = []
  const end = () => {
    if (run.length) out.paragraph(inlineOf(run))
    run = []
  }
  for (const n of nodes ?? []) {
    if (isInline(n)) run.push(n)
    else {
      end()
      block(n, out, depth)
    }
  }
  end()
}

/** Paragraphs and lists only, from any content (inside callouts, questions and boxed cards). */
function blocksOf(nodes: readonly LegacyNode[] | undefined, depth: number, leftOut: LeftOut): Block[] {
  const inner = new Cards(true)
  mixed(nodes, inner, depth)
  for (const [k, v] of Object.entries(inner.leftOut)) leftOut[k] = (leftOut[k] ?? 0) + v
  return inner.takeBlocks()
}

function list(node: LegacyNode, depth: number, leftOut: LeftOut): Block[] {
  const items = (node.children ?? []).filter((c) => c.type === 'listItem').map((item) => blocksOf(item.children, depth + 1, leftOut)).filter((b) => b.length)
  if (!items.length) return []
  // Lists nest at most five deep in a note: deeper ones are kept as their paragraphs.
  if (depth >= 5) return items.flat()
  return [{ type: node.ordered ? 'orderedList' : 'bulletList', content: items.map((content) => ({ type: 'listItem' as const, content })) }]
}

function block(node: LegacyNode, out: Cards, depth = 0) {
  const kids = node.children ?? []
  switch (node.type) {
    case 'section':
    case 'group':
    case 'stepBody':
    case 'footer':
      return mixed(kids, out, depth)
    case 'heading':
      return out.heading(headingLevel(node.level), inlineOf(kids))
    case 'paragraph':
    case 'chip':
    case 'kvKey':
    case 'kvValue':
    case 'qaQuestion':
    case 'calloutLabel':
    case 'stepTitle':
    case 'stepDesc':
      return out.paragraph(inlineOf(kids))
    case 'list':
      for (const b of list(node, depth, out.leftOut)) out.block(b)
      return
    case 'codeBlock':
      if (!(node.value ?? '').trim()) return
      return out.card('code' as CardType, { language: language(node.lang), code: node.value!.replace(/\s+$/, '').slice(0, CARD_LIMITS.sourceChars), ...(node.label ? { filename: node.label.slice(0, 200) } : {}) })
    case 'callout': {
      const label = kids.find((k) => k.type === 'calloutLabel')
      const title = label ? textOf(label).slice(0, 200) : ''
      const doc = { type: 'doc', content: blocksOf(kids.filter((k) => k !== label), depth, out.leftOut) }
      return out.card('callout' as CardType, { variant: CALLOUT_VARIANTS[node.variant ?? ''] ?? 'note', ...(title ? { title } : {}), doc })
    }
    case 'card': {
      // A boxed card of a grid: its heading is the box's title.
      const head = kids.find((k) => k.type === 'heading')
      const title = head ? textOf(head).slice(0, 200) : ''
      const doc = { type: 'doc', content: blocksOf(kids.filter((k) => k !== head), depth, out.leftOut) }
      if (!title && !doc.content.length) return
      return out.card('callout' as CardType, { variant: CALLOUT_VARIANTS[node.variant ?? ''] ?? 'note', ...(title ? { title } : {}), doc })
    }
    case 'grid':
      for (const k of kids) block(k, out, depth)
      return
    case 'table':
      return table(node, out)
    case 'qa': {
      const q = kids.find((k) => k.type === 'qaQuestion')
      const prompt = q ? inlineOf(q.children) : []
      const answer = blocksOf(kids.filter((k) => k !== q), depth, out.leftOut)
      if (!hasText(prompt)) return mixed(kids, out, depth)
      return out.card('question' as CardType, { prompt: { type: 'doc', content: [{ type: 'paragraph', content: prompt }] }, answer: { type: 'doc', content: answer } })
    }
    case 'tabs':
      for (const panel of kids) {
        const code = panel.children?.length === 1 && panel.children[0]!.type === 'codeBlock' ? panel.children[0]! : null
        // Tabbed code (one tab per language): a code card each, named after its tab.
        if (code) block({ ...code, label: code.label || panel.label }, out, depth)
        else {
          if (panel.label) out.heading(3, text(panel.label))
          mixed(panel.children, out, depth)
        }
      }
      return
    case 'step': {
      const title = kids.find((k) => k.type === 'stepTitle') ?? kids.find((k) => k.type === 'stepBody')?.children?.find((k) => k.type === 'stepTitle')
      const body = kids.find((k) => k.type === 'stepBody')
      const rest = (body ? (body.children ?? []) : kids.filter((k) => k.type !== 'stepNum')).filter((k) => k !== title)
      const item: Block[] = []
      if (title && hasText(inlineOf(title.children))) item.push({ type: 'paragraph', content: bold(inlineOf(title.children)) })
      item.push(...blocksOf(rest, depth + 1, out.leftOut))
      return out.step(item)
    }
    case 'chips': {
      const chips = kids.map((k) => inlineOf(k.children ?? [k])).filter(hasText)
      return out.paragraph(tidy(chips.flatMap((c, i) => [...(i ? text(' · ') : []), ...c])))
    }
    case 'flow': {
      // A box-and-arrow diagram, read left to right: "Client → Load balancer → Server".
      const parts = kids.map((k) => (k.type === 'flowArrow' ? text(` ${textOf(k) || '→'} `) : inlineOf(k.children)))
      return out.paragraph(tidy(parts.flat()))
    }
    case 'formula':
      return out.paragraph(inlineOf(kids, [{ type: 'code' }]))
    case 'kv': {
      let key: InlineNode[] = []
      for (const k of kids) {
        if (k.type === 'kvKey') key = bold(inlineOf(k.children))
        else if (k.type === 'kvValue') {
          out.paragraph(tidy([...key, ...(key.length ? text(': ') : []), ...inlineOf(k.children)]))
          key = []
        }
      }
      return
    }
    case 'bits':
      return out.paragraph(text(kids.map(textOf).filter(Boolean).join(' '), [{ type: 'code' }]))
    case 'gantt':
      // A schedule: its blocks in order, then (ganttScale) the times between them.
      out.paragraph(text(kids.filter((k) => k.type === 'ganttBlock').map(textOf).filter(Boolean).join(' | '), [{ type: 'code' }]))
      for (const k of kids) if (k.type === 'ganttScale') block(k, out, depth)
      return
    case 'ganttScale':
      return out.paragraph(text(kids.map(textOf).filter(Boolean).join(' '), [{ type: 'code' }]))
    case 'svg':
      return out.skip('svg')
    default:
      if (isInline(node)) return out.paragraph(inlineOf([node]))
      return mixed(kids, out, depth)
  }
}

function table(node: LegacyNode, out: Cards) {
  const rows: { cells: InlineNode[][]; head: boolean }[] = []
  const collect = (n: LegacyNode, head: boolean) => {
    for (const k of n.children ?? []) {
      if (k.type === 'tableRow') {
        const cells: InlineNode[][] = []
        for (const cell of k.children ?? []) {
          // Cells hold text; a cell spanning columns is followed by empty ones so every row has the same length.
          const blocks = (cell.children ?? []).some((c) => !isInline(c)) ? blocksOf(cell.children, 0, out.leftOut) : null
          cells.push(blocks ? tidy(blocks.flatMap((b, i) => [...(i ? [{ type: 'hardBreak' } as InlineNode] : []), ...(b.type === 'paragraph' ? (b.content ?? []) : text(plainBlocks([b])))])) : inlineOf(cell.children))
          for (let s = 1; s < (cell.colspan ?? 1); s++) cells.push([])
        }
        if (cells.length) rows.push({ cells: cells.map((c) => c.filter((n) => n.type === 'text' || n.type === 'hardBreak')), head: head || k.children?.every((c) => c.header) === true })
      } else collect(k, head || k.type === 'tableHead')
    }
  }
  collect(node, false)
  if (!rows.length) return
  const width = Math.max(...rows.map((r) => r.cells.length))
  const hasHeaderRow = rows[0]!.head
  const content = { hasHeaderRow, rows: rows.map((r) => [...r.cells, ...Array.from({ length: width - r.cells.length }, () => [])]) }
  if (width > CARD_LIMITS.tableColumns || rows.length > CARD_LIMITS.tableRows) {
    for (const b of asBlocks('table' as CardType, content)) out.block(b)
    return
  }
  out.card('table' as CardType, content)
}

function plainBlocks(blocks: Block[]): string {
  return blocks.map((b) => (b.type === 'paragraph' ? plain(b.content ?? []) : b.content.map((i) => plainBlocks(i.content)).join('; '))).join(' ')
}

// ── Notes ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Every card passes the editors' schema: one that does not (an empty question, an over-long table) is kept as text,
 * and the note stays within its card limit (the rest is counted as left out).
 */
function checked(cards: Cards): ImportedCard[] {
  cards.flush()
  const out: ImportedCard[] = []
  for (const c of cards.cards) {
    if (parseCardContent(c.type, c.content).ok) out.push(c)
    else {
      const blocks = asBlocks(c.type, c.content)
      const fallback = { type: 'text' as CardType, content: { doc: { type: 'doc', content: blocks } } }
      if (blocks.length && parseCardContent(fallback.type, fallback.content).ok) out.push(fallback)
      else cards.skip(`invalid ${c.type}`)
    }
  }
  if (out.length > NOTE_LIMITS.cardsPerNote) cards.skip(`cards over ${NOTE_LIMITS.cardsPerNote}`)
  return out.slice(0, NOTE_LIMITS.cardsPerNote)
}

export function topicNote(topic: LegacyTopic): ConvertedNote {
  const out = new Cards()
  for (const n of unflatten(topic.content)) block(n, out)
  const cards = checked(out)
  return { title: topic.title.trim().slice(0, NOTE_LIMITS.title), cards, leftOut: out.leftOut }
}

const PROBLEM_PARTS = [
  ['statement', 'Problem'],
  ['io', 'Examples'],
  ['constraints', 'Constraints'],
  ['understanding', 'Understanding the problem'],
  ['intuition', 'Intuition'],
  ['approach', 'Approach'],
] as const
const SOLUTION_LANGUAGES = [
  ['py', 'python', 'Python'],
  ['cpp', 'cpp', 'C++'],
  ['java', 'java', 'Java'],
  ['js', 'javascript', 'JavaScript'],
] as const

export function problemNote(p: LegacyProblem): ConvertedNote {
  const out = new Cards()
  const source = p.leetcodeUrl && safeHref.safeParse(p.leetcodeUrl).success ? p.leetcodeUrl : null
  const video = p.youtubeUrl && safeHref.safeParse(p.youtubeUrl).success ? p.youtubeUrl : null
  out.paragraph(
    tidy([
      ...(p.difficulty ? [...text('Difficulty: '), ...text(p.difficulty, [{ type: 'bold' }])] : []),
      ...(source ? [...text(p.difficulty ? ' · ' : ''), ...text(p.lc ? `LeetCode ${p.lc}` : 'On LeetCode', [{ type: 'link', attrs: { href: source } }])] : []),
      ...(video ? [...text(' · '), ...text('Video walkthrough', [{ type: 'link', attrs: { href: video } }])] : []),
    ]),
  )
  const part = (heading: string, flat: LegacyFlatNode[] | undefined) => {
    const nodes = unflatten(flat ?? [])
    if (!nodes.length) return
    out.heading(1, text(heading))
    for (const n of nodes) block(n, out)
  }
  for (const [field, heading] of PROBLEM_PARTS) part(heading, p[field])
  for (const sol of [p.naive, p.optimal]) {
    if (!sol) continue
    out.heading(1, text(sol.title))
    for (const n of unflatten(sol.content ?? [])) block(n, out)
    for (const [key, lang, name] of SOLUTION_LANGUAGES) {
      const code = sol.code?.[key]
      if (code?.trim()) out.card('code' as CardType, { language: lang, code: code.slice(0, CARD_LIMITS.sourceChars), filename: name })
    }
    if (sol.complexity?.length) out.paragraph(text(sol.complexity.join(' · '), [{ type: 'bold' }]))
  }
  part('Variants', p.variants)
  for (const x of p.extra ?? []) part(x.title, x.content)
  part('Takeaway', p.takeaway)
  const cards = checked(out)
  return { title: p.title.trim().slice(0, NOTE_LIMITS.title), cards, leftOut: out.leftOut }
}

/** A fingerprint of what the import would write: the same source gives the same hash, so a re-run changes nothing. */
export function contentHash(note: { title: string; cards: ImportedCard[] }, topicIds: readonly string[]): string {
  return createHash('sha256').update(JSON.stringify([note.title, [...topicIds].sort(), note.cards])).digest('hex')
}
