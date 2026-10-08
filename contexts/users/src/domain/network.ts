import { isIPv4, isIPv6 } from 'node:net'

/**
 * The network a client address belongs to, for rate limits: an IPv4 address itself, an IPv6 address by its /64 —
 * one home or device usually holds a whole /64, so per-address IPv6 limits are trivially side-stepped.
 * Null for anything that is not an IP address.
 */
export function clientNetwork(ip: string | undefined | null): string | null {
  if (!ip) return null
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)
  if (mapped) return mapped[1]!
  if (isIPv4(ip)) return ip
  if (!isIPv6(ip)) return null
  const [head, tail = ''] = ip.toLowerCase().split('%')[0]!.split('::') as [string, string?]
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = ip.includes('::') ? [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right] : left
  return `${groups.slice(0, 4).map((g) => g.padStart(4, '0')).join(':')}::/64`
}
