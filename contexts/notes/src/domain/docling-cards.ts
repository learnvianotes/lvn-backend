import type { CardType } from '@lvn/contracts/domain'
import { CARD_LIMITS, parseCardContent } from '@lvn/contracts/validation'

type PageRect = [number, number, number, number]

/**
 * Stage 5 of ADR-0028: a DoclingDocument (what workers/pdf-engine read from a PDF) into cards, each with the anchor of
 * the page and boxes it came from (ADR-0040), so the note can be checked beside the PDF in the reader.
 *
 * - Headings: the title is level 1; section headers take their level from their numbering ("Chapter 3", "3.1",
 *   "3.1.2"), since Docling reports every header at level 1.
 * - Paragraphs and lists on the same page gather into one text card, up to TEXT_CARD_CHARS.
 * - Tables become table cards (header row when Docling marks one), pictures image cards with their caption, code code
 *   cards, formulas Markdown cards.
 * - A "Figure 3.1 …" or "Table 2 …" line right after a picture or table is its caption, even when Docling calls it a
 *   header. Page headers and footers, and the words drawn inside pictures, are left out.
 */

export interface DoclingRef {
  $ref: string
}
interface Box {
  l: number
  t: number
  r: number
  b: number
  coord_origin?: 'BOTTOMLEFT' | 'TOPLEFT'
}
interface Prov {
  page_no: number
  bbox: Box
}
interface Node {
  self_ref: string
  label: string
  children?: DoclingRef[]
  content_layer?: string
  prov?: Prov[]
}
interface TextNode extends Node {
  text: string
  level?: number
  enumerated?: boolean
  code_language?: string
}
interface TableNode extends Node {
  captions?: DoclingRef[]
  data: { num_rows: number; num_cols: number; table_cells: { text: string; start_row_offset_idx: number; start_col_offset_idx: number; column_header?: boolean }[] }
}
interface PictureNode extends Node {
  captions?: DoclingRef[]
}
export interface DoclingDocument {
  body: { children: DoclingRef[] }
  texts: TextNode[]
  groups: Node[]
  tables: TableNode[]
  pictures: PictureNode[]
  pages: Record<string, { size: { width: number; height: number } }>
}

export interface ConvertedCard {
  type: CardType
  content: unknown
}

/** Paragraphs gather into one text card until it holds about this much */
export const TEXT_CARD_CHARS = 3_000
const SKIPPED = new Set(['page_header', 'page_footer'])
const CAPTION = /^(fig(ure)?\.?|table|chart|diagram)\s*[\dIVXivx]/i

type Inline = { type: 'text'; text: string }[]
type Block = { type: 'paragraph'; content: Inline } | { type: 'bulletList' | 'orderedList'; content: { type: 'listItem'; content: { type: 'paragraph'; content: Inline }[] }[] }

const inline = (text: string): Inline => (text.trim() ? [{ type: 'text', text: text.replace(/\s+/g, ' ').trim() }] : [])

/** A heading's level from its numbering: "Chapter 3" and "Unit 2" are 1, "3.1" is 2, "3.1.2" and deeper are 3. */
export function headingLevel(text: string, title: boolean): 1 | 2 | 3 {
  if (title || /^(chapter|unit|part|lesson|module)\b/i.test(text.trim())) return 1
  const numbered = /^(\d+(?:\.\d+)*)[.)]?\s/.exec(text.trim())
  if (!numbered) return 2
  const depth = numbered[1]!.split('.').length
  return depth >= 3 ? 3 : depth === 2 ? 2 : 1
}

/** A Docling box as a page rectangle: fractions from the page's top left (PDF boxes are usually from the bottom). */
export function pageRect(box: Box, page: { width: number; height: number }): PageRect {
  const clamp = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100_000) / 100_000
  const [top, bottom] = box.coord_origin === 'TOPLEFT' ? [box.t, box.b] : [page.height - box.t, page.height - box.b]
  return [clamp(Math.min(box.l, box.r) / page.width), clamp(Math.min(top, bottom) / page.height), clamp(Math.max(box.l, box.r) / page.width), clamp(Math.max(top, bottom) / page.height)]
}

