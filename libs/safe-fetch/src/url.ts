/**
 * Query parameters that only track a click or pay a referrer (ADR-0074): dropped from submitted links, so a link stays
 * free of affiliate codes and the same page is recognised however it was shared.
 */
const TRACKING = new Set([
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'yclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  'tag',
  'ascsubtag',
  'linkcode',
  'linkid',
  'creative',
  'creativeasin',
  'camp',
  'affid',
  'aff_id',
  'affiliate',
  'affiliate_id',
  'irclickid',
  'clickid',
  'ref_',
])
const isTracking = (name: string) => {
  const n = name.toLowerCase()
  return n.startsWith('utm_') || TRACKING.has(n)
}

export class InvalidUrlError extends Error {}

/**
 * A link as LearnViaNotes keeps it: http or https only, no credentials, a lower-case host, no default port, no fragment,
 * no tracking or affiliate parameters, the others sorted, and no trailing slash after a path. Throws InvalidUrlError.
 */
export function normaliseUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new InvalidUrlError('That is not a web address.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new InvalidUrlError('Use a web address that starts with http:// or https://.')
  if (url.username || url.password) throw new InvalidUrlError('Leave the user name and password out of the address.')
  if (!url.hostname || !url.hostname.includes('.')) throw new InvalidUrlError('That is not a public web address.')
  url.hash = ''
  const kept = [...url.searchParams.entries()].filter(([name]) => !isTracking(name)).sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)))
  url.search = ''
  for (const [name, value] of kept) url.searchParams.append(name, value)
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '')
  // URL already lower-cases the host and drops the scheme's default port.
  return url.toString()
}

/** An ISBN-10 or ISBN-13 (hyphens and spaces allowed) as ISBN-13, or null when it is not a valid ISBN. */
export function isbn13(raw: string): string | null {
  const s = raw.replace(/[\s-]/g, '').toUpperCase()
  if (/^\d{9}[\dX]$/.test(s)) {
    const sum = [...s].reduce((acc, ch, i) => acc + (ch === 'X' ? 10 : Number(ch)) * (10 - i), 0)
    if (sum % 11 !== 0) return null
    const twelve = `978${s.slice(0, 9)}`
    return twelve + checkDigit13(twelve)
  }
  if (/^97[89]\d{10}$/.test(s)) return checkDigit13(s.slice(0, 12)) === s[12] ? s : null
  return null
}

function checkDigit13(twelve: string): string {
  const sum = [...twelve].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0)
  return String((10 - (sum % 10)) % 10)
}
