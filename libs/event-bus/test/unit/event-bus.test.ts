import { InProcessEventBus } from '../../src/event-bus'

const USER = '0199b0a0-0000-7000-8000-000000000001'

describe('InProcessEventBus', () => {
  it('delivers a validated envelope to every subscriber after publish returns', async () => {
    const bus = new InProcessEventBus()
    const seen: unknown[] = []
    bus.subscribe('UserRegistered', (e) => { seen.push(e) })
    bus.subscribe('UserRegistered', (e) => { seen.push(e.payload.userId) })
    await bus.publish('UserRegistered', { userId: USER }, { correlationId: 'req-1' })
    expect(seen).toHaveLength(0)
    await bus.drain()
    expect(seen[0]).toMatchObject({ type: 'UserRegistered', version: 1, correlationId: 'req-1', payload: { userId: USER } })
    expect(seen[1]).toBe(USER)
  })

  it('refuses a payload that breaks the contract', async () => {
    const bus = new InProcessEventBus()
    await expect(bus.publish('UserRegistered', { userId: 'not-a-uuid' })).rejects.toThrow()
  })

  it('keeps going when a subscriber fails', async () => {
    const bus = new InProcessEventBus()
    const ok = jest.fn()
    bus.subscribe('SessionRevoked', () => { throw new Error('boom') })
    bus.subscribe('SessionRevoked', ok)
    await bus.publish('SessionRevoked', { userId: USER, sessionId: USER, family: true })
    await bus.drain()
    expect(ok).toHaveBeenCalledTimes(1)
  })
})
