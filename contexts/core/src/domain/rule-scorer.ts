import type { ReportReason } from '@lvn/contracts/domain'

/**
 * The rule-based moderation scorer of ADR-0037, until the AI scorer of Phase 5 takes its place behind the same facade.
 * It looks for what rules can see reliably — spam phrases, pages of links, the same text again and again, and the words
 * of a configurable list — and holds such content for a person to review. It never decides alone that content is bad.
 */

export interface WordRule {
  reason: ReportReason
  phrase: string
  pattern: RegExp
}

export interface Verdict {
  flagged: boolean
  reason: ReportReason | null
  /** Why, in words for the author */
  message: string | null
}

const REASONS: ReportReason[] = ['HARASSMENT', 'SEXUAL', 'SELF_HARM', 'HATE', 'SPAM', 'COPYRIGHT', 'OTHER']

/** Phrases that are spam in a study app whatever the subject. */
const BUILT_IN = `
SPAM: buy followers
SPAM: free followers
SPAM: casino bonus
SPAM: crypto giveaway
SPAM: free bitcoin
SPAM: earn money fast
SPAM: click here to win
SPAM: guaranteed returns
SPAM: escort service
`

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A word list: one `REASON: phrase` per line (REASON as in ReportReason), `#` starts a comment. Phrases match whole
 * words, ignoring case. Lines that do not parse are skipped.
 */
export function parseWordList(text: string): WordRule[] {
  return text
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean)
    .flatMap((line) => {
      const m = /^([A-Z_]+)\s*:\s*(.+)$/.exec(line)
      const reason = m?.[1] as ReportReason | undefined
      if (!m || !reason || !REASONS.includes(reason)) return []
      const phrase = m[2]!.trim().toLowerCase()
      return [{ reason, phrase, pattern: new RegExp(`(^|[^\\p{L}\\p{N}])${escape(phrase).replace(/\s+/g, '\\s+')}($|[^\\p{L}\\p{N}])`, 'iu') }]
    })
}

export const builtInWords = (): WordRule[] => parseWordList(BUILT_IN)

const LINK = /\bhttps?:\/\/\S+|\bwww\.\S+/gi
const WORDS: Record<ReportReason, string> = {
  HARASSMENT: 'harassment',
  SEXUAL: 'sexual content',
  SELF_HARM: 'self-harm',
  HATE: 'hate',
  SPAM: 'spam',
  COPYRIGHT: 'copyright',
  OTHER: 'the community rules',
}

export function score(input: { title: string; text: string }, words: WordRule[]): Verdict {
  const all = `${input.title}\n${input.text}`
  const hit = words.find((w) => w.pattern.test(all))
  if (hit) return { flagged: true, reason: hit.reason, message: `it contains words linked to ${WORDS[hit.reason]}.` }

  const links = all.match(LINK)?.length ?? 0
  const wordCount = all.split(/\s+/).filter(Boolean).length
  if (links >= 10 && links * 4 >= wordCount) return { flagged: true, reason: 'SPAM', message: 'it is mostly links.' }

  const lines = all
    .split('\n')
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l.length >= 8)
  if (lines.length >= 8) {
    const counts = new Map<string, number>()
    for (const l of lines) counts.set(l, (counts.get(l) ?? 0) + 1)
    const most = Math.max(...counts.values())
    if (most >= 8 && most * 2 >= lines.length) return { flagged: true, reason: 'SPAM', message: 'the same text repeats many times.' }
  }
  return { flagged: false, reason: null, message: null }
}
