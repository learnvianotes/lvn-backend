import type { CardType } from '@lvn/contracts/domain'
import { parseCardContent } from '@lvn/contracts/validation'
import { Lexer, type Token, type Tokens } from 'marked'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import type { ImportedCard } from './markdown-import'

/**
 * One seeded study note as a Markdown page (ADR-0098). The front matter names the note; the body is its cards, in
 * order, so editing the page and deploying updates that note. The dialect is GitHub-flavoured Markdown plus:
 *
 * - a code fence info string `language filename:<encodeURIComponent>` (the filename is optional);
 * - a `question` fence whose prompt and answer are separated by a line that is exactly `---`;
 * - an Obsidian callout `> [!NOTE] Title` (also INFO, TIP, WARNING, DANGER);
 * - `<strong>`, `<em>`, `<del>`, `<sup>`, `<sub>`, `<u>` and `<br>` where Markdown markers would collide;
 * - `&#124;` inside a table-cell code span, so a `|` in code does not split the row.
 *
 * A run of paragraphs and lists is one text card. The catalogue has no two text cards in a row, so the boundary is
 * the next heading, code fence, callout, question or table.
 */

export interface StudyPage {
  id: string
  /** `topic:<subject>/<topic>` or `problem:<subject>/<problem>`, the LegacyContentItem key. */
  key: string
  subject: string
  topic: string
  title: string
  slug: string
  /** Position within the topic, starting at 1. The filename prefix; not a database column. */
  order: number
  cards: ImportedCard[]
}

interface Mark {
  type: 'bold' | 'italic' | 'strike' | 'code' | 'underline' | 'superscript' | 'subscript' | 'link'
  attrs?: { href: string }
}
type InlineNode = { type: 'text'; text: string; marks?: Mark[] } | { type: 'hardBreak' }
interface Paragraph {
  type: 'paragraph'
  content?: InlineNode[]
}
interface ListNode {
  type: 'bulletList' | 'orderedList'
  content: { type: 'listItem'; content: BlockNode[] }[]
}
type BlockNode = Paragraph | ListNode
interface Doc {
  type: 'doc'
  content: BlockNode[]
}

const MARK_RANK: Record<Mark['type'], number> = { code: 0, bold: 1, italic: 2, strike: 3, underline: 4, superscript: 5, subscript: 6, link: 7 }
const WRAP: Record<string, Mark['type']> = {
  sup: 'superscript',
  sub: 'subscript',
  u: 'underline',
  strong: 'bold',
  b: 'bold',
  em: 'italic',
  i: 'italic',
  del: 'strike',
  s: 'strike',
}
const CALLOUT_VARIANTS = ['note', 'info', 'tip', 'warning', 'danger'] as const
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")

/** Table cells store a code-span `|` as `&#124;`. A literal `&#124;` in the code is written `&#38;#124;` first. */
function decodeCode(text: string): string {
  const held = '\u0000'
  return decode(text).replaceAll('&#38;#124;', held).replaceAll('&#124;', '|').replaceAll(held, '&#124;')
}

function sortMarks(marks: Mark[]): Mark[] {
  return [...marks].sort((a, b) => MARK_RANK[a.type] - MARK_RANK[b.type] || a.type.localeCompare(b.type))
}

function sameMarks(a: Mark[] | undefined, b: Mark[] | undefined): boolean {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? [])
}

function mergeInline(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = []
  for (const node of nodes) {
    if (node.type === 'text' && node.text.length === 0) continue
    const marks = node.type === 'text' && node.marks?.length ? sortMarks(node.marks) : undefined
    const prev = out.at(-1)
    if (node.type === 'text' && prev?.type === 'text' && sameMarks(prev.marks, marks)) prev.text += node.text
    else if (node.type === 'text') out.push(marks ? { type: 'text', text: node.text, marks } : { type: 'text', text: node.text })
    else out.push(node)
  }
  return out
}

/** Stable card JSON: schema-checked, adjacent text joined, marks in a fixed order. */
export function canonicalizeCards(cards: readonly ImportedCard[]): ImportedCard[] {
  return cards.map((card) => {
    const parsed = parseCardContent(card.type, card.content)
    if (!parsed.ok) throw new StudyPageError(parsed.message)
    return { type: card.type, content: canonicalizeValue(parsed.content) as ImportedCard['content'] }
  })
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.every((node) => node && typeof node === 'object' && (node.type === 'text' || node.type === 'hardBreak'))) return mergeInline(value as InlineNode[])
    return value.map(canonicalizeValue)
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, inner] of Object.entries(value)) out[key] = canonicalizeValue(inner)
    return out
  }
  return value
}

