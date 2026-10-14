import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { CardType } from '@lvn/contracts/domain'
import type { NewCard, PageVision } from '@lvn-backend/facades'
import { mendEscapes } from '../domain/escapes'
import { doc, inline, valid } from '../domain/tasks'
import { AiGateway } from './ai-gateway'

/** What the model may answer for a page: blocks that map onto our card types (ADR-0063). */
const block = z.object({
  kind: z.enum(['heading', 'paragraph', 'list', 'formula', 'table', 'code']),
  text: z.string(),
  level: z.number().int().min(1).max(3).optional(),
  items: z.array(z.string()).optional(),
  ordered: z.boolean().optional(),
  rows: z.array(z.array(z.string())).optional(),
  language: z.string().optional(),
})
export const pageSchema = z.object({ blocks: z.array(block).max(200) })

/** The cards a page's blocks become, checked against their card types. */
export function blocksToCards(blocks: z.infer<typeof block>[]): NewCard[] {
  const cards = blocks.flatMap((b): NewCard[] => {
    switch (b.kind) {
      case 'heading':
        return b.text.trim() ? [{ type: CardType.HEADING, content: { level: b.level ?? 2, content: inline(b.text) } }] : []
      case 'paragraph':
        return b.text.trim() ? [{ type: CardType.TEXT, content: { doc: doc(b.text) } }] : []
      case 'list': {
        const items = (b.items?.length ? b.items : b.text.split('\n')).map((i) => i.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean)
        return items.length ? [{ type: CardType.MARKDOWN, content: { source: items.map((i, n) => `${b.ordered ? `${n + 1}.` : '-'} ${i}`).join('\n') } }] : []
      }
      case 'formula':
        // As the converter writes formulas (docling-cards): display maths in a Markdown card.
        return b.text.trim() ? [{ type: CardType.MARKDOWN, content: { source: `$$\n${b.text.trim()}\n$$` } }] : []
      case 'table': {
        const rows = (b.rows ?? []).filter((r) => r.length)
        const width = Math.max(0, ...rows.map((r) => r.length))
        return rows.length ? [{ type: CardType.TABLE, content: { hasHeaderRow: true, rows: rows.map((r) => Array.from({ length: width }, (_, i) => inline(r[i] ?? ''))) } }] : []
      }
      case 'code':
        return b.text.trim() ? [{ type: CardType.CODE, content: { language: (b.language ?? '').toLowerCase().replace(/[^a-z0-9+#.-]/g, ''), code: b.text } }] : []
    }
  })
  return valid(cards)
}

/** The words of a page's blocks, to compare with the OCR's. */
export const blocksText = (blocks: z.infer<typeof block>[]) => blocks.map((b) => [b.text, ...(b.items ?? []), ...(b.rows ?? []).flat()].join(' ')).join('\n')

/** Symbols the model writes as LaTeX in ordinary text, as the characters they are. */
const SYMBOLS: Record<string, string> = {
  rightarrow: '→', to: '→', leftarrow: '←', Rightarrow: '⇒', Leftarrow: '⇐', leftrightarrow: '↔', uparrow: '↑', downarrow: '↓',
  cdot: '·', times: '×', div: '÷', pm: '±', approx: '≈', neq: '≠', ne: '≠', le: '≤', leq: '≤', ge: '≥', geq: '≥', infty: '∞',
  degree: '°', circ: '°', quad: ' ', qquad: ' ', ldots: '…', dots: '…', bullet: '•', checkmark: '✓', star: '★',
}

/**
 * Words with the LaTeX a model slips into ordinary text made plain (ADR-0086): `$\rightarrow$` becomes →, `$\text{8 km}$`
 * becomes 8 km. A backslash the model failed to escape in its JSON (`\t` of `\text` read as a tab) is mended first
 * (mendEscapes).
 * Real mathematics (powers, fractions, anything else) is left as it is.
 */
export function plainSymbols(text: string): string {
  return mendEscapes(text).replace(/\$([^$\n]{1,120})\$/g, (whole, inner: string) => {
    const plain = inner
      .replace(/\\(?:text|mathrm|textbf|mathbf)\{([^{}]*)\}/g, '$1')
      .replace(/\\([A-Za-z]+)\s?/g, (cmd, name: string) => SYMBOLS[name] ?? cmd)
      .replace(/\s+/g, ' ')
      .trim()
    return /[\\^_{}]/.test(plain) ? whole : plain
  })
}

/** A page's blocks as Markdown, for the model to read again: a quick note of many photos (ADR-0084). */
export const blocksMarkdown = (blocks: z.infer<typeof block>[]) =>
  blocks
    .map((b) => {
      switch (b.kind) {
        case 'heading':
          return `${'#'.repeat(b.level ?? 2)} ${plainSymbols(b.text)}`
        case 'list':
          return (b.items?.length ? b.items : b.text.split('\n')).map((i, n) => `${b.ordered ? `${n + 1}.` : '-'} ${plainSymbols(i.trim())}`).join('\n')
        case 'formula':
          return `$$${b.text.trim()}$$`
        case 'table':
          return (b.rows ?? []).map((r) => `| ${r.map(plainSymbols).join(' | ')} |`).join('\n')
        case 'code':
          return `\`\`\`${b.language ?? ''}\n${b.text}\n\`\`\``
        default:
          return plainSymbols(b.text)
      }
    })
    .filter((s) => s.trim())
    .join('\n\n')

/**
 * The PAGE_VISION facade (stage 4 of ADR-0028, ADR-0063): a PDF page image read by the vision model, verbatim, as the
 * platform's work. The page is the person's own material, so only providers that may receive private data see it.
 */
@Injectable()
export class AiPageVision implements PageVision {
  constructor(private readonly gateway: AiGateway) {}

  async available(): Promise<boolean> {
    return (await this.gateway.status()).available
  }

  async read(png: string): Promise<{ cards: NewCard[]; text: string }> {
    const out = await this.gateway.generate({ task: 'READ_PAGE', userId: null, private: true, prompt: 'read-page', images: [png], schema: pageSchema, temperature: 0 })
    return { cards: blocksToCards(out.output.blocks), text: blocksText(out.output.blocks) }
  }
}
