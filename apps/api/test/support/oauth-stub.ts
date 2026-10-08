import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * Stands in for GitHub and LinkedIn's OAuth and user endpoints. A code is accepted once, only with the PKCE
 * verifier, client credentials and redirect URI it was issued for — as the real providers check.
 */
export interface StubUser {
  id: string
  name: string
  emails: { email: string; primary: boolean; verified: boolean }[]
}

export interface IssuedCode {
  user: StubUser
  codeVerifier: string
  redirectUri: string
}

export class OAuthStub {
  readonly codes = new Map<string, IssuedCode>()
  private readonly tokens = new Map<string, StubUser>()
  private server!: Server
  url = ''

  constructor(private readonly client: { id: string; secret: string }) {}

  async start(): Promise<this> {
    this.server = createServer((req, res) => {
      void this.handle(req).then(
        ({ status, body }) => {
          res.writeHead(status, { 'content-type': 'application/json' })
          res.end(JSON.stringify(body))
        },
        () => {
          res.writeHead(500)
          res.end()
        },
      )
    })
    await new Promise<void>((r) => this.server.listen(0, '127.0.0.1', r))
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`
    return this
  }

  stop(): void {
    this.server.close()
  }

  issue(code: string, issued: IssuedCode): void {
    this.codes.set(code, issued)
  }

  private async handle(req: IncomingMessage): Promise<{ status: number; body: unknown }> {
    const raw = await new Promise<string>((r) => {
      let data = ''
      req.on('data', (c: Buffer) => (data += c.toString()))
      req.on('end', () => r(data))
    })
    const url = new URL(req.url!, this.url)
    const bearer = req.headers.authorization?.replace(/^Bearer /, '') ?? ''

    // GitHub token endpoint (JSON) and LinkedIn token endpoint (form)
    if (req.method === 'POST' && (url.pathname === '/login/oauth/access_token' || url.pathname === '/oauth/v2/accessToken')) {
      const p = url.pathname.startsWith('/login') ? (JSON.parse(raw) as Record<string, string>) : Object.fromEntries(new URLSearchParams(raw))
      const issued = this.codes.get(p.code ?? '')
      const ok =
        issued &&
        p.client_id === this.client.id &&
        p.client_secret === this.client.secret &&
        p.code_verifier === issued.codeVerifier &&
        p.redirect_uri === issued.redirectUri
      if (!ok) return { status: url.pathname.startsWith('/login') ? 200 : 400, body: { error: 'bad_verification_code' } }
      this.codes.delete(p.code!)
      const token = `tok_${Math.random().toString(36).slice(2)}`
      this.tokens.set(token, issued.user)
      return { status: 200, body: { access_token: token, token_type: 'bearer' } }
    }

    const user = this.tokens.get(bearer)
    if (!user) return { status: 401, body: { message: 'Bad credentials' } }
    if (url.pathname === '/api/user') return { status: 200, body: { id: Number(user.id), login: user.name.toLowerCase().replace(/\s+/g, ''), name: user.name } }
    if (url.pathname === '/api/user/emails') return { status: 200, body: user.emails }
    if (url.pathname === '/v2/userinfo') {
      const primary = user.emails.find((e) => e.primary)
      return { status: 200, body: { sub: user.id, name: user.name, email: primary?.email, email_verified: primary?.verified ?? false } }
    }
    return { status: 404, body: {} }
  }
}
