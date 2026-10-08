import { clientNetwork } from '../../src/domain/network'

describe('clientNetwork', () => {
  it('keeps IPv4 addresses, including IPv4-mapped IPv6', () => {
    expect(clientNetwork('203.0.113.7')).toBe('203.0.113.7')
    expect(clientNetwork('::ffff:203.0.113.7')).toBe('203.0.113.7')
  })

  it('groups IPv6 addresses by their /64', () => {
    expect(clientNetwork('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:0db8:0001:0002::/64')
    expect(clientNetwork('2001:db8:1:2::1')).toBe('2001:0db8:0001:0002::/64')
    expect(clientNetwork('2001:DB8:1:2:ffff::9')).toBe('2001:0db8:0001:0002::/64')
    expect(clientNetwork('2001:db8::1')).toBe('2001:0db8:0000:0000::/64')
    expect(clientNetwork('fe80::1%eth0')).toBe('fe80:0000:0000:0000::/64')
    expect(clientNetwork('::1')).toBe('0000:0000:0000:0000::/64')
  })

  it('ignores anything that is not an address', () => {
    for (const bad of [undefined, null, '', 'localhost', '999.1.1.1', 'not-an-ip']) expect(clientNetwork(bad)).toBeNull()
  })
})
