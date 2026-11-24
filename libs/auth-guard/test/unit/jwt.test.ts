import { createHmac, generateKeyPairSync, sign } from 'node:crypto'
import { AccessTokenSigner, AccessTokenVerifier, ACCESS_TOKEN_TTL_SECONDS } from '../../src/jwt'

const pair = () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  return { priv: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), pub: publicKey.export({ type: 'spki', format: 'pem' }).toString() }
}
const keys = pair()
const ISS = 'http://localhost:4000'
const AUD = 'lvn'
const signer = new AccessTokenSigner(keys.priv, ISS, AUD)
const verifier = new AccessTokenVerifier(keys.pub, ISS, AUD)
const subject = { userId: 'u1', sessionId: 's1', roles: ['STUDENT' as const] }
const NOW = 1_800_000_000

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')

describe('access tokens', () => {
  it('carries amr and a fresh mfa timestamp, and omits them when they are absent', () => {
    const verified = signer.sign({ ...subject, roles: ['PLATFORM_ADMIN'], amr: ['pwd', 'otp'], mfa: true, mfaAt: NOW - 30, mfaReq: true }, NOW)
    expect(verifier.verify(verified.token, NOW)).toMatchObject({
      ok: true,
      claims: { amr: ['pwd', 'otp'], mfa: true, mfaAt: NOW - 30, mfaReq: true, roles: ['PLATFORM_ADMIN'] },
    })
    const plain = verifier.verify(signer.sign(subject, NOW).token, NOW)
    expect(plain.ok && plain.claims.mfa).toBeUndefined()
    expect(plain.ok && plain.claims.amr).toBeUndefined()
  })

  it('rejects an mfa flag with no timestamp', () => {
    const { token } = signer.sign(subject, NOW)
    const [h, payload, s] = token.split('.')
    const claims = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8'))
    const forged = `${h}.${b64({ ...claims, mfa: true })}.${s}`
    expect(verifier.verify(forged, NOW)).toEqual({ ok: false, reason: 'signature' })
    const resigned = signer.sign({ ...subject, mfa: true }, NOW)
    expect(verifier.verify(resigned.token, NOW)).toEqual({ ok: false, reason: 'claims' })
  })

  it('round-trips sub, sid and roles for 15 minutes', () => {
    const { token, expiresAt } = signer.sign(subject, NOW)
    const result = verifier.verify(token, NOW + 60)
    expect(result).toMatchObject({ ok: true, claims: { sub: 'u1', sid: 's1', roles: ['STUDENT'], iss: ISS, aud: AUD } })
    expect(expiresAt.getTime()).toBe((NOW + ACCESS_TOKEN_TTL_SECONDS) * 1000)
  })

  it('expires after 15 minutes', () => {
    const { token } = signer.sign(subject, NOW)
    expect(verifier.verify(token, NOW + ACCESS_TOKEN_TTL_SECONDS + 10)).toEqual({ ok: false, reason: 'expired' })
  })

  it('rejects a token signed with another key', () => {
    const other = new AccessTokenSigner(pair().priv, ISS, AUD).sign(subject, NOW).token
    expect(verifier.verify(other, NOW)).toEqual({ ok: false, reason: 'signature' })
  })

  it('rejects a tampered payload', () => {
    const [h, , s] = signer.sign(subject, NOW).token.split('.')
    const forged = `${h}.${b64({ sub: 'admin', sid: 's1', roles: ['PLATFORM_ADMIN'], iss: ISS, aud: AUD, iat: NOW, exp: NOW + 900 })}.${s}`
    expect(verifier.verify(forged, NOW)).toEqual({ ok: false, reason: 'signature' })
  })

  it('accepts only RS256 — no "none", no HMAC with the public key', () => {
    const payload = b64({ sub: 'u1', sid: 's1', roles: [], iss: ISS, aud: AUD, iat: NOW, exp: NOW + 900 })
    expect(verifier.verify(`${b64({ alg: 'none', typ: 'JWT' })}.${payload}.`, NOW).ok).toBe(false)
    const hs = `${b64({ alg: 'HS256', typ: 'JWT' })}.${payload}`
    const mac = createHmac('sha256', keys.pub).update(hs).digest('base64url')
    expect(verifier.verify(`${hs}.${mac}`, NOW)).toEqual({ ok: false, reason: 'malformed' })
  })

  it('checks issuer and audience', () => {
    const elsewhere = new AccessTokenSigner(keys.priv, 'https://evil.example', AUD).sign(subject, NOW).token
    expect(verifier.verify(elsewhere, NOW)).toEqual({ ok: false, reason: 'claims' })
    const otherAud = new AccessTokenSigner(keys.priv, ISS, 'other').sign(subject, NOW).token
    expect(verifier.verify(otherAud, NOW)).toEqual({ ok: false, reason: 'claims' })
  })

  it('accepts a previous issuer during a cutover and still rejects any other', () => {
    const previous = 'https://www.learnvianotes.in'
    const both = new AccessTokenVerifier(keys.pub, [ISS, previous], AUD)
    const oldToken = new AccessTokenSigner(keys.priv, previous, AUD).sign(subject, NOW).token
    expect(both.verify(oldToken, NOW)).toMatchObject({ ok: true, claims: { iss: previous } })
    expect(both.verify(signer.sign(subject, NOW).token, NOW).ok).toBe(true)
    const elsewhere = new AccessTokenSigner(keys.priv, 'https://evil.example', AUD).sign(subject, NOW).token
    expect(both.verify(elsewhere, NOW)).toEqual({ ok: false, reason: 'claims' })
  })

  it('rejects tokens issued in the future and missing claims', () => {
    expect(verifier.verify(signer.sign(subject, NOW + 3600).token, NOW)).toEqual({ ok: false, reason: 'claims' })
    const input = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ sub: 'u1', iss: ISS, aud: AUD, iat: NOW, exp: NOW + 900 })}`
    const token = `${input}.${sign('sha256', Buffer.from(input), keys.priv).toString('base64url')}`
    expect(verifier.verify(token, NOW)).toEqual({ ok: false, reason: 'claims' })
  })

  it.each(['', 'a.b', 'a.b.c.d', 'x.y.z', '!!.??.**'])('treats %j as malformed', (t) => {
    expect(verifier.verify(t, NOW).ok).toBe(false)
  })

  it('refuses a non-RSA signing key', () => {
    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    expect(() => new AccessTokenSigner(ec, ISS, AUD)).toThrow(/RSA/)
  })
})
