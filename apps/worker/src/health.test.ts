import type { AddressInfo } from 'node:net'
import { startHealthServer } from './health'

it('answers liveness and 404s anything else', async () => {
  const server = await startHealthServer(0, '127.0.0.1')
  const { port } = server.address() as AddressInfo
  try {
    expect((await fetch(`http://127.0.0.1:${port}/health/live`)).status).toBe(200)
    expect((await fetch(`http://127.0.0.1:${port}/other`)).status).toBe(404)
  } finally {
    server.close()
  }
})
