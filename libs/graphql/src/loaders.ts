import DataLoader from 'dataloader'

const perRequest = new WeakMap<object, Map<string, DataLoader<unknown, unknown>>>()

/**
 * A DataLoader that lives for one request (§6.2: every nested field that hits the database goes through one), so
 * batched reads never serve one viewer's data to another. `context` is the GraphQL context object; `key` names the
 * loader; `batch` returns one result per key, in order.
 */
export function requestLoader<K, V>(context: object, key: string, batch: (keys: readonly K[]) => Promise<(V | Error)[]>): DataLoader<K, V> {
  let loaders = perRequest.get(context)
  if (!loaders) perRequest.set(context, (loaders = new Map()))
  let loader = loaders.get(key) as DataLoader<K, V> | undefined
  if (!loader) {
    loader = new DataLoader<K, V>(batch, { maxBatchSize: 500 })
    loaders.set(key, loader as DataLoader<unknown, unknown>)
  }
  return loader
}

/** Orders `rows` by `keys`, with `fallback` for keys that have no row. */
export function byKeys<K, R>(keys: readonly K[], rows: readonly R[], keyOf: (row: R) => K, fallback: R | null = null): (R | null)[] {
  const map = new Map(rows.map((r) => [keyOf(r), r]))
  return keys.map((k) => map.get(k) ?? fallback)
}
