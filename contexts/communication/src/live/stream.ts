/**
 * An async iterator fed by pushes, for one subscription: graphql-ws reads it, `return()` (the client stopped, the
 * socket closed) ends it and runs `onEnd`. A slow reader keeps at most `limit` events; older ones are dropped, since
 * each event only says "refetch".
 */
export class PushStream<T> implements AsyncIterableIterator<T> {
  private queue: T[] = []
  private waiting?: (result: IteratorResult<T>) => void
  private ended = false

  constructor(
    private readonly onEnd: () => void,
    private readonly limit = 50,
  ) {}

  push(value: T): void {
    if (this.ended) return
    if (this.waiting) {
      const resolve = this.waiting
      this.waiting = undefined
      resolve({ value, done: false })
      return
    }
    this.queue.push(value)
    if (this.queue.length > this.limit) this.queue.shift()
  }

  next(): Promise<IteratorResult<T>> {
    if (this.queue.length) return Promise.resolve({ value: this.queue.shift()!, done: false })
    if (this.ended) return Promise.resolve({ value: undefined, done: true })
    return new Promise((resolve) => (this.waiting = resolve))
  }

  return(): Promise<IteratorResult<T>> {
    if (!this.ended) {
      this.ended = true
      this.queue = []
      this.waiting?.({ value: undefined, done: true })
      this.waiting = undefined
      this.onEnd()
    }
    return Promise.resolve({ value: undefined, done: true })
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<T> {
    return this
  }
}
