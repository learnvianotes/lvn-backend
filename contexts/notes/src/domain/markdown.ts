import type { CardType } from '@lvn/contracts/domain'
import { cardAnchor, type BlockNode, type Doc, type Inline } from '@lvn/contracts/validation'

/**
 * Cards as Markdown (ADR-0018 exports): readable in any editor and by other note apps. Exports also carry each card's
 * JSON (note.json), which the importer prefers for LearnViaNotes exports, so nothing is lost on the way back.
 */

const escape = (s: string) => s.replace(/([\\`*_[\]#|<>])/g, '\\$1')

export function inlineToMarkdown(inline: Inline | undefined): string {
  return (inline ?? [])
    .map((n) => {
      if (n.type === 'hardBreak') return '  \n'
      let t = escape(n.text)
      for (const m of n.marks ?? []) {
        if (m.type === 'code') t = `\`${n.text.replace(/`/g, '\\`')}\``
        else if (m.type === 'bold') t = `**${t}**`
        else if (m.type === 'italic') t = `_${t}_`
        else if (m.type === 'strike') t = `~~${t}~~`
        else if (m.type === 'highlight') t = `==${t}==`
        else if (m.type === 'link') t = `[${t}](${(m as { attrs: { href: string } }).attrs.href})`
      }
      return t
    })
    .join('')
}

function blockToMarkdown(node: BlockNode, indent: string): string {
  if (node.type === 'paragraph') return indent + inlineToMarkdown(node.content)
  return node.content
    .map((item, i) => {
      const bullet = node.type === 'orderedList' ? `${i + 1}. ` : '- '
      const [first, ...rest] = item.content.map((b) => blockToMarkdown(b, indent + ' '.repeat(bullet.length)).trimStart())
      return `${indent}${bullet}${first ?? ''}${rest.length ? '\n' + rest.map((r) => indent + ' '.repeat(bullet.length) + r).join('\n') : ''}`
    })
    .join('\n')
}

export function docToMarkdown(doc: Doc | undefined): string {
  return (doc?.content ?? []).map((b) => blockToMarkdown(b, '')).join('\n\n')
}

const quoted = (text: string) => text.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n')
const cell = (inline: Inline) => inlineToMarkdown(inline).replace(/\n/g, ' ') || ' '

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each card type's content is checked by its schema
type Any = any

type MediaPath = (fileId: string) => { path: string; name: string } | null

/** Where a passage came from (ADR-0040): the page, linked to the PDF when the export includes it. */
function pageOf(fileId: string, page: number, media: MediaPath): string {
  const file = media(fileId)
  return file ? `page ${page} of [${escape(file.name)}](${encodeURI(file.path)}#page=${page})` : `page ${page} of a PDF not included in this export`
}

/**
 * One card as Markdown; `media` gives the archive path of a file the card uses, or null when it is not included. A
 * card made from a PDF ends with the page it came from.
 */
export function cardToMarkdown(type: CardType, content: unknown, media: MediaPath): string {
  const body = cardBody(type, content, media)
  const anchor = cardAnchor(content)
  return anchor && body ? `${body}\n\n_From ${pageOf(anchor.fileId, anchor.page, media)}_` : body
}

export interface HighlightForMarkdown {
  fileId: string
  page: number
  kind: 'TEXT' | 'AREA'
  color: string
  quote: string | null
  comment: string | null
}

/** The highlights of a note (ADR-0040) as a Markdown section, one list per PDF in page order; empty when there are none. */
export function highlightsToMarkdown(highlights: HighlightForMarkdown[], media: MediaPath): string {
  if (!highlights.length) return ''
  const byFile = new Map<string, HighlightForMarkdown[]>()
  for (const h of highlights) byFile.set(h.fileId, [...(byFile.get(h.fileId) ?? []), h])
  const sections = [...byFile].map(([fileId, list]) => {
    const file = media(fileId)
    const name = file?.name ?? 'A PDF not included in this export'
    const at = (page: number) => (file ? `[page ${page}](${encodeURI(file.path)}#page=${page})` : `page ${page}`)
    const lines = list
      .sort((a, b) => a.page - b.page)
      .map((h) => {
        const what = h.kind === 'AREA' ? '(an area of the page)' : `“${escape((h.quote ?? '').replace(/\s+/g, ' ').trim())}”`
        return `- ${at(h.page)}, ${h.color.toLowerCase()}: ${what}${h.comment ? ` — ${escape(h.comment.replace(/\s+/g, ' '))}` : ''}`
      })
    return `### ${escape(name)}\n\n${lines.join('\n')}`
  })
  return `## Highlights\n\n${sections.join('\n\n')}`
}

function cardBody(type: CardType, content: unknown, media: MediaPath): string {
  const c = content as Any
  switch (type) {
    case 'text':
      return docToMarkdown(c.doc)
    case 'heading':
      return `${'#'.repeat(Math.min(Number(c.level) + 1, 6))} ${inlineToMarkdown(c.content)}`
    case 'quote':
      return quoted(docToMarkdown(c.doc) + (c.attribution ? `\n\n— ${c.attribution}` : ''))
    case 'callout':
      return quoted(`[!${String(c.variant ?? 'note').toUpperCase()}]${c.title ? ` ${c.title}` : ''}\n${docToMarkdown(c.doc)}`)
    case 'checklist':
      return (c.items as { checked: boolean; content: Inline }[]).map((i) => `- [${i.checked ? 'x' : ' '}] ${inlineToMarkdown(i.content)}`).join('\n')
    case 'code':
      return `\`\`\`${c.language ?? ''}\n${c.code}\n\`\`\``
    case 'markdown':
      return String(c.source)
    case 'diagram':
      return `\`\`\`mermaid\n${c.source}\n\`\`\`${c.caption ? `\n\n_${inlineToMarkdown(c.caption)}_` : ''}`
    case 'table': {
      const rows = c.rows as Inline[][]
      if (!rows.length) return ''
      const width = Math.max(...rows.map((r) => r.length))
      const line = (r: Inline[]) => `| ${Array.from({ length: width }, (_, i) => cell(r[i] ?? [])).join(' | ')} |`
      const [head, ...body] = c.hasHeaderRow ? rows : [Array.from({ length: width }, () => [] as Inline), ...rows]
      return [line(head!), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`, ...body.map(line)].join('\n')
    }
    case 'question':
      return `**Question:** ${docToMarkdown(c.prompt)}\n\n**Answer:** ${docToMarkdown(c.answer)}${c.hint ? `\n\n**Hint:** ${docToMarkdown(c.hint)}` : ''}`
    case 'quiz':
      return `**Quiz:** ${docToMarkdown(c.question)}\n\n${(c.choices as { id: string; content: Inline }[]).map((ch) => `- [${(c.correct as string[]).includes(ch.id) ? 'x' : ' '}] ${inlineToMarkdown(ch.content)}`).join('\n')}`
    case 'flashcard':
      return `**Front:** ${docToMarkdown(c.front)}\n\n**Back:** ${docToMarkdown(c.back)}`
    case 'image':
    case 'video':
    case 'audio':
    case 'file': {
      const file = media(String(c.fileId))
      const caption = c.caption ? inlineToMarkdown(c.caption) : ''
      if (!file) return `_(${type} not included in this export)_`
      const link = type === 'image' ? `![${escape(c.alt ?? '')}](${encodeURI(file.path)})` : `[${escape(file.name)}](${encodeURI(file.path)})`
      return caption ? `${link}\n\n_${caption}_` : link
    }
    default:
      return ''
  }
}
