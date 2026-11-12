import { createServer, type Server } from 'node:http'
import { runningRelease } from '@lvn-backend/config'

/** Liveness and readiness for the worker task (ECS health check, spec §16.2). Readiness adds `version`. */
export function startHealthServer(port: number, host = '0.0.0.0'): Promise<Server> {
  const server = createServer((req, res) => {
    const live = req.url === '/health/live'
    const ready = req.url === '/health/ready'
    const ok = live || ready
    // Liveness stays `{ status: 'ok' }`. Readiness adds the running release and leaves `status` as it was.
    const body = !ok ? { error: 'NOT_FOUND' } : live ? { status: 'ok' } : { status: 'ok', version: runningRelease() }
    res.writeHead(ok ? 200 : 404, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  })
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)))
}
