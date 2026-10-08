import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { testEnv } from '../support/app'

/**
 * OpenTelemetry end to end (§16.5): the built API runs as its own process, as in a container, with
 * OTEL_EXPORTER_OTLP_ENDPOINT pointing at a stand-in collector that keeps what it receives. In-process tests cannot
 * show this — instrumentation patches Node's module loader, which Jest replaces.
 */
interface OtlpSpan {
  name: string
  kind: number
  attributes: { key: string; value: Record<string, unknown> }[]
}
interface OtlpExport {
  resourceSpans: { resource: { attributes: { key: string; value: { stringValue?: string } }[] }; scopeSpans: { scope: { name: string }; spans: OtlpSpan[] }[] }[]
}

const main = path.resolve(__dirname, '../../dist/main.js')
const listen = (server: Server) => new Promise<number>((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)))
const freePort = async () => {
  const s = createServer()
  const port = await listen(s)
  await new Promise((r) => s.close(r))
  return port
}

describe('telemetry', () => {
  let collector: Server
  let api: ChildProcess | undefined
  const exports: { path: string; body: string }[] = []

  beforeAll(async () => {
    if (!existsSync(main)) throw new Error('apps/api/dist/main.js is missing — run `pnpm build` first (turbo does it for `pnpm test`)')
    collector = createServer((req, res) => {
      let body = ''
      req.on('data', (c: Buffer) => (body += c.toString()))
      req.on('end', () => {
        exports.push({ path: req.url ?? '', body })
        res.setHeader('content-type', 'application/json')
        res.end('{}')
      })
    })
  })

  afterAll(async () => {
    api?.kill('SIGKILL')
    await new Promise((r) => collector.close(r))
  })

  it('exports spans for a GraphQL request through HTTP, GraphQL, Postgres and Redis, without its variables', async () => {
    const collectorPort = await listen(collector)
    const port = await freePort()
    const env = await testEnv({
      API_HOST: '127.0.0.1',
      API_PORT: String(port),
      LOG_LEVEL: 'warn',
      RELEASE: 'test-sha-1234',
      OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${collectorPort}`,
    })
    // OTEL_BSP_SCHEDULE_DELAY: export batches quickly instead of every 5 s.
    api = spawn(process.execPath, [main], { env: { PATH: process.env.PATH, OTEL_BSP_SCHEDULE_DELAY: '200', ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    api.stdout!.on('data', (c: Buffer) => (output += c.toString()))
    api.stderr!.on('data', (c: Buffer) => (output += c.toString()))

    const base = `http://127.0.0.1:${port}`
    for (let i = 0; ; i++) {
      const ok = await fetch(`${base}/health/live`).then((r) => r.ok, () => false)
      if (ok) break
      if (i > 150 || api.exitCode !== null) throw new Error(`API did not start:\n${output}`)
      await new Promise((r) => setTimeout(r, 200))
    }

    const res = await fetch(`${base}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operationName: 'SignIn',
        query: 'mutation SignIn($input: SignInInput!) { signIn(input: $input) { session { accessToken } userErrors { message } } }',
        variables: { input: { email: 'traced-person@example.com', password: 'a traced secret passphrase' } },
      }),
    })
    expect(res.status).toBe(200)

    // SIGTERM: the app closes, then flushes spans and metrics before exiting (stopOnSignals).
    const exited = new Promise<number | null>((resolve) => api!.once('exit', (code) => resolve(code)))
    api.kill('SIGTERM')
    expect(await exited).toBe(0)

    const traces = exports.filter((e) => e.path === '/v1/traces').map((e) => JSON.parse(e.body) as OtlpExport)
    const spans = traces.flatMap((t) => t.resourceSpans.flatMap((rs) => rs.scopeSpans.flatMap((ss) => ss.spans.map((s) => ({ ...s, scope: ss.scope.name, resource: rs.resource })))))
    const scopes = new Set(spans.map((s) => s.scope))
    // Sign-in touches all of them: the request, the gateway's GraphQL, the account lookup and the Redis rate limiter.
    for (const scope of ['@opentelemetry/instrumentation-http', '@opentelemetry/instrumentation-graphql', '@opentelemetry/instrumentation-pg', '@opentelemetry/instrumentation-ioredis']) {
      expect([...scopes]).toContain(scope)
    }
    const server = spans.find((s) => s.scope === '@opentelemetry/instrumentation-http' && s.kind === 2)
    expect(server?.name).toMatch(/POST/)
    const resource = Object.fromEntries(spans[0]!.resource.attributes.map((a) => [a.key, a.value.stringValue]))
    expect(resource).toMatchObject({ 'service.name': 'lvn-api', 'service.version': 'test-sha-1234', 'deployment.environment.name': 'development' })

    // Health checks are not traced; variables never leave the process.
    const everything = exports.map((e) => e.body).join('\n')
    expect(everything).not.toContain('/health/live')
    expect(everything).not.toContain('a traced secret passphrase')
    expect(everything).not.toContain('traced-person@example.com')
  }, 60_000)
})
