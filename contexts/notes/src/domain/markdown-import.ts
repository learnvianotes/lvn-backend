import { randomUUID } from 'node:crypto'
import type { CardType } from '@lvn/contracts/domain'
import { parseCardContent } from '@lvn/contracts/validation'
import { Lexer, type Token, type Tokens } from 'marked'

/**
 * Markdown into cards (ADR-0018 imports): headings, text with lists and marks, code (mermaid becomes a diagram),
 * quotes and callouts (`> [!TIP] Title`), checklists, tables and images. Raw HTML is dropped. Images come back as
 * `images` with the card they belong to; the importer stores the files and fills in the ids. Obsidian links
 * (`[[Note]]`, `![[picture.png]]`) are understood.
 */

export interface ImportedCard {
  type: CardType
  content: unknown
}

export interface ParsedMarkdown {
  /** The first level-1 heading, used as the title when the front matter has none */
  title: string | null
  cards: ImportedCard[]
  /** Image cards to fill: `cards[index].content.fileId` gets the stored file */
  images: { index: number; src: string }[]
  warnings: string[]
}

type Mark = { type: string; attrs?: Record<string, unknown> }
type InlineNode = { type: 'text'; text: string; marks?: Mark[] } | { type: 'hardBreak' }
type Block = { type: 'paragraph'; content?: InlineNode[] } | { type: 'bulletList' | 'orderedList'; content: { type: 'listItem'; content: Block[] }[] }

const SAFE_LINK = /^(https?:|mailto:)/i
const CALLOUTS: Record<string, string> = { NOTE: 'note', INFO: 'info', TIP: 'tip', HINT: 'tip', SUCCESS: 'tip', WARNING: 'warning', CAUTION: 'warning', IMPORTANT: 'warning', DANGER: 'danger', ERROR: 'danger', BUG: 'danger' }

/** Obsidian's wiki links and embeds, in plain Markdown. */
function obsidian(md: string): string {
  return md.replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, f: string) => `![](${encodeURI(f.trim())})`).replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, target: string, alias?: string) => (alias ?? target).trim())
}

