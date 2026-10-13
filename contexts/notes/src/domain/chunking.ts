/**
 * Chunks of a published version for Ask AI and semantic search (§10.2, ADR-0060): the cards' plain text in order, cut
 * into windows of about 500 tokens with about 50 of overlap. A token is taken as four characters, which is close for
 * English and errs short for Hindi and Telugu; cuts fall on a paragraph, sentence or word boundary where one is near.
 */

export interface ChunkSource {
  id: string
  text: string
}

export interface Chunk {
  position: number
  /** The cards the chunk's text comes from, in order */
  cardIds: string[]
  text: string
  tokens: number
}

export const CHUNK_CHARS = 2000
export const OVERLAP_CHARS = 200
const SEPARATOR = '\n\n'

export const tokensOf = (text: string) => Math.ceil(text.length / 4)

/** The best place to end a window in `text` between `min` and `max`: a paragraph, then a sentence, then a space. */
function cutAt(text: string, min: number, max: number): number {
  if (max >= text.length) return text.length
  const window = text.slice(min, max)
  for (const pattern of [/\n\s*\n/g, /[.!?।]\s/g, /\s/g]) {
    let last = -1
    for (const m of window.matchAll(pattern)) last = m.index + m[0].length
    if (last > 0) return min + last
  }
  return max
}

export function chunkCards(cards: ChunkSource[], size = CHUNK_CHARS, overlap = OVERLAP_CHARS): Chunk[] {
  const parts = cards.map((c) => ({ id: c.id, text: c.text.trim() })).filter((c) => c.text)
  if (!parts.length) return []
  // One text, with where each card's words start and end in it.
  const spans: { id: string; start: number; end: number }[] = []
  let text = ''
  for (const p of parts) {
    if (text) text += SEPARATOR
    spans.push({ id: p.id, start: text.length, end: text.length + p.text.length })
    text += p.text
  }
  const chunks: Chunk[] = []
  let start = 0
  while (start < text.length) {
    const end = cutAt(text, start + Math.floor(size * 0.6), start + size)
    const piece = text.slice(start, end).trim()
    if (piece) {
      chunks.push({ position: chunks.length, cardIds: spans.filter((s) => s.start < end && s.end > start).map((s) => s.id), text: piece, tokens: tokensOf(piece) })
    }
    if (end >= text.length) break
    // The next window starts a little before this one ended, on a word boundary, and always moves forward.
    let next = end - overlap
    const space = text.indexOf(' ', next)
    if (space !== -1 && space < end) next = space + 1
    start = Math.max(next, start + 1)
  }
  return chunks
}

/** pgvector's text form of a vector. */
export const toVector = (values: number[]) => `[${values.map((v) => (Number.isFinite(v) ? v : 0)).join(',')}]`