export function doclingToCards(doc: DoclingDocument, opts: { fileId: string; picture: (ref: string) => string | null; maxCards: number }): { cards: ConvertedCard[]; warnings: string[] } {
  const cards: ConvertedCard[] = []
  const warnings: string[] = []
  const byRef = (ref: string): Node | undefined => {
    const [, kind, index] = /^#\/(texts|groups|tables|pictures)\/(\d+)$/.exec(ref) ?? []
    return kind ? (doc[kind as 'texts' | 'groups' | 'tables' | 'pictures'] as Node[])[Number(index)] : undefined
  }
  const anchorOf = (provs: Prov[]): { fileId: string; page: number; rects: PageRect[] } | undefined => {
    const first = provs[0]
    const size = first ? doc.pages[String(first.page_no)]?.size : undefined
    if (!first || !size) return undefined
    const rects = provs.filter((p) => p.page_no === first.page_no).map((p) => pageRect(p.bbox, size))
    return { fileId: opts.fileId, page: first.page_no, rects: rects.slice(0, CARD_LIMITS.anchorRects) }
  }
  const push = (type: CardType, content: Record<string, unknown>, provs: Prov[]) => {
    if (cards.length >= opts.maxCards) return
    const anchor = anchorOf(provs)
    const parsed = parseCardContent(type, anchor ? { ...content, anchor } : content)
    if (parsed.ok) cards.push({ type, content: parsed.content })
    else warnings.push(`A ${type} card was left out: ${parsed.message}`)
  }

  // Text gathers here until something else comes, the page changes or it is long enough.
  let blocks: Block[] = []
  let blockProvs: Prov[] = []
  let chars = 0
  const flush = () => {
    if (blocks.length) push('text', { doc: { type: 'doc', content: blocks } }, blockProvs)
    blocks = []
    blockProvs = []
    chars = 0
  }
  const addBlock = (block: Block, provs: Prov[], length: number) => {
    const page = provs[0]?.page_no
    if (blocks.length && (chars + length > TEXT_CARD_CHARS || (page !== undefined && blockProvs[0]?.page_no !== undefined && page !== blockProvs[0].page_no))) flush()
    blocks.push(block)
    blockProvs.push(...provs)
    chars += length
  }
  // The last picture or table card, which a caption right after it belongs to.
  let captionable: { index: number; kind: 'table' | 'picture' } | null = null
  /** A caption right after a picture (its caption) or a table (a line under it); false when there is none to belong to. */
  const caption = (text: string, provs: Prov[]): boolean => {
    if (!captionable || cards.length - 1 !== captionable.index) return false
    const card = cards[captionable.index]!
    if (captionable.kind === 'picture') {
      const content = card.content as Record<string, unknown>
      const parsed = parseCardContent('image', { ...content, caption: inline(text), alt: text.slice(0, CARD_LIMITS.alt) })
      if (parsed.ok) card.content = parsed.content
    } else addBlock({ type: 'paragraph', content: inline(text) }, provs, text.length)
    captionable = null
    return true
  }

  const visit = (ref: DoclingRef) => {
    const node = byRef(ref.$ref)
    if (!node || node.content_layer === 'furniture' || SKIPPED.has(node.label)) return
    const provs = node.prov ?? []
    if (ref.$ref.startsWith('#/groups/')) {
      const items = (node.children ?? []).map((c) => byRef(c.$ref)).filter((n): n is TextNode => !!n && 'text' in n)
      if (node.label === 'list' || node.label === 'ordered_list') {
        const listed = items.filter((i) => i.label === 'list_item' && i.text.trim())
        if (listed.length) {
          // A list joins the text around it, as one block.
          const ordered = node.label === 'ordered_list' || listed.every((i) => i.enumerated)
          addBlock(
            { type: ordered ? 'orderedList' : 'bulletList', content: listed.map((i) => ({ type: 'listItem' as const, content: [{ type: 'paragraph' as const, content: inline(i.text) }] })) },
            listed.flatMap((i) => i.prov ?? []),
            listed.reduce((n, i) => n + i.text.length, 0),
          )
        }
        // Anything else inside a list group (rare) is visited as it is.
        for (const c of node.children ?? []) if (byRef(c.$ref)?.label !== 'list_item') visit(c)
      } else for (const c of node.children ?? []) visit(c)
      return
    }
    if (ref.$ref.startsWith('#/tables/')) {
      flush()
      const table = node as TableNode
      const { num_rows: rows, num_cols: cols, table_cells: cells } = table.data
      if (!rows || !cols) return
      if (cols > CARD_LIMITS.tableColumns || rows > CARD_LIMITS.tableRows) warnings.push(`A table on page ${provs[0]?.page_no ?? '?'} was cut to ${CARD_LIMITS.tableRows} rows and ${CARD_LIMITS.tableColumns} columns`)
      const grid: Inline[][] = Array.from({ length: Math.min(rows, CARD_LIMITS.tableRows) }, () => Array.from({ length: Math.min(cols, CARD_LIMITS.tableColumns) }, () => [] as Inline))
      for (const cell of cells) {
        const row = grid[cell.start_row_offset_idx]
        if (row && cell.start_col_offset_idx < row.length && !row[cell.start_col_offset_idx]!.length) row[cell.start_col_offset_idx] = inline(cell.text)
      }
      const header = cells.some((c) => c.start_row_offset_idx === 0 && c.column_header)
      push('table', { hasHeaderRow: header, rows: grid }, provs)
      captionable = { index: cards.length - 1, kind: 'table' }
      return
    }
    if (ref.$ref.startsWith('#/pictures/')) {
      flush()
      const fileId = opts.picture(ref.$ref)
      if (!fileId) {
        warnings.push(`A picture on page ${provs[0]?.page_no ?? '?'} could not be kept`)
        return
      }
      const captionText = ((node as PictureNode).captions ?? []).map((c) => (byRef(c.$ref) as TextNode | undefined)?.text ?? '').join(' ').trim()
      push('image', { fileId, alt: (captionText || `A picture on page ${provs[0]?.page_no ?? ''}`).slice(0, CARD_LIMITS.alt), ...(captionText ? { caption: inline(captionText) } : {}) }, provs)
      captionable = captionText ? null : { index: cards.length - 1, kind: 'picture' }
      return
    }
    const text = node as TextNode
    if (!text.text?.trim()) return
    switch (text.label) {
      case 'title':
      case 'section_header':
        if (CAPTION.test(text.text) && caption(text.text, provs)) return
        flush()
        push('heading', { level: headingLevel(text.text, text.label === 'title'), content: inline(text.text) }, provs)
        break
      case 'caption':
        if (caption(text.text, provs)) return
        addBlock({ type: 'paragraph', content: inline(text.text) }, provs, text.text.length)
        break
      case 'code':
        flush()
        push('code', { language: (text.code_language ?? '').toLowerCase().replace(/[^a-z0-9+#.-]/g, '').slice(0, CARD_LIMITS.codeLanguage), code: text.text }, provs)
        break
      case 'formula':
        flush()
        push('markdown', { source: `$$\n${text.text}\n$$` }, provs)
        break
      case 'list_item':
        addBlock({ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: inline(text.text) }] }] }, provs, text.text.length)
        break
      default:
        if (CAPTION.test(text.text) && caption(text.text, provs)) return
        addBlock({ type: 'paragraph', content: inline(text.text) }, provs, text.text.length)
    }
    captionable = null
  }

  for (const ref of doc.body.children) visit(ref)
  flush()
  if (cards.length >= opts.maxCards) warnings.push(`Only the first ${opts.maxCards} cards were kept`)
  return { cards, warnings }
}
