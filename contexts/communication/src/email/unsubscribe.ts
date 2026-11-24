import { createHmac, timingSafeEqual } from 'node:crypto'

export type EmailKind = 'CLASSROOM_POST' | 'DIGEST' | 'MARKETING'
const KINDS: EmailKind[] = ['CLASSROOM_POST', 'DIGEST', 'MARKETING']

const mac = (secret: string, userId: string, kind: EmailKind) => createHmac('sha256', secret).update(`unsubscribe:${userId}:${kind}`).digest('base64url')

/** A token that turns off one kind of email for one person, with no sign-in (ADR-0050, RFC 8058). */
export function unsubscribeToken(secret: string, userId: string, kind: EmailKind): string {
  return `${Buffer.from(`${userId}.${kind}`).toString('base64url')}.${mac(secret, userId, kind)}`
}

export function readUnsubscribeToken(secret: string, token: string): { userId: string; kind: EmailKind } | null {
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const [userId, kind] = Buffer.from(payload, 'base64url').toString().split('.') as [string, EmailKind]
  if (!userId || !KINDS.includes(kind)) return null
  const expected = Buffer.from(mac(secret, userId, kind))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given) ? { userId, kind } : null
}
