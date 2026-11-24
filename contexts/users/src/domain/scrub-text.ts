/** Removes personal data and anything that could be a document image from a log line. */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const BEARER = /bearer\s+\S+/gi
const LONG_SECRET = /[A-Za-z0-9+/_-]{80,}={0,2}/g

export function scrubText(value: string, max = 500): string {
  return value.replace(EMAIL, '[email]').replace(BEARER, 'bearer [redacted]').replace(LONG_SECRET, '[redacted]').replace(/\s+/g, ' ').trim().slice(0, max)
}
