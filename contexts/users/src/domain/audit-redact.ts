const SECRET_KEY = /password|secret|token|api[_-]?key|authorization|cookie|otp|private[_-]?key|credential|codehash|refresh/i

/** A copy of an audit payload with secret-looking fields replaced. The code of an emailed OTP never reaches this. */
export function redactAudit(value: unknown, depth = 0): unknown {
  if (depth > 8) return null
  if (Array.isArray(value)) return value.map((item) => redactAudit(item, depth + 1))
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const otp = key === 'code' && typeof item === 'string' && /^\d{4,8}$/.test(item)
    out[key] = SECRET_KEY.test(key) || otp ? '[redacted]' : redactAudit(item, depth + 1)
  }
  return out
}
