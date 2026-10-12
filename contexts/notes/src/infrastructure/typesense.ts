/** A Typesense answer that was not a success, or no answer in time (ADR-0055). */
export class TypesenseError extends Error {
  override name = 'TypesenseError'
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
  }
}

export interface TypesenseField {
  name: string
  type: 'string' | 'string[]' | 'int32' | 'int64' | 'bool'
  facet?: boolean
  optional?: boolean
  index?: boolean
  stem?: boolean
  sort?: boolean
}

export interface TypesenseSchema {
  name: string
  fields: TypesenseField[]
  default_sorting_field?: string
  token_separators?: string[]
}

export interface TypesenseHit<D> {
  document: D
  highlights?: { field: string; snippet?: string }[]
  text_match?: number
}

export interface TypesenseResult<D> {
  found: number
  hits: TypesenseHit<D>[]
}

/**
 * The few calls of Typesense's HTTP API that search needs (ADR-0055), over fetch: no client library, every call with
 * a deadline. The admin key stays on the server.
 */
export class Typesense {
  constructor(
    private readonly url: string,
    private readonly apiKey: string,
  ) {}

  async request<T>(method: string, path: string, body?: unknown, timeoutMs = 10_000): Promise<T> {
    const raw = typeof body === 'string'
    let res: Response
    try {
      res = await fetch(`${this.url.replace(/\/$/, '')}${path}`, {
        method,
        headers: { 'X-TYPESENSE-API-KEY': this.apiKey, 'Content-Type': raw ? 'text/plain' : 'application/json' },
        body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (e) {
      throw new TypesenseError(`${method} ${path.split('?')[0]}: ${(e as Error).name === 'TimeoutError' ? `no answer in ${timeoutMs} ms` : (e as Error).message}`)
    }
    const text = await res.text()
    if (!res.ok) throw new TypesenseError(`${method} ${path.split('?')[0]}: ${res.status} ${text.slice(0, 200)}`, res.status)
    // Imports and exports answer one JSON object per line.
    return (/\/documents\/(import|export)/.test(path) ? text : text && JSON.parse(text)) as T
  }

  async collections(): Promise<string[]> {
    return (await this.request<{ name: string }[]>('GET', '/collections')).map((c) => c.name)
  }

  createCollection(schema: TypesenseSchema): Promise<unknown> {
    return this.request('POST', '/collections', schema)
  }

  async deleteCollection(name: string): Promise<void> {
    await this.request('DELETE', `/collections/${encodeURIComponent(name)}`).catch((e: TypesenseError) => {
      if (e.status !== 404) throw e
    })
  }

  /** The collection an alias points at, or null. */
  async alias(name: string): Promise<string | null> {
    try {
      return (await this.request<{ collection_name: string }>('GET', `/aliases/${encodeURIComponent(name)}`)).collection_name
    } catch (e) {
      if ((e as TypesenseError).status === 404) return null
      throw e
    }
  }

  async setAlias(name: string, collection: string): Promise<void> {
    await this.request('PUT', `/aliases/${encodeURIComponent(name)}`, { collection_name: collection })
  }

  async setStopwords(id: string, stopwords: readonly string[]): Promise<void> {
    await this.request('PUT', `/stopwords/${encodeURIComponent(id)}`, { stopwords, locale: 'en' })
  }

  /** Writes documents (insert or replace), failing if any line failed. */
  async upsert(collection: string, documents: object[]): Promise<void> {
    if (!documents.length) return
    const lines = documents.map((d) => JSON.stringify(d)).join('\n')
    const out = await this.request<string>('POST', `/collections/${encodeURIComponent(collection)}/documents/import?action=upsert`, lines, 60_000)
    const failed = out
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { success: boolean; error?: string })
      .find((r) => !r.success)
    if (failed) throw new TypesenseError(`import into ${collection}: ${failed.error ?? 'failed'}`)
  }

  async remove(collection: string, ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i += 100) {
      const filter = `id:[${ids.slice(i, i + 100).map(quote).join(',')}]`
      await this.request('DELETE', `/collections/${encodeURIComponent(collection)}/documents?filter_by=${encodeURIComponent(filter)}`).catch((e: TypesenseError) => {
        if (e.status !== 404) throw e
      })
    }
  }

  /** Every document id in a collection. */
  async ids(collection: string): Promise<string[]> {
    const out = await this.request<string>('GET', `/collections/${encodeURIComponent(collection)}/documents/export?include_fields=id`, undefined, 120_000)
    return out
      .split('\n')
      .filter(Boolean)
      .map((l) => (JSON.parse(l) as { id: string }).id)
  }

  /** Several searches in one request; the filters travel in the body, so long ones are fine. */
  async multiSearch<D>(searches: Record<string, unknown>[], timeoutMs: number): Promise<TypesenseResult<D>[]> {
    const out = await this.request<{ results: (TypesenseResult<D> & { code?: number; error?: string })[] }>('POST', '/multi_search', { searches }, timeoutMs)
    for (const r of out.results) if (r.error) throw new TypesenseError(`search: ${r.code ?? ''} ${r.error}`, r.code)
    return out.results
  }
}

/** A filter value: backquoted, so a value never reads as filter syntax (Typesense escapes ` inside with \`). */
export const quote = (value: string): string => '`' + value.replace(/`/g, '\\`') + '`'
