import { createServer, type Server } from 'node:http'

/** Liveness endpoint for the worker task (ECS health check, spec §16.2). */
export function startHealthServer(port: number, host = '0.0.0.0'): Promise<Server> {
  const server = createServer((req, res) => {
    const ok = req.url === '/health/live' || req.url === '/health/ready'
    res.writeHead(ok ? 200 : 404, { 'content-type': 'application/json' })
    res.end(JSON.stringify(ok ? { status: 'ok' } : { error: 'NOT_FOUND' }))
  })
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)))
}
