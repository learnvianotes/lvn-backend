import type { AddressInfo } from 'node:net'
import { startHealthServer } from '../../src/health'

it('answers liveness and 404s anything else', async () => {
  const server = await startHealthServer(0, '127.0.0.1')
  const { port } = server.address() as AddressInfo
  try {
    expect(await (await fetch(`http://127.0.0.1:${port}/health/live`)).json()).toEqual({ status: 'ok' })
    expect(await (await fetch(`http://127.0.0.1:${port}/health/ready`)).json()).toEqual({
      status: 'ok',
      version: expect.stringMatching(/^v\d+\.\d+\.\d+\+/),
    })
    expect((await fetch(`http://127.0.0.1:${port}/other`)).status).toBe(404)
  } finally {
    server.close()
  }
})