function inline(tokens: Token[] | undefined, marks: Mark[] = []): InlineNode[] {
  const out: InlineNode[] = []
  for (const tok of tokens ?? []) {
    switch (tok.type) {
      case 'text':
      case 'escape': {
        const t = tok as Tokens.Text
        if (t.tokens?.length) out.push(...inline(t.tokens, marks))
        else if (t.text) out.push({ type: 'text', text: decode(t.text), ...(marks.length ? { marks } : {}) })
        break
      }
      case 'strong':
        out.push(...inline((tok as Tokens.Strong).tokens, [...marks, { type: 'bold' }]))
        break
      case 'em':
        out.push(...inline((tok as Tokens.Em).tokens, [...marks, { type: 'italic' }]))
        break
      case 'del':
        out.push(...inline((tok as Tokens.Del).tokens, [...marks, { type: 'strike' }]))
        break
      case 'codespan':
        out.push({ type: 'text', text: decode((tok as Tokens.Codespan).text), marks: [{ type: 'code' }] })
        break
      case 'link': {
        const l = tok as Tokens.Link
        out.push(...inline(l.tokens, SAFE_LINK.test(l.href) ? [...marks, { type: 'link', attrs: { href: l.href } }] : marks))
        break
      }
      case 'br':
        out.push({ type: 'hardBreak' })
        break
      default:
        // html and images inside text are left out (images are lifted into their own cards by the caller)
        break
    }
  }
  // Neighbouring text with the same marks is one text node, and empty ones go.
  return out.filter((n) => n.type !== 'text' || n.text.length > 0)
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")

function listBlock(list: Tokens.List, depth: number): Block {
  return {
    type: list.ordered ? 'orderedList' : 'bulletList',
    content: list.items.map((item) => ({
      type: 'listItem',
      content: item.tokens.flatMap((t): Block[] => {
        if (t.type === 'list') return depth < 4 ? [listBlock(t as Tokens.List, depth + 1)] : []
        if (t.type === 'text' || t.type === 'paragraph') return [{ type: 'paragraph', content: inline((t as Tokens.Text).tokens ?? [{ type: 'text', raw: (t as Tokens.Text).text, text: (t as Tokens.Text).text } as Tokens.Text]) }]
        return []
      }),
    })),
  }
}

const textOfTokens = (tokens: Token[] | undefined): string => (tokens ?? []).map((t) => ('text' in t ? String((t as Tokens.Text).text) : '')).join('')

export function markdownToCards(source: string): ParsedMarkdown {
  const tokens = new Lexer({ gfm: true }).lex(obsidian(source))
  const cards: ImportedCard[] = []
  const images: ParsedMarkdown['images'] = []
  const warnings: string[] = []
  let title: string | null = null
  let text: Block[] = []

  const push = (type: CardType, content: unknown) => {
    const parsed = parseCardContent(type, content)
    if (parsed.ok) cards.push({ type, content: parsed.content })
    else warnings.push(`A ${type} card was left out: ${parsed.message}`)
  }
  const flush = () => {
    if (text.length) push('text', { doc: { type: 'doc', content: text } })
    text = []
  }
  const image = (src: string, alt: string) => {
    flush()
    images.push({ index: cards.length, src })
    cards.push({ type: 'image', content: { fileId: '', alt: alt.slice(0, 500) } })
  }

  for (const tok of tokens) {
    switch (tok.type) {
      case 'heading': {
        const h = tok as Tokens.Heading
        if (h.depth === 1 && title === null && !cards.length && !text.length) {
          title = textOfTokens(h.tokens).trim() || null
          break
        }
        flush()
        push('heading', { level: Math.min(h.depth, 3), content: inline(h.tokens) })
        break
      }
      case 'paragraph': {
        const p = tok as Tokens.Paragraph
        const pics = p.tokens.filter((t) => t.type === 'image') as Tokens.Image[]
        const words = inline(p.tokens)
        if (words.some((w) => w.type === 'hardBreak' || w.text.trim())) text.push({ type: 'paragraph', content: words })
        for (const pic of pics) image(decodeURI(pic.href), pic.text)
        break
      }
      case 'list': {
        const l = tok as Tokens.List
        if (l.items.length && l.items.every((i) => i.task)) {
          flush()
          push('checklist', { items: l.items.map((i) => ({ id: randomUUID(), checked: !!i.checked, content: inline(i.tokens.flatMap((t) => (t.type === 'text' || t.type === 'paragraph' ? ((t as Tokens.Text).tokens ?? []) : []))) })) })
        } else {
          text.push(listBlock(l, 0))
        }
        break
      }
      case 'code': {
        const c = tok as Tokens.Code
        flush()
        const lang = (c.lang ?? '').trim().toLowerCase()
        if (lang === 'mermaid') push('diagram', { syntax: 'mermaid', source: c.text })
        else push('code', { language: lang.replace(/[^a-z0-9+#.-]/g, '').slice(0, 30), code: c.text })
        break
      }
      case 'blockquote': {
        const q = tok as Tokens.Blockquote
        flush()
        const callout = /^\[!(\w+)\][+-]?\s*(.*)$/m.exec(q.text.split('\n')[0] ?? '')
        const inner = new Lexer({ gfm: true }).lex(callout ? q.text.split('\n').slice(1).join('\n') : q.text)
        const doc: Block[] = inner.flatMap((t): Block[] => (t.type === 'paragraph' ? [{ type: 'paragraph', content: inline((t as Tokens.Paragraph).tokens) }] : t.type === 'list' ? [listBlock(t as Tokens.List, 0)] : []))
        if (callout) push('callout', { variant: CALLOUTS[callout[1]!.toUpperCase()] ?? 'note', ...(callout[2] ? { title: callout[2].trim().slice(0, 200) } : {}), doc: { type: 'doc', content: doc } })
        else push('quote', { doc: { type: 'doc', content: doc } })
        break
      }
      case 'table': {
        const tb = tok as Tokens.Table
        flush()
        push('table', { hasHeaderRow: true, rows: [tb.header.map((h) => inline(h.tokens)), ...tb.rows.map((r) => r.map((cell) => inline(cell.tokens)))] })
        break
      }
      case 'hr':
        flush()
        break
      case 'html':
        // Raw HTML is never imported (ADR-0018).
        break
      default:
        break
    }
  }
  flush()
  return { title, cards, images, warnings }
}
