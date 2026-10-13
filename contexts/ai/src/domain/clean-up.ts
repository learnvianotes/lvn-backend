/**
 * AI clean-up of a converted note (stage 6 of ADR-0028, ADR-0063): the model mends only what conversion broke, and each
 * change it proposes is checked here before the person sees it. A change that drops words or brings new ones in is a
 * rewrite, not a repair, and is left out.
 */

/** One card's words, as the model would leave them; `before` is what the card says now. */
export interface TextChange {
  cardId: string
  before: string
  after: string
}

/** Cards go to the model in batches of about this many characters. */
export const CLEAN_UP_BATCH = 6_000
/** The most of a note clean-up reads; the rest is left as it is, and the person is told. */
export const CLEAN_UP_CHARS = 48_000
/** A change keeps at least this share of the card's letters and digits (stray page numbers and headers are few). */
export const KEEPS_AT_LEAST = 0.7
/** It may add at most this share to them (a misread character, a word put back together). */
export const GROWS_AT_MOST = 1.1
/** At least this share of its words (three letters or more) must be found in what the card said. */
export const OWN_WORDS_AT_LEAST = 0.8

const compact = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
const words = (text: string) => (text.toLowerCase().match(/[\p{L}\p{M}]{3,}/gu) ?? [])

/** Whether two words are at most `max` edits apart (a misread character or two). */
function near(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false
  let row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    if (Math.min(...next) > max) return false
    row = next
  }
  return row[b.length]! <= max
}

/**
 * Whether a proposed change is a repair: it differs, keeps nearly all the card's letters, and its words are the card's
 * own. A word joined from a hyphenated split (`conver- sion`) is found in the card's letters run together; a misread
 * one (`tbe` for `the`) is a character or two from one of the card's words.
 */
export function isRepair(before: string, after: string): boolean {
  if (!after.trim() || after.replace(/\s+/g, ' ').trim() === before.replace(/\s+/g, ' ').trim()) return false
  const was = compact(before)
  const now = compact(after)
  if (!was.length || now.length < was.length * KEEPS_AT_LEAST || now.length > was.length * GROWS_AT_MOST) return false
  const theirs = words(after)
  if (!theirs.length) return true
  const own = [...new Set(words(before))]
  const isOwn = (w: string) => was.includes(compact(w)) || own.some((o) => near(o, w, w.length >= 8 ? 2 : 1))
  return theirs.filter(isOwn).length / theirs.length >= OWN_WORDS_AT_LEAST
}

/** Cards in reading order, in batches of about CLEAN_UP_BATCH characters, at most CLEAN_UP_CHARS in all. */
export function batches<T extends { text: string }>(cards: T[]): { batches: T[][]; cut: boolean } {
  const out: T[][] = []
  let size = 0
  let total = 0
  for (const [i, card] of cards.entries()) {
    if (total + card.text.length > CLEAN_UP_CHARS) return { batches: out, cut: i < cards.length }
    if (!out.length || size + card.text.length > CLEAN_UP_BATCH) {
      out.push([])
      size = 0
    }
    out.at(-1)!.push(card)
    size += card.text.length
    total += card.text.length
  }
  return { batches: out, cut: false }
}

/** A batch as the model reads it: each card's words under its number. */
export const batchText = (cards: { text: string }[]) => cards.map((c, i) => `[[${i + 1}]]\n${c.text}`).join('\n\n')
