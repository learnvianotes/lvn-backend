import { BlockList, isIPv4, isIPv6 } from 'node:net'

/**
 * Addresses the server never connects to for a URL a person gave (ADR-0074, OWASP's SSRF cheat sheet): this machine,
 * private and shared networks, link-local (the cloud metadata service at 169.254.169.254 among them), documentation,
 * benchmarking, multicast and reserved ranges, and the IPv6 forms that reach any of them.
 */
const BLOCKED_V4 = new BlockList()
// Separate lists: a BlockList also matches IPv4 addresses against IPv6 rules for mapped addresses (::ffff:0:0/96).
const BLOCKED_V6 = new BlockList()
const V4: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]
const V6: [string, number][] = [
  ['::', 128],
  ['::1', 128],
  // IPv4-mapped and -translated addresses reach whatever IPv4 address they carry.
  ['::ffff:0:0', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  // Teredo and 6to4 tunnel to IPv4 addresses too.
  ['2001::', 32],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
]
for (const [net, prefix] of V4) BLOCKED_V4.addSubnet(net, prefix, 'ipv4')
for (const [net, prefix] of V6) BLOCKED_V6.addSubnet(net, prefix, 'ipv6')

/** True for an address the fetcher refuses; anything that is not an IP address is refused too. */
export function isBlockedAddress(address: string): boolean {
  if (isIPv4(address)) return BLOCKED_V4.check(address, 'ipv4')
  const bare = address.replace(/^\[|\]$/g, '')
  if (isIPv6(bare)) return BLOCKED_V6.check(bare, 'ipv6')
  return true
}
