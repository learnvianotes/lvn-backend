import { PushStream } from '../../src/live/stream'

describe('PushStream', () => {
  it('hands pushed values to the reader in order, waiting when there are none', async () => {
    const stream = new PushStream<number>(() => undefined)
    stream.push(1)
    stream.push(2)
    expect(await stream.next()).toEqual({ value: 1, done: false })
    expect(await stream.next()).toEqual({ value: 2, done: false })
    const waiting = stream.next()
    stream.push(3)
    expect(await waiting).toEqual({ value: 3, done: false })
  })

  it('keeps only the newest values for a slow reader', async () => {
    const stream = new PushStream<number>(() => undefined, 2)
    for (const n of [1, 2, 3, 4]) stream.push(n)
    expect((await stream.next()).value).toBe(3)
    expect((await stream.next()).value).toBe(4)
  })

  it('ends once: a waiting reader finishes, later pushes are ignored, the end is reported', async () => {
    const onEnd = jest.fn()
    const stream = new PushStream<number>(onEnd)
    const waiting = stream.next()
    await stream.return()
    await stream.return()
    expect(await waiting).toEqual({ value: undefined, done: true })
    stream.push(5)
    expect(await stream.next()).toEqual({ value: undefined, done: true })
    expect(onEnd).toHaveBeenCalledTimes(1)
  })
})
