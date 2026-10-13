import type { SafeFetcher } from '@lvn-backend/safe-fetch'

/** A book as Open Library describes it, cut to what a resource keeps. */
export interface OpenLibraryBook {
  title: string
  author: string | null
  description: string | null
  /** Open Library's cover picture, large */
  coverUrl: string | null
  /** The book's page on Open Library, which people can open */
  pageUrl: string
}

type Json = Record<string, unknown>
const text = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v : v && typeof v === 'object' && typeof (v as Json).value === 'string' ? ((v as Json).value as string) : null
  const t = s?.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : null
}

/**
 * Books by ISBN from Open Library (ADR-0074): no key, one request at a time, each through the safe fetcher (which
 * names LearnViaNotes in its User-Agent, as Open Library asks). The edition, its first three authors and, when the
 * edition has none, its work's description.
 */
export class OpenLibrary {
  constructor(
    private readonly fetcher: SafeFetcher,
    private readonly base: string,
    private readonly covers: string | null,
  ) {}

  private async json(path: string): Promise<Json | null> {
    try {
      const res = await this.fetcher.fetch({ url: `${this.base}${path}`, accept: 'application/json', maxBytes: 512 * 1024, types: /^application\/json$/ })
      const body = JSON.parse(res.body.toString('utf8')) as unknown
      return body && typeof body === 'object' ? (body as Json) : null
    } catch {
      return null
    }
  }

  /** null when Open Library does not know the ISBN or does not answer. */
  async byIsbn(isbn: string): Promise<OpenLibraryBook | null> {
    const edition = await this.json(`/isbn/${isbn}.json`)
    const title = text(edition?.title, 200)
    if (!edition || !title) return null
    const subtitle = text(edition.subtitle, 200)
    const names: string[] = []
    for (const a of (Array.isArray(edition.authors) ? edition.authors : []).slice(0, 3) as Json[]) {
      const key = typeof a?.key === 'string' && /^\/authors\/OL\d+A$/.test(a.key) ? a.key : null
      const name = key ? text((await this.json(`${key}.json`))?.name, 100) : null
      if (name) names.push(name)
    }
    let description = text(edition.description, 2_000)
    const work = (Array.isArray(edition.works) ? edition.works[0] : null) as Json | null
    if (!description && typeof work?.key === 'string' && /^\/works\/OL\d+W$/.test(work.key)) description = text((await this.json(`${work.key}.json`))?.description, 2_000)
    const cover = Array.isArray(edition.covers) ? edition.covers.find((c) => typeof c === 'number' && c > 0) : undefined
    return {
      title: subtitle ? `${title}: ${subtitle}`.slice(0, 200) : title,
      author: names.length ? names.join(', ').slice(0, 200) : null,
      description,
      coverUrl: this.covers && cover ? `${this.covers}/b/id/${cover}-L.jpg` : null,
      pageUrl: `${this.base}/isbn/${isbn}`,
    }
  }
}
