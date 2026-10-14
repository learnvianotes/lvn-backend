import { SafeFetchError, type SafeFetcher } from './fetcher'

type Rule = { allow: boolean; pattern: string }
type Group = { agents: string[]; rules: Rule[] }

/** A site's robots.txt as RFC 9309 reads it: groups of user agents with their allow and disallow rules. */
export function parseRobots(text: string): Group[] {
  const groups: Group[] = []
  let current: Group | null = null
  let readingAgents = false
  for (const raw of text.split(/\r?\n|\r/)) {
    const line = raw.replace(/#.*$/, '').trim()
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line)
    if (!m) continue
    const key = m[1]!.toLowerCase()
    const value = m[2]!.trim()
    if (key === 'user-agent') {
      // Consecutive user-agent lines start one group together.
      if (!readingAgents || !current) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      readingAgents = true
    } else if ((key === 'allow' || key === 'disallow') && current) {
      readingAgents = false
      // An empty disallow allows everything; it adds no rule.
      if (value) current.rules.push({ allow: key === 'allow', pattern: value })
    } else {
      readingAgents = false
    }
  }
  return groups
}

/** A rule's pattern as a regular expression: `*` for any characters, `$` at the end for the end of the path. */
function matcher(pattern: string): RegExp {
  const end = pattern.endsWith('$')
  const body = (end ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${body}${end ? '$' : ''}`)
}

/**
 * Whether `agent` may fetch `path` (with its query) under these rules (RFC 9309): the groups naming the agent, or else
 * the `*` groups; the longest matching rule decides, and allow wins a tie; no matching rule allows.
 */
export function robotsAllows(groups: Group[], agent: string, path: string): boolean {
  const token = agent.toLowerCase()
  const named = groups.filter((g) => g.agents.includes(token))
  const rules = (named.length ? named : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules)
  let best: Rule | null = null
  for (const rule of rules) {
    if (!matcher(rule.pattern).test(path)) continue
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) best = rule
  }
  return best ? best.allow : true
}

/**
 * robots.txt for each site, fetched through the safe fetcher and kept for a day at most (RFC 9309): a page that is not
 * there (4xx) allows everything; a site that cannot answer (5xx, or not reached) allows nothing.
 */
export class RobotsCache {
  private readonly cache = new Map<string, { groups: Group[] | 'ALL' | 'NONE'; until: number }>()

  constructor(
    private readonly fetcher: SafeFetcher,
    private readonly agent: string,
    private readonly ttlMs = 24 * 3_600_000,
  ) {}

  async allows(url: string): Promise<boolean> {
    const target = new URL(url)
    const origin = target.origin
    let entry = this.cache.get(origin)
    if (!entry || entry.until < Date.now()) {
      entry = { groups: await this.load(origin), until: Date.now() + this.ttlMs }
      this.cache.set(origin, entry)
    }
    if (entry.groups === 'ALL') return true
    if (entry.groups === 'NONE') return false
    return robotsAllows(entry.groups, this.agent, `${target.pathname}${target.search}`)
  }

  private async load(origin: string): Promise<Group[] | 'ALL' | 'NONE'> {
    try {
      const res = await this.fetcher.fetch({ url: `${origin}/robots.txt`, accept: 'text/plain', maxBytes: 500_000, types: /.*/ })
      return parseRobots(res.body.toString('utf8'))
    } catch (err) {
      // An address that is never fetched is the caller's answer, not the site's rules.
      if (err instanceof SafeFetchError && (err.code === 'BLOCKED' || err.code === 'INVALID_URL')) throw err
      if (err instanceof SafeFetchError && err.code === 'HTTP' && err.status !== undefined && err.status >= 400 && err.status < 500) return 'ALL'
      return 'NONE'
    }
  }
}
