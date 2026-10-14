/** What a page says about itself in its head: OpenGraph first, then the plain tags. */
export interface PageMeta {
  title: string | null
  description: string | null
  /** Absolute http(s) address of the page's picture */
  image: string | null
  siteName: string | null
  /** og:type, e.g. book, website, video.other */
  type: string | null
  /** book:isbn, when the page names one */
  isbn: string | null
  /** book:author or the author meta tag, when it is a name rather than an address */
  author: string | null
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

const clean = (s: string | undefined, max: number): string | null => {
  const v = s === undefined ? '' : decode(s).replace(/\s+/g, ' ').trim()
  return v ? v.slice(0, max) : null
}

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1]!.toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? ''
  }
  return out
}

function absolute(href: string | undefined, base: string): string | null {
  if (!href) return null
  try {
    const url = new URL(decode(href.trim()), base)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * Reads the title, description, picture, site name, type, ISBN and author a page gives in its `<head>`. Only the head
 * is read, and only tags: no script runs and nothing else is fetched.
 */
export function readPageMeta(html: string, pageUrl: string): PageMeta {
  const head = html.slice(0, Math.max(html.search(/<\/head\s*>/i), 0) || 200_000)
  const meta = new Map<string, string>()
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(m[0])
    const key = (a.property ?? a.name ?? a.itemprop ?? '').toLowerCase()
    if (key && a.content !== undefined && !meta.has(key)) meta.set(key, a.content)
  }
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1]
  const author = clean(meta.get('book:author') ?? meta.get('author'), 200)
  return {
    title: clean(meta.get('og:title') ?? meta.get('twitter:title') ?? title, 200),
    description: clean(meta.get('og:description') ?? meta.get('twitter:description') ?? meta.get('description'), 2_000),
    image: absolute(meta.get('og:image:secure_url') ?? meta.get('og:image') ?? meta.get('og:image:url') ?? meta.get('twitter:image'), pageUrl),
    siteName: clean(meta.get('og:site_name') ?? meta.get('application-name'), 200),
    type: clean(meta.get('og:type'), 60)?.toLowerCase() ?? null,
    isbn: clean(meta.get('book:isbn'), 20),
    // A link to a profile page is not a name.
    author: author && !/^https?:\/\//i.test(author) ? author : null,
  }
}

/** A meta tag's content by its name, from the page's head; null when the head has none. */
export function readMetaTag(html: string, name: string): string | null {
  const head = html.slice(0, Math.max(html.search(/<\/head\s*>/i), 0) || 200_000)
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(m[0])
    if ((a.name ?? '').toLowerCase() === name.toLowerCase() && a.content !== undefined) return decode(a.content).trim()
  }
  return null
}

/**
 * A page's words as a reader sees them: scripts, styles and markup gone, entities decoded, white space collapsed, cut
 * to `max` characters. Nothing runs and nothing else is fetched.
 */
export function readPageText(html: string, max: number): string {
  const body = html
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  return decode(body)
    .split('\n')
    .map((l) => l.replace(/[ \t\f\v\u00a0]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max)
}