function parseInline(tokens: Token[] | undefined): InlineNode[] {
  const out: InlineNode[] = []
  const wraps: Mark[] = []
  const walk = (list: Token[] | undefined, marks: Mark[]) => {
    for (const tok of list ?? []) {
      if (tok.type === 'html') {
        const raw = (tok as Tokens.HTML).text.trim().toLowerCase()
        const open = /^<(sup|sub|u|strong|b|em|i|del|s)>$/.exec(raw)
        const close = /^<\/(sup|sub|u|strong|b|em|i|del|s)>$/.exec(raw)
        if (open) wraps.push({ type: WRAP[open[1]!]! })
        else if (close) {
          const want = WRAP[close[1]!]
          const at = wraps.findLastIndex((mark) => mark.type === want)
          if (at >= 0) wraps.splice(at, 1)
        } else if (raw === '<br>' || raw === '<br/>' || raw === '<br />') out.push({ type: 'hardBreak' })
        continue
      }
      const all = [...marks, ...wraps]
      switch (tok.type) {
        case 'text':
        case 'escape': {
          const text = tok as Tokens.Text
          if (text.tokens?.length) walk(text.tokens, all)
          else if (text.text) out.push({ type: 'text', text: decode(text.text), ...(all.length ? { marks: all } : {}) })
          break
        }
        case 'strong':
          walk((tok as Tokens.Strong).tokens, [...all, { type: 'bold' }])
          break
        case 'em':
          walk((tok as Tokens.Em).tokens, [...all, { type: 'italic' }])
          break
        case 'del':
          walk((tok as Tokens.Del).tokens, [...all, { type: 'strike' }])
          break
        case 'codespan':
          out.push({ type: 'text', text: decodeCode((tok as Tokens.Codespan).text), marks: [...all, { type: 'code' }] })
          break
        case 'link': {
          const link = tok as Tokens.Link
          let href: string | null = null
          try {
            const url = new URL(link.href)
            if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') href = link.href
          } catch {
            href = null
          }
          walk(link.tokens, href ? [...all, { type: 'link', attrs: { href } }] : all)
          break
        }
        case 'br':
          out.push({ type: 'hardBreak' })
          break
        default:
          break
      }
    }
  }
  walk(tokens, [])
  return mergeInline(out)
}

function listBlock(list: Tokens.List): ListNode {
  return {
    type: list.ordered ? 'orderedList' : 'bulletList',
    content: list.items.map((item) => ({
      type: 'listItem' as const,
      content: item.tokens.flatMap((tok): BlockNode[] => {
        if (tok.type === 'space') return []
        if (tok.type === 'list') return [listBlock(tok as Tokens.List)]
        if (tok.type === 'text' || tok.type === 'paragraph') {
          const text = tok as Tokens.Text
          return [{ type: 'paragraph', content: parseInline(text.tokens ?? []) }]
        }
        throw new StudyPageError(`A list contains unsupported content (${tok.type}).`)
      }),
    })),
  }
}

