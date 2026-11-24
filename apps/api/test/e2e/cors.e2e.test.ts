import WebSocket from 'ws'
import request from 'supertest'
import { GRAPHQL_CORS_HEADERS, GRAPHQL_CORS_MAX_AGE_SECONDS, GRAPHQL_CORS_METHODS } from '../../src/cors'
import { createTestApp, type TestApp } from '../support/app'
import { liveUrl } from '../support/live'

const ALLOWED = 'http://localhost:3000'
const DENIED = 'https://evil.example'

/** The WebSocket upgrade, without a graphql-ws handshake. `opened` means the server accepted it. */
function upgrade(url: string, origin?: string): Promise<{ opened: boolean; status?: number }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('upgrade timed out')), 5000)
    let settled = false
    const done = (result: { opened: boolean; status?: number }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }
    const ws = new WebSocket(url, origin === undefined ? undefined : { headers: { origin } })
    ws.once('open', () => {
      ws.close()
      done({ opened: true })
    })
    ws.once('unexpected-response', (_req, res) => {
      const status = res.statusCode
      res.resume()
      done({ opened: false, status })
    })
    ws.once('error', (err) => {
      if (!settled) done({ opened: false, status: (err as { statusCode?: number }).statusCode })
    })
  })
}

describe('per-endpoint CORS', () => {
  let t: TestApp
  let http: request.Agent
  let live: string

  beforeAll(async () => {
    t = await createTestApp()
    http = request(t.app.getHttpServer())
    live = await liveUrl(t)
  })

  afterAll(() => t.close())

  it('answers an allowed /graphql preflight with the allow-list, credentials, methods and headers', async () => {
    const res = await http
      .options('/graphql')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type, authorization, apollo-require-preflight')
      .expect(204)
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED)
    expect(res.headers['access-control-allow-credentials']).toBe('true')
    expect(res.headers['access-control-allow-methods']).toBe(GRAPHQL_CORS_METHODS)
    expect(res.headers['access-control-allow-headers']).toBe(GRAPHQL_CORS_HEADERS)
    expect(res.headers['access-control-max-age']).toBe(GRAPHQL_CORS_MAX_AGE_SECONDS)
    expect(res.headers['vary']).toMatch(/origin/i)
  })

  it('preflights /graphql/live the same way', async () => {
    const res = await http.options('/graphql/live').set('Origin', ALLOWED).set('Access-Control-Request-Method', 'GET').expect(204)
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED)
    expect(res.headers['access-control-allow-credentials']).toBe('true')
  })

  it('sends no Access-Control-Allow-Origin for a disallowed origin, and still answers the query', async () => {
    const preflight = await http.options('/graphql').set('Origin', DENIED).set('Access-Control-Request-Method', 'POST').expect(204)
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined()
    expect(preflight.headers['access-control-allow-credentials']).toBeUndefined()
    const posted = await http.post('/graphql').set('Origin', DENIED).send({ query: '{ termsVersion }' })
    expect(posted.status).not.toBe(500)
    expect(posted.headers['access-control-allow-origin']).toBeUndefined()
    expect(posted.body.data.termsVersion).toEqual(expect.any(String))
  })

  it('serves a GET query, which is why GET is in the allow-list', async () => {
    const res = await http.get('/graphql').query({ query: '{ termsVersion }' }).set('Origin', ALLOWED).set('apollo-require-preflight', 'true')
    expect(res.status).toBe(200)
    expect(res.body.data.termsVersion).toEqual(expect.any(String))
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED)
  })

  it('adds no CORS headers on /health/* even when an Origin is sent', async () => {
    for (const path of ['/health/live', '/health/ready']) {
      const res = await http.get(path).set('Origin', ALLOWED)
      expect(res.headers['access-control-allow-origin']).toBeUndefined()
      expect(res.headers['access-control-allow-credentials']).toBeUndefined()
      expect(res.headers['access-control-allow-methods']).toBeUndefined()
      expect(res.headers['x-content-type-options']).toBe('nosniff')
    }
  })

  it('adds no CORS headers on /webhooks/* even when an Origin is sent', async () => {
    const res = await http.post('/webhooks/github').set('Origin', ALLOWED).set('Content-Type', 'application/json').send({})
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
    expect(res.headers['access-control-allow-credentials']).toBeUndefined()
    const denied = await http.get('/webhooks/github').set('Origin', DENIED)
    expect(denied.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('keeps /_subgraph a 404 with no CORS headers', async () => {
    const res = await http.post('/_subgraph/users').set('Origin', ALLOWED).send({ query: '{ __typename }' })
    expect(res.status).toBe(404)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('accepts a live-update upgrade with no Origin or an allowed Origin, and refuses any other', async () => {
    expect(await upgrade(live)).toEqual({ opened: true })
    expect(await upgrade(live, ALLOWED)).toEqual({ opened: true })
    const refused = await upgrade(live, DENIED)
    expect(refused.opened).toBe(false)
    expect(refused.status).toBe(403)
  })
})
