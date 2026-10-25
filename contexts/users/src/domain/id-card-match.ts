/**
 * Compares an ID-card reading with the account. The model never receives the account: only the image is sent,
 * and this comparison runs here. The ID number is kept on the request for reviewers and is not put in the reason
 * or in logs.
 */

export type IdCardVerdictName = 'MATCH' | 'MISMATCH' | 'UNREADABLE'

export interface IdCardExtraction {
  name: string | null
  institution: string | null
  idNumber: string | null
  /** ISO date (YYYY-MM-DD) when the card says it stops being valid. Null when it is not printed. */
  validUntil: string | null
  readable: boolean
  /** 0–1 */
  confidence: number
}

export interface IdCardProfile {
  displayName: string
  /** Organisation names the account is linked to, plus any the caller already resolved. */
  institutionNames: string[]
  /** Verified email domains and organisation email domains, lower-cased. */
  domains: string[]
}

export interface IdCardJudgement {
  verdict: IdCardVerdictName
  confidence: number
  reason: string
  extracted: { name: string | null; institution: string | null; idNumber: string | null; validUntil: string | null }
}

const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'professor', 'sri', 'smt'])

export function normName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((part) => part && !TITLES.has(part))
    .join(' ')
}

function levenshtein(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) rows[0]![j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      rows[i]![j] = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost)
    }
  }
  return rows[a.length]![b.length]!
}

function similarity(a: string, b: string): number {
  if (a === b) return 1
  const max = Math.max(a.length, b.length)
  if (!max) return 1
  return 1 - levenshtein(a, b) / max
}

/** True when the two names are the same person, allowing order, titles and small spelling differences. */
export function namesMatch(a: string, b: string): boolean {
  const left = normName(a)
  const right = normName(b)
  if (!left || !right) return false
  if (left === right) return true
  const leftParts = left.split(' ')
  const rightParts = right.split(' ')
  const [shorter, longer] = leftParts.length <= rightParts.length ? [leftParts, new Set(rightParts)] : [rightParts, new Set(leftParts)]
  if (shorter.length >= 2 && shorter.every((part) => longer.has(part))) return true
  const sortedLeft = [...leftParts].sort().join(' ')
  const sortedRight = [...rightParts].sort().join(' ')
  return similarity(left, right) >= 0.84 || similarity(sortedLeft, sortedRight) >= 0.84
}

const ORG_NOISE = new Set(['the', 'of', 'and', 'for', 'at', 'college', 'university', 'institute', 'institution', 'school', 'dept', 'department'])

export function normOrg(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((part) => part && !ORG_NOISE.has(part))
    .join(' ')
}

/** True when the card's institution is one of the account's organisations or email domains. */
export function institutionsMatch(extracted: string | null, names: string[], domains: string[]): boolean {
  if (!extracted) return false
  const card = normOrg(extracted)
  if (card.length < 2) return false
  const compact = card.replace(/ /g, '')
  for (const name of names) {
    const known = normOrg(name)
    if (known.length < 2) continue
    if (card === known || card.includes(known) || known.includes(card)) return true
  }
  for (const domain of domains) {
    const label = domain.split('.')[0]?.replace(/[^a-z0-9]/g, '') ?? ''
    if (label.length >= 3 && (compact.includes(label) || label.includes(compact))) return true
  }
  return false
}

function parseDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const day = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(day.getTime()) ? null : day
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/**
 * One reading against the profile. Several documents are combined by the caller: a match wins over a mismatch,
 * and a mismatch wins over unreadable.
 */
export function judgeIdCard(extraction: IdCardExtraction | null, profile: IdCardProfile, now = new Date()): IdCardJudgement {
  const extracted = {
    name: extraction?.name?.trim().slice(0, 200) || null,
    institution: extraction?.institution?.trim().slice(0, 200) || null,
    idNumber: extraction?.idNumber?.trim().slice(0, 64) || null,
    validUntil: extraction?.validUntil?.trim().slice(0, 32) || null,
  }
  const confidence = clampConfidence(extraction?.confidence ?? 0)
  if (!extraction || !extraction.readable || confidence < 0.2 || (!extracted.name && !extracted.institution)) {
    return { verdict: 'UNREADABLE', confidence, reason: 'The document could not be read as a student ID.', extracted }
  }
  const expiry = parseDay(extracted.validUntil)
  if (expiry && expiry.getTime() < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) {
    return { verdict: 'MISMATCH', confidence, reason: 'The card is past its validity date.', extracted }
  }
  if (!extracted.name || !namesMatch(extracted.name, profile.displayName)) {
    return { verdict: 'MISMATCH', confidence, reason: 'The name on the card does not match the account.', extracted }
  }
  if (!institutionsMatch(extracted.institution, profile.institutionNames, profile.domains)) {
    return { verdict: 'MISMATCH', confidence, reason: 'The institution on the card does not match the account.', extracted }
  }
  return { verdict: 'MATCH', confidence, reason: 'The name and institution match the account.', extracted }
}

/** Prefer a match, then a mismatch, then unreadable. Confidence is the winning reading's. */
export function combineJudgements(judgements: IdCardJudgement[]): IdCardJudgement {
  if (!judgements.length) return judgeIdCard(null, { displayName: '', institutionNames: [], domains: [] })
  const rank = { MATCH: 3, MISMATCH: 2, UNREADABLE: 1 }
  return judgements.reduce((best, next) => (rank[next.verdict] > rank[best.verdict] ? next : rank[next.verdict] === rank[best.verdict] && next.confidence > best.confidence ? next : best))
}

/** Auto-approve is opt-in, match-only, and never rejects. */
export function shouldAutoApprove(input: { enabled: boolean; auto: boolean; threshold: number; verdict: IdCardVerdictName; confidence: number }): boolean {
  if (!input.enabled || !input.auto) return false
  if (input.verdict !== 'MATCH') return false
  const score = Math.round(input.confidence * 100)
  return score >= input.threshold
}