function escapeInline(text: string, cell: boolean): string {
  // `~` is strikethrough in this Markdown build, so a bare tilde would swallow the next code span.
  let out = text
    .replace(/[&\\`*_[\]~]/g, (ch) => (ch === '&' ? '&amp;' : `\\${ch}`))
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  if (cell) out = out.replace(/\|/g, '\\|').replace(/\n/g, '<br>')
  return out
}

/** A raw `|` inside a table-cell code span splits the row. The entity is not a pipe character, and codespans keep it literal. */
function cellCode(text: string): string {
  return text.replaceAll('&#124;', '&#38;#124;').replaceAll('|', '&#124;')
}

function wrapCode(text: string): string {
  let fence = '`'
  while (text.includes(fence)) fence += '`'
  // A code span that both starts and ends with a space loses one space on each side. Put that space back.
  const keepSpaces = text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text)
  const pad = keepSpaces || text.startsWith('`') || text.endsWith('`') ? ' ' : ''
  return `${fence}${pad}${text}${pad}${fence}`
}

function renderText(text: string, marks: Mark[] | undefined, cell: boolean): string {
  const ordered = marks?.length ? sortMarks(marks) : []
  const code = ordered.some((mark) => mark.type === 'code')
  let out = code ? wrapCode(cell ? cellCode(text) : text) : escapeInline(text, cell)
  for (const mark of ordered) {
    if (mark.type === 'code') continue
    // HTML, not ** and *, so a bold word next to `code` does not collapse into ****.
    if (mark.type === 'bold') out = `<strong>${out}</strong>`
    else if (mark.type === 'italic') out = `<em>${out}</em>`
    else if (mark.type === 'strike') out = `<del>${out}</del>`
    else if (mark.type === 'superscript') out = `<sup>${out}</sup>`
    else if (mark.type === 'subscript') out = `<sub>${out}</sub>`
    else if (mark.type === 'underline') out = `<u>${out}</u>`
    else if (mark.type === 'link' && mark.attrs?.href) {
      const href = mark.attrs.href
      out = /[()\s]/.test(href) ? `[${out}](<${href}>)` : `[${out}](${href})`
    }
  }
  return out
}

function renderInline(nodes: InlineNode[] | undefined, cell: boolean): string {
  let out = ''
  for (const node of mergeInline(nodes ?? [])) {
    if (node.type === 'hardBreak') out += '<br>'
    else out += renderText(node.text, node.marks, cell)
  }
  return out
}

function escapeBlockStart(text: string): string {
  const [first, ...rest] = text.split('\n')
  return [escapeLine(first ?? ''), ...rest].join('\n')
}

function escapeLine(line: string): string {
  if (/^(\s{0,3}\d+)\.(\s)/.test(line)) return line.replace(/^(\s{0,3}\d+)\./, '$1\\.')
  if (/^(\s{0,3})([-+*])(\s)/.test(line)) return line.replace(/^(\s{0,3})([-+*])/, '$1\\$2')
  if (/^(#{1,6})(\s|$)/.test(line)) return line.replace(/^(#{1,6})/, '\\$1')
  if (/^(\s{0,3})(---+|\*\*\*+|___+)\s*$/.test(line)) return `\\${line.trimStart()}`
  if (/^(\s{0,3})>/.test(line)) return line.replace('>', '\\>')
  if (line.startsWith('|')) return `\\${line}`
  return line
}

function renderParagraph(content: InlineNode[] | undefined, cell: boolean): string {
  const text = renderInline(content, cell)
  return cell ? text : escapeBlockStart(text)
}

function prefixLines(text: string, indent: string): string {
  if (!indent) return text
  return text
    .split('\n')
    .map((line) => (line.length ? indent + line : indent))
    .join('\n')
}

function renderBlock(block: BlockNode, indent: string): string {
  if (block.type === 'paragraph') return prefixLines(renderParagraph(block.content, false), indent)
  return renderList(block, indent)
}

function renderList(list: ListNode, indent: string): string {
  const loose = list.content.some((item) => item.content.length > 1)
  return list.content
    .map((item, index) => {
      const marker = list.type === 'orderedList' ? `${index + 1}. ` : '- '
      const pad = ' '.repeat(marker.length)
      const parts = item.content.map((block) => renderBlock(block, indent + pad))
      const first = parts[0] ?? indent + pad
      const breakAt = first.indexOf('\n')
      const head = breakAt === -1 ? first : first.slice(0, breakAt)
      const tail = breakAt === -1 ? '' : first.slice(breakAt)
      const body = head.startsWith(indent + pad) ? head.slice((indent + pad).length) : head.trimStart()
      const rendered = [`${indent}${marker}${body}${tail}`, ...parts.slice(1)].filter((part) => part.length > 0)
      return rendered.join('\n\n')
    })
    .join(loose ? '\n\n' : '\n')
}

function renderDoc(doc: Doc | undefined, cell = false): string {
  if (cell) return (doc?.content ?? []).map((block) => (block.type === 'paragraph' ? renderParagraph(block.content, true) : renderList(block, ''))).join('\n\n')
  return (doc?.content ?? []).map((block) => renderBlock(block, '')).join('\n\n')
}

function quote(markdown: string): string {
  if (!markdown) return '>'
  return markdown
    .split('\n')
    .map((line) => (line.length ? `> ${line}` : '>'))
    .join('\n')
}

function fence(info: string, body: string): string {
  let ticks = '```'
  while (body.includes(ticks)) ticks += '`'
  return `${ticks}${info}\n${body}\n${ticks}`
}

function escapeRule(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => (line.trim() === '---' ? `\\${line}` : line))
    .join('\n')
}

function renderCard(card: ImportedCard): string {
  const content = card.content as Record<string, unknown>
  switch (card.type) {
    case 'heading':
      return `${'#'.repeat(Number(content.level) || 1)} ${renderInline(content.content as InlineNode[], false)}`
    case 'text':
      return renderDoc(content.doc as Doc)
    case 'code': {
      const language = String(content.language ?? '')
      const filename = typeof content.filename === 'string' && content.filename.length > 0 ? `filename:${encodeURIComponent(content.filename)}` : ''
      const info = [language, filename].filter(Boolean).join(' ')
      return fence(info, String(content.code ?? ''))
    }
    case 'callout': {
      const variant = String(content.variant ?? 'note').toUpperCase()
      const title = typeof content.title === 'string' && content.title.length > 0 ? ` ${content.title.replace(/\n/g, ' ')}` : ''
      return `> [!${variant}]${title}\n>\n${quote(renderDoc(content.doc as Doc))}`
    }
    case 'question': {
      const prompt = escapeRule(renderDoc(content.prompt as Doc))
      const answer = escapeRule(renderDoc(content.answer as Doc))
      const hint = content.hint ? `\n\n---\n\n${escapeRule(renderDoc(content.hint as Doc))}` : ''
      return fence('question', `${prompt}\n\n---\n\n${answer}${hint}`)
    }
    case 'table': {
      const rows = content.rows as InlineNode[][][]
      const line = (row: InlineNode[][]) => `| ${row.map((cell) => renderInline(cell, true)).join(' | ')} |`
      const rule = `| ${rows[0]!.map(() => '---').join(' | ')} |`
      return [line(rows[0]!), rule, ...rows.slice(1).map(line)].join('\n')
    }
    default:
      throw new StudyPageError(`A ${card.type} card cannot be stored as a study page.`)
  }
}

function codeInfo(raw: string | null | undefined): { language: string; filename?: string } {
  const info = (raw ?? '').trim()
  const at = info.indexOf('filename:')
  if (at === -1) {
    if (info && !/^[a-z0-9+#.-]*$/i.test(info)) throw new StudyPageError(`Unknown code fence info "${info}".`)
    return { language: info.toLowerCase() }
  }
  const language = info.slice(0, at).trim().toLowerCase()
  if (language && !/^[a-z0-9+#.-]*$/.test(language)) throw new StudyPageError(`Unknown code language "${language}".`)
  let filename: string
  try {
    filename = decodeURIComponent(info.slice(at + 'filename:'.length).trim())
  } catch {
    throw new StudyPageError('A code filename is not encoded correctly.')
  }
  return { language, ...(filename ? { filename } : {}) }
}

function simpleDoc(source: string): Doc {
  const tokens = new Lexer({ gfm: true }).lex(source.trim()).filter((tok) => tok.type !== 'space')
  return { type: 'doc', content: tokens.map(blockFrom) }
}

function blockFrom(tok: Token): BlockNode {
  if (tok.type === 'list') return listBlock(tok as Tokens.List)
  if (tok.type === 'paragraph' || tok.type === 'text') return { type: 'paragraph', content: parseInline((tok as Tokens.Paragraph).tokens) }
  throw new StudyPageError(`Unsupported block (${tok.type}) inside a card.`)
}

function cardsFrom(tokens: Token[]): ImportedCard[] {
  const cards: ImportedCard[] = []
  let text: BlockNode[] = []
  const flush = () => {
    if (!text.length) return
    cards.push({ type: 'text', content: { doc: { type: 'doc', content: text } } })
    text = []
  }
  for (const tok of tokens) {
    if (tok.type === 'space') continue
    if (tok.type === 'paragraph' || tok.type === 'list') {
      text.push(blockFrom(tok))
      continue
    }
    flush()
    if (tok.type === 'heading') {
      const heading = tok as Tokens.Heading
      if (heading.depth < 1 || heading.depth > 3) throw new StudyPageError('Headings are levels 1 to 3.')
      cards.push({ type: 'heading', content: { level: heading.depth as 1 | 2 | 3, content: parseInline(heading.tokens) } })
    } else if (tok.type === 'code') {
      const code = tok as Tokens.Code
      if ((code.lang ?? '').trim() === 'question') cards.push(questionCard(code.text))
      else {
        const info = codeInfo(code.lang)
        cards.push({ type: 'code', content: { language: info.language, code: code.text, ...(info.filename ? { filename: info.filename } : {}) } })
      }
    } else if (tok.type === 'blockquote') cards.push(calloutCard(tok as Tokens.Blockquote))
    else if (tok.type === 'table') cards.push(tableCard(tok as Tokens.Table))
    else throw new StudyPageError(`Unsupported block (${tok.type}).`)
  }
  flush()
  return cards
}

function questionCard(source: string): ImportedCard {
  const parts = source.split('\n---\n')
  if (parts.length < 2) throw new StudyPageError('A question needs a line containing only --- between the prompt and the answer.')
  const hint = parts.length > 2 ? simpleDoc(parts.slice(2).join('\n---\n')) : undefined
  return { type: 'question', content: { prompt: simpleDoc(parts[0]!), answer: simpleDoc(parts[1]!), ...(hint ? { hint } : {}) } }
}

function calloutCard(quoteToken: Tokens.Blockquote): ImportedCard {
  const tokens = quoteToken.tokens.filter((tok) => tok.type !== 'space')
  const first = tokens[0]
  if (!first || first.type !== 'paragraph') throw new StudyPageError('A callout starts with > [!NOTE] Title.')
  const line = ((first as Tokens.Paragraph).text ?? '').trim()
  const matched = /^\[!(NOTE|INFO|TIP|WARNING|DANGER)\](?:\s+(.*))?$/.exec(line)
  if (!matched) throw new StudyPageError(`Not a callout: ${line.slice(0, 80)}`)
  const variant = matched[1]!.toLowerCase()
  if (!CALLOUT_VARIANTS.includes(variant as (typeof CALLOUT_VARIANTS)[number])) throw new StudyPageError(`Unknown callout ${variant}.`)
  const title = matched[2]?.trim()
  return {
    type: 'callout',
    content: {
      variant,
      ...(title ? { title } : {}),
      doc: { type: 'doc', content: tokens.slice(1).map(blockFrom) },
    },
  }
}

function tableCard(table: Tokens.Table): ImportedCard {
  const cell = (row: Tokens.TableCell) => parseInline(row.tokens)
  return { type: 'table', content: { hasHeaderRow: true, rows: [table.header.map(cell), ...table.rows.map((row) => row.map(cell))] } }
}

function checked(type: CardType, content: unknown): ImportedCard {
  const parsed = parseCardContent(type, content)
  if (!parsed.ok) throw new StudyPageError(`A ${type} card is not valid: ${parsed.message}`)
  return { type, content: canonicalizeValue(parsed.content) as ImportedCard['content'] }
}

export class StudyPageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StudyPageError'
  }
}

function field(data: Record<string, unknown>, name: string): string {
  const value = data[name]
  if (typeof value !== 'string' || !value.trim()) throw new StudyPageError(`Front matter needs a ${name}.`)
  return value.trim()
}

/** The Markdown page for one note, front matter then cards. */
export function renderStudyPage(page: StudyPage): string {
  const front = stringifyYaml({
    id: page.id,
    key: page.key,
    subject: page.subject,
    topic: page.topic,
    title: page.title,
    slug: page.slug,
    order: page.order,
  }).trimEnd()
  const body = canonicalizeCards(page.cards).map(renderCard).join('\n\n')
  return `---\n${front}\n---\n\n${body}\n`
}

/** Front matter and cards. Throws `StudyPageError` when the page is not a study note. */
export function parseStudyPage(source: string, file = 'study page'): StudyPage {
  try {
    const matched = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source)
    if (!matched) throw new StudyPageError('The page needs front matter between --- lines.')
    const data = parseYaml(matched[1]!) as Record<string, unknown>
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new StudyPageError('Front matter must be a map.')
    const id = field(data, 'id')
    if (!UUID.test(id)) throw new StudyPageError('id must be a UUID.')
    const key = field(data, 'key')
    if (!/^(topic|problem):[^/\s]+\/[^/\s]+$/.test(key)) throw new StudyPageError('key must look like topic:subject/topic or problem:subject/id.')
    const subject = field(data, 'subject')
    const topic = field(data, 'topic')
    if (subject.includes('/') || topic.includes('/') || subject.includes('..') || topic.includes('..')) throw new StudyPageError('subject and topic are slugs.')
    const title = field(data, 'title')
    const slug = field(data, 'slug')
    const order = data.order
    if (typeof order !== 'number' || !Number.isInteger(order) || order < 1) throw new StudyPageError('order must be an integer starting at 1.')
    const cards = cardsFrom(new Lexer({ gfm: true }).lex(matched[2]!)).map((card) => checked(card.type, card.content))
    return { id, key, subject, topic, title, slug, order, cards }
  } catch (error) {
    if (error instanceof StudyPageError) throw new StudyPageError(`${file}: ${error.message}`)
    throw error
  }
}
