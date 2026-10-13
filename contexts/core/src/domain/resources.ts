/** Resources (§14.4, ADR-0074): pure rules the service and its tests share. */

export type ResourceTypeKind = 'BOOK' | 'COURSE' | 'TOOL' | 'SOFTWARE' | 'HARDWARE' | 'OTHER'

/** The key duplicates are found by: the normalised link without its scheme, so http and https are one. */
export const urlKeyOf = (normalised: string) => normalised.replace(/^https?:\/\//, '')

/** The site a link is on, without `www.`, as the apps show it next to the link. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Sites whose pages are courses, so a preview can suggest the type; anything else is left for the person to choose. */
const COURSE_HOSTS = ['nptel.ac.in', 'onlinecourses.nptel.ac.in', 'swayam.gov.in', 'coursera.org', 'edx.org', 'udemy.com', 'khanacademy.org', 'ocw.mit.edu', 'freecodecamp.org']
const SOFTWARE_HOSTS = ['github.com', 'gitlab.com', 'pypi.org', 'npmjs.com', 'crates.io', 'apps.apple.com', 'play.google.com']

export function suggestType(url: string, ogType: string | null, isbn: string | null): ResourceTypeKind | null {
  if (isbn || ogType === 'book' || ogType === 'books.book') return 'BOOK'
  const host = hostOf(url)
  const on = (hosts: string[]) => hosts.some((h) => host === h || host.endsWith(`.${h}`))
  if (on(COURSE_HOSTS)) return 'COURSE'
  if (on(SOFTWARE_HOSTS)) return 'SOFTWARE'
  return null
}

/** What a picture's first bytes say it is: JPEG, PNG or WebP, the covers resources keep; null for anything else. */
export function pictureType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return 'image/png'
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}

/**
 * Fields a commerce surface would need. §14.4 and ADR-0074 keep resources free of them; the schema test fails if a
 * Resource column's name contains one.
 */
export const COMMERCE_WORDS = ['price', 'cost', 'currency', 'discount', 'store', 'shop', 'seller', 'vendor', 'merchant', 'stock', 'cart', 'checkout', 'affiliate', 'commission', 'sku', 'buy', 'order']
