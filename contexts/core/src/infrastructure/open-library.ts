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
 * names LearnViaNotes in its User-Agent, as Open Library asks). The edition, and its work for the authors and the
 * description when the edition lacks them; at most three authors.
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

  /** `/authors/OL…A` keys from an edition's `[{ key }]` or a work's `[{ author: { key } }]`. */
  private authorKeys(list: unknown): string[] {
    if (!Array.isArray(list)) return []
    return list.flatMap((a: Json) => {
      const key = (a?.key ?? (a?.author as Json | undefined)?.key) as unknown
      return typeof key === 'string' && /^\/authors\/OL\d+A$/.test(key) ? [key] : []
    })
  }

  /** null when Open Library does not know the ISBN or does not answer. */
  async byIsbn(isbn: string): Promise<OpenLibraryBook | null> {
    const edition = await this.json(`/isbn/${isbn}.json`)
    const title = text(edition?.title, 200)
    if (!edition || !title) return null
    const subtitle = text(edition.subtitle, 200)
    // Authors are on the edition, or often only on its work (as { author: { key } }), which also has the description.
    const work = (Array.isArray(edition.works) ? edition.works[0] : null) as Json | null
    const workKey = typeof work?.key === 'string' && /^\/works\/OL\d+W$/.test(work.key) ? work.key : null
    let description = text(edition.description, 2_000)
    let authorKeys = this.authorKeys(edition.authors)
    if ((!description || !authorKeys.length) && workKey) {
      const w = await this.json(`${workKey}.json`)
      description ??= text(w?.description, 2_000)
      if (!authorKeys.length) authorKeys = this.authorKeys(w?.authors)
    }
    const names: string[] = []
    for (const key of authorKeys.slice(0, 3)) {
      const name = text((await this.json(`${key}.json`))?.name, 100)
      if (name) names.push(name)
    }
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
