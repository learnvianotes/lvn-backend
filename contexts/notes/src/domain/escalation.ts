import type { CardType } from '@lvn/contracts/domain'
import { cardPlainText } from '@lvn/contracts/validation'

/**
 * Stage 4 of ADR-0028 (ADR-0063): taking or rejecting the vision model's reading of a page, and putting it in place of
 * the OCR's cards of that page.
 */

/** A reading sharing less than this share of the OCR's words "disagrees sharply" and is rejected */
export const AGREE_AT_LEAST = 0.3
/** The OCR's text is judged by only when the OCR scored at least this ("fair") and has enough words */
export const JUDGE_FROM_OCR = 0.5
export const MIN_WORDS = 8

interface Card {
  type: CardType
  content: unknown
}

const words = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
const pageOf = (card: Card) => (card.content as { anchor?: { page?: number } } | null)?.anchor?.page
/** The page's cards a reading replaces: its words. Its pictures stay; the vision model only transcribes. */
const replaced = (card: Card, page: number) => pageOf(card) === page && card.type !== 'image'

/**
 * Whether a new reading of a page is taken. `ocrScore` is null for a page with a text layer, whose text is
 * trustworthy; a poor OCR score leaves nothing to judge by.
 */
export function acceptReading(ocrText: string, reading: string, ocrScore: number | null): boolean {
  if (!words(reading).size) return false
  const ocr = words(ocrText)
  if ((ocrScore !== null && ocrScore < JUDGE_FROM_OCR) || ocr.size < MIN_WORDS) return true
  const fresh = words(reading)
  const shared = [...ocr].filter((w) => fresh.has(w)).length
  return shared / ocr.size >= AGREE_AT_LEAST
}

/** The words the OCR gave a page. */
export const pageText = (cards: Card[], page: number) =>
  cards
    .filter((c) => replaced(c, page))
    .map((c) => cardPlainText(c.type, c.content))
    .join('\n')

/**
 * The cards with a page's OCR cards replaced by `fresh`, at the place of the first of them (or, when the OCR made none,
 * after the cards of earlier pages). The page's pictures stay where they were. The new cards carry the page's anchor,
 * so the reader still finds them.
 */
export function replacePage<T extends Card>(cards: T[], page: number, fresh: Card[], fileId: string): Card[] {
  const anchored = fresh.map((c) => ({ type: c.type, content: { ...(c.content as object), anchor: { fileId, page } } }))
  const first = cards.findIndex((c) => replaced(c, page))
  if (first >= 0) return [...cards.slice(0, first), ...anchored, ...cards.slice(first).filter((c) => !replaced(c, page))]
  const kept: Card[] = [...cards]
  let at = 0
  kept.forEach((c, i) => {
    const p = pageOf(c)
    if (p !== undefined && p < page) at = i + 1
  })
  kept.splice(at, 0, ...anchored)
  return kept
}
