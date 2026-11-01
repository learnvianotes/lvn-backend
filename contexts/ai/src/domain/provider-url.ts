import { BlockList, isIPv4, isIPv6 } from 'node:net'

/**
 * Addresses an AI provider call must not reach (cloud instance metadata and link-local).
 * Private and loopback addresses stay allowed: Ollama and a LiteLLM proxy are often on the operator's own network
 * (ADR-0065), and tests talk to stand-ins on 127.0.0.1. User-supplied page URLs go through safe-fetch instead, which
 * blocks those ranges too.
 */
const BLOCKED_V4 = new BlockList()
const BLOCKED_V6 = new BlockList()
BLOCKED_V4.addSubnet('169.254.0.0', 16, 'ipv4')
// Alibaba Cloud's metadata service. The rest of 100.64.0.0/10 stays open (carrier-grade NAT, overlay networks).
BLOCKED_V4.addAddress('100.100.100.200', 'ipv4')
BLOCKED_V6.addSubnet('fe80::', 10, 'ipv6')
// IPv4-mapped form of 169.254.0.0/16. The rest of ::ffff:0:0/96 stays open so a mapped private address still works.
BLOCKED_V6.addSubnet('::ffff:169.254.0.0', 112, 'ipv6')
// AWS's IPv6 instance metadata address.
BLOCKED_V6.addAddress('fd00:ec2::254', 'ipv6')

const MAX_URL_LENGTH = 2000

/** An address a platform admin typed that this server will not store or call. */
export class ProviderUrlError extends Error {
  override name = 'ProviderUrlError'
  constructor(message: string) {
    super(message)
  }
}

/** True for a cloud metadata or link-local address. Anything that is not an IP address is not. */
export function isMetadataAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, '')
  if (isIPv4(bare)) return BLOCKED_V4.check(bare, 'ipv4')
  if (isIPv6(bare)) return BLOCKED_V6.check(bare, 'ipv6')
  return false
}

function isMetadataHostname(hostname: string): boolean {
  const name = hostname.replace(/\.$/, '').toLowerCase()
  return name === 'metadata.google.internal' || name.endsWith('.metadata.google.internal') || name === 'metadata.goog' || name.endsWith('.metadata.goog')
}

/**
 * The address of a provider connection. `http://169.254.169.254/...` and the other numeric spellings of that address
 * (`2852039166`, `0xa9fea9fe`) are refused: Node's URL parser writes them as the dotted address first. A name such as
 * `gpu-host` is accepted here and checked against the addresses it resolves to when the call is made.
 */
export function parseProviderUrl(raw: string): URL {
  if (raw.length > MAX_URL_LENGTH) throw new ProviderUrlError('That address is too long.')
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ProviderUrlError('The address must be an http or https URL.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ProviderUrlError('The address must be an http or https URL.')
  if (url.username || url.password) throw new ProviderUrlError('The address cannot include a user name or password.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!host) throw new ProviderUrlError('The address must be an http or https URL.')
  if (isMetadataHostname(host) || isMetadataAddress(host)) throw new ProviderUrlError('That address is a cloud metadata or link-local address, which this server will not call. A private host such as http://gpu-host:11434 is fine.')
  return url
}
