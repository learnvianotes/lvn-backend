import { Errors } from '@lvn-backend/errors'

/** §6.2: Relay-style connections, at most 100 items per page. */
export const MAX_PAGE_SIZE = 100

export interface PageArgs {
  first?: number | null
  after?: string | null
}

export interface Connection<T> {
  edges: { cursor: string; node: T }[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

/** Cursors are opaque to clients: the sort values of the last item, base64url-encoded JSON. */
export const encodeCursor = (values: readonly (string | number | null)[]): string => Buffer.from(JSON.stringify(values)).toString('base64url')

export function decodeCursor(cursor: string | null | undefined, length: number): (string | number | null)[] | null {
  if (!cursor) return null
  try {
    const values = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown
    if (Array.isArray(values) && values.length === length && values.every((v) => v === null || typeof v === 'string' || typeof v === 'number')) return values
  } catch {
    // fall through
  }
  throw Errors.validation('This page link is not valid. Start from the first page.', ['after'])
}

/** The page size asked for, within 1…100 (default 20). */
export function pageSize(first: number | null | undefined, fallback = 20): number {
  if (first === null || first === undefined) return fallback
  if (!Number.isInteger(first) || first < 1 || first > MAX_PAGE_SIZE) throw Errors.validation(`Ask for between 1 and ${MAX_PAGE_SIZE} items.`, ['first'])
  return first
}

/** Builds a connection from `size + 1` fetched rows: the extra row only tells whether another page exists. */
export function connection<R, T>(rows: R[], size: number, cursorOf: (row: R) => readonly (string | number | null)[], toNode: (row: R) => T): Connection<T> {
  const page = rows.slice(0, size)
  const edges = page.map((row) => ({ cursor: encodeCursor(cursorOf(row)), node: toNode(row) }))
  return { edges, pageInfo: { hasNextPage: rows.length > size, endCursor: edges.at(-1)?.cursor ?? null } }
}
