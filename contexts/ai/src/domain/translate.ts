/**
 * Translating a note (ADR-0086). The local model copies text rather than translate it when it must answer in JSON or
 * is given more than it can hold, so a translation is asked in plain text, piece by piece, and each piece is checked to
 * be in the language's script.
 */

/** The most of a note one request translates: with its translation, well inside a 4,096-token context. */
export const TRANSLATE_PIECE_CHARS = 1_500
/** A piece whose letters are less than this share in the language's script is asked again. */
export const MIN_SCRIPT_SHARE = 0.5

/** Each language's script (the languages of AiLanguage in ./tasks). */
const SCRIPT = { ENGLISH: /[A-Za-z]/gu, HINDI: /[ऀ-ॿ]/gu, TELUGU: /[ఀ-౿]/gu }

/**
 * The share of a text's letters written in the language's script, leaving out code, formulas and links, which stay
 * as they are. Null when there are too few letters to tell.
 */
export function scriptShare(text: string, language: keyof typeof SCRIPT): number | null {
  const words = text.replace(/```[\s\S]*?```/g, ' ').replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g, ' ').replace(/https?:\/\/\S+/g, ' ')
  const letters = (words.match(/[\p{L}\p{M}]/gu) ?? []).length
  if (letters < 20) return null
  return (words.match(SCRIPT[language]) ?? []).length / letters
}

/** A note's text in pieces of at most `max` characters, split between paragraphs, then lines, then sentences. */
export function pieces(text: string, max = TRANSLATE_PIECE_CHARS): string[] {
  const out: string[] = []
  let current = ''
  const add = (part: string, joiner: string) => {
    if (!current) current = part
    else if (current.length + joiner.length + part.length <= max) current += joiner + part
    else {
      out.push(current)
      current = part
    }
  }
  for (const paragraph of text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    if (paragraph.length <= max) {
      add(paragraph, '\n\n')
      continue
    }
    for (const line of paragraph.split('\n')) {
      if (line.length <= max) add(line, '\n')
      else for (const sentence of line.match(new RegExp(`[^.!?।]{1,${max}}[.!?।]*\\s*`, 'g')) ?? [line]) add(sentence.trim(), ' ')
    }
  }
  if (current) out.push(current)
  return out
}

/** A translation's title (its first line, written "# Title") and the rest. */
export function titled(translation: string): { title: string; text: string } {
  const clean = translation.replace(/<\/?content>/g, '').trim()
  const first = /^#\s+(.+)\n?/.exec(clean)
  return first ? { title: first[1]!.trim(), text: clean.slice(first[0].length).trim() } : { title: '', text: clean }
}
