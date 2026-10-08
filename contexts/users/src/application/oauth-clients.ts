import type { ProviderIdentity } from './providers'

/**
 * Authorization Code + PKCE exchanges for GitHub and LinkedIn (§7.1). The client completed the provider's consent
 * screen and holds a one-time code; the API swaps it (with the client's code verifier) for the provider's user and
 * verified email, then forgets the provider token — LVN never calls these providers on the user's behalf again.
 */
export interface OAuthApp {
  clientId: string
  clientSecret: string
  /** OAuth origin/base from env (ADR-0022) */
  oauthUrl: string
  apiUrl: string
}

export interface CodeExchange {
  code: string
  codeVerifier: string
  redirectUri: string
}

const TIMEOUT = 5000
const json = async <T>(res: Response, what: string): Promise<T> => {
  if (!res.ok) throw new Error(`${what} failed with ${res.status}`)
  return (await res.json()) as T
}

export async function githubIdentity(app: OAuthApp, x: CodeExchange): Promise<ProviderIdentity> {
  const token = await json<{ access_token?: string; error?: string }>(
    await fetch(`${app.oauthUrl.replace(/\/$/, '')}/login/oauth/access_token`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: app.clientId, client_secret: app.clientSecret, code: x.code, redirect_uri: x.redirectUri, code_verifier: x.codeVerifier }),
      signal: AbortSignal.timeout(TIMEOUT),
    }),
    'GitHub token exchange',
  )
  if (!token.access_token) throw new Error(`GitHub refused the code: ${token.error ?? 'no token'}`)
  const headers = { authorization: `Bearer ${token.access_token}`, accept: 'application/vnd.github+json', 'user-agent': 'LearnViaNotes' }
  const api = app.apiUrl.replace(/\/$/, '')
  const [user, emails] = await Promise.all([
    json<{ id: number; login: string; name: string | null }>(await fetch(`${api}/user`, { headers, signal: AbortSignal.timeout(TIMEOUT) }), 'GitHub user'),
    json<{ email: string; primary: boolean; verified: boolean }[]>(await fetch(`${api}/user/emails`, { headers, signal: AbortSignal.timeout(TIMEOUT) }), 'GitHub emails'),
  ])
  const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified)
  return { provider: 'GITHUB', providerUserId: String(user.id), email: primary?.email ?? null, emailVerified: !!primary, name: user.name ?? user.login }
}

export async function linkedinIdentity(app: OAuthApp, x: CodeExchange): Promise<ProviderIdentity> {
  const token = await json<{ access_token?: string; error?: string }>(
    await fetch(`${app.oauthUrl.replace(/\/$/, '')}/accessToken`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: x.code,
        redirect_uri: x.redirectUri,
        client_id: app.clientId,
        client_secret: app.clientSecret,
        code_verifier: x.codeVerifier,
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    }),
    'LinkedIn token exchange',
  )
  if (!token.access_token) throw new Error(`LinkedIn refused the code: ${token.error ?? 'no token'}`)
  const info = await json<{ sub: string; email?: string; email_verified?: boolean; name?: string }>(
    await fetch(`${app.apiUrl.replace(/\/$/, '')}/userinfo`, { headers: { authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(TIMEOUT) }),
    'LinkedIn userinfo',
  )
  return { provider: 'LINKEDIN', providerUserId: info.sub, email: info.email ?? null, emailVerified: info.email_verified === true, name: info.name ?? null }
}
