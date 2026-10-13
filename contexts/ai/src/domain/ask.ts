/**
 * Ask AI's pure steps (§10.2, ADR-0060): a note's cards as passages, the rerank that keeps the best of the retrieved
 * chunks, and the sources an answer cites.
 */

/** Chunks retrieved, and kept for the model */
export const ASK_CANDIDATES = 40
export const ASK_SOURCES = 8
/** At most this many of one note's chunks among the kept, so one long note does not crowd out the rest */
export const PER_NOTE = 3
export const PASSAGE_CHARS = 2000
export const QUESTION_CHARS = 1000
/** Shown from each source */
export const SNIPPET_CHARS = 240

export interface Passage {
  noteId: string
  /** null: the draft (this note, asked by its owner or an editor) */
  versionId: string | null
  title: string
  public: boolean
  cardIds: string[]
  text: string
  /** Cosine similarity to the question, when it came from the vector search */
  similarity?: number
}

export interface AnswerSource {
  n: number
  noteId: string
  title: string
  versionId: string | null
  cardIds: string[]
  snippet: string
}

/** One note's cards as passages of about PASSAGE_CHARS, in order; a longer card is cut at a space. */
export function passagesOf(cards: { id: string; text: string }[], size = PASSAGE_CHARS): { cardIds: string[]; text: string }[] {
  const out: { cardIds: string[]; text: string }[] = []
  let current: { cardIds: string[]; text: string } | null = null
  const push = (id: string, text: string) => {
    if (current && current.text.length + text.length + 2 > size) {
      out.push(current)
      current = null
    }
    current = current ? { cardIds: current.cardIds.includes(id) ? current.cardIds : [...current.cardIds, id], text: `${current.text}\n\n${text}` } : { cardIds: [id], text }
  }
  for (const card of cards) {
    let rest = card.text.trim()
    while (rest.length > size) {
      const cut = rest.lastIndexOf(' ', size) > size / 2 ? rest.lastIndexOf(' ', size) : size
      push(card.id, rest.slice(0, cut).trim())
      rest = rest.slice(cut).trim()
    }
    if (rest) push(card.id, rest)
  }
  if (current) out.push(current)
  return out
}

const STOP = new Set('the and for are but not you all any can had her was one our out has have his how its may new now see two who did get him let say she too use what when where which while with this that from they them then there these those your about into than been were will would could should does each other some such only also just more most very what why how'.split(' '))

/** The question's words that carry meaning: lowercased, three letters or more, without common words. */
export function termsOf(text: string): string[] {
  return [...new Set((text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((w) => !STOP.has(w)))]
}

/**
 * The passages worth sending, best first: the vector similarity blended with how many of the question's words each
 * holds (a stand-in for a cross-encoder, ADR-0060), at most PER_NOTE per note. Passages without a similarity (one
 * note's own) rank by words, then keep their order.
 */
export function rerank<T extends Passage>(question: string, passages: T[], keep = ASK_SOURCES, perNote = PER_NOTE): T[] {
  const terms = termsOf(question)
  const scored = passages.map((p, i) => {
    const words = new Set(termsOf(p.text))
    const lexical = terms.length ? terms.filter((t) => words.has(t)).length / terms.length : 0
    const score = p.similarity === undefined ? lexical : 0.75 * p.similarity + 0.25 * lexical
    return { p, i, score }
  })
  scored.sort((a, b) => b.score - a.score || a.i - b.i)
  const perNoteCount = new Map<string, number>()
  const kept: T[] = []
  for (const { p } of scored) {
    const n = perNoteCount.get(p.noteId) ?? 0
    if (n >= perNote) continue
    perNoteCount.set(p.noteId, n + 1)
    kept.push(p)
    if (kept.length >= keep) break
  }
  return kept
}

/** The numbered passages as the prompt shows them. */
export function sourcesBlock(passages: Passage[]): string {
  return passages.map((p, i) => `[${i + 1}] ${p.title || 'Untitled note'}\n${p.text}`).join('\n\n')
}

/** The sources an answer cites by number ([2], [1][3]); the first three when it cites none. */
export function citedSources(answer: string, passages: Passage[]): AnswerSource[] {
  const cited = new Set([...answer.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1])).filter((n) => n >= 1 && n <= passages.length))
  const numbers = cited.size ? [...cited].sort((a, b) => a - b) : passages.slice(0, 3).map((_, i) => i + 1)
  return numbers.map((n) => {
    const p = passages[n - 1]!
    const snippet = p.text.length > SNIPPET_CHARS ? `${p.text.slice(0, SNIPPET_CHARS).replace(/\s+\S*$/, '')}…` : p.text
    return { n, noteId: p.noteId, title: p.title, versionId: p.versionId, cardIds: p.cardIds, snippet }
  })
}
