import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { parseRobots, readMetaTag, readPageText, RobotsCache, robotsAllows, SafeFetcher } from '../src'

describe('robots.txt (RFC 9309, ADR-0077)', () => {
  const groups = parseRobots(`
# the whole site
User-agent: *
Disallow: /private/
Allow: /private/open.html

User-agent: LearnViaNotes
User-agent: OtherBot
Disallow: /drafts
Allow: /drafts/public$
Disallow: /*.pdf$
`)

  it('obeys the group naming the agent, else the * group; the longest rule decides and allow wins a tie', () => {
    expect(robotsAllows(groups, 'LearnViaNotes', '/drafts/x')).toBe(false)
    expect(robotsAllows(groups, 'learnvianotes', '/drafts/public')).toBe(true)
    expect(robotsAllows(groups, 'LearnViaNotes', '/drafts/public/more')).toBe(false)
    expect(robotsAllows(groups, 'LearnViaNotes', '/papers/a.pdf')).toBe(false)
    expect(robotsAllows(groups, 'LearnViaNotes', '/papers/a.pdf?x')).toBe(true)
    // Its own group replaces the * group.
    expect(robotsAllows(groups, 'LearnViaNotes', '/private/x')).toBe(true)
    expect(robotsAllows(groups, 'SomeBot', '/private/x')).toBe(false)
    expect(robotsAllows(groups, 'SomeBot', '/private/open.html')).toBe(true)
    expect(robotsAllows(parseRobots('User-agent: *\nDisallow:\n'), 'LearnViaNotes', '/anything')).toBe(true)
    expect(robotsAllows(parseRobots('User-agent: *\nAllow: /a\nDisallow: /a\n'), 'X', '/a')).toBe(true)
    expect(robotsAllows([], 'X', '/')).toBe(true)
  })

  describe('fetched for a site', () => {
    let server: Server
    let base: string
    let status = 200
    let served = 0
    beforeAll(async () => {
      server = createServer((req, res) => {
        if (req.url === '/robots.txt') {
          served++
          return res.writeHead(status, { 'content-type': 'text/plain' }).end('User-agent: *\nDisallow: /no\n')
        }
        res.writeHead(404).end()
      })
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    })
    afterAll(() => new Promise<void>((r) => server.close(() => r())))
    const fetcher = () => new SafeFetcher({ userAgent: 'LearnViaNotes-test', allowHosts: ['127.0.0.1'], timeoutMs: 1_000 })

    it('reads the rules once a day; a missing file allows all; a failing site allows nothing', async () => {
      const robots = new RobotsCache(fetcher(), 'LearnViaNotes')
      expect(await robots.allows(`${base}/yes`)).toBe(true)
      expect(await robots.allows(`${base}/no/page`)).toBe(false)
      expect(served).toBe(1)
      status = 404
      expect(await new RobotsCache(fetcher(), 'LearnViaNotes').allows(`${base}/no/page`)).toBe(true)
      status = 503
      expect(await new RobotsCache(fetcher(), 'LearnViaNotes').allows(`${base}/yes`)).toBe(false)
    })

    it('refuses a private address as such, never as the site’s rules', async () => {
      const robots = new RobotsCache(new SafeFetcher({ userAgent: 'LearnViaNotes-test', timeoutMs: 1_000 }), 'LearnViaNotes')
      await expect(robots.allows('http://169.254.169.254/latest/meta-data/')).rejects.toMatchObject({ code: 'BLOCKED', message: 'That address is not on the public internet.' })
      await expect(robots.allows(`${base}/yes`)).rejects.toMatchObject({ code: 'BLOCKED' })
    })
  })
})

describe('reading a page', () => {
  const html = `<html><head><title>Dr. Asha Rao</title>
<meta name="description" content="Associate Professor">
<meta name="learnvianotes-verification" content=" lvn-ab12cd34ef ">
<script>var x = "<p>not this</p>"</script><style>p { color: red }</style></head>
<body><h1>Asha Rao</h1><p>PhD, IIT Madras &amp; IISc.</p><!-- hidden --><ul><li>Operating systems</li><li>Compilers</li></ul></body></html>`

  it('finds a meta tag by name in the head, and nowhere else', () => {
    expect(readMetaTag(html, 'learnvianotes-verification')).toBe('lvn-ab12cd34ef')
    expect(readMetaTag(html, 'LearnViaNotes-Verification')).toBe('lvn-ab12cd34ef')
    expect(readMetaTag('<html><head></head><body><meta name="learnvianotes-verification" content="x"></body>', 'learnvianotes-verification')).toBeNull()
  })

  it('keeps the words a reader sees, without scripts, styles or comments', () => {
    const text = readPageText(html, 10_000)
    expect(text).toContain('PhD, IIT Madras & IISc.')
    expect(text).toContain('Operating systems\nCompilers')
    expect(text).not.toMatch(/not this|color|hidden/)
    expect(readPageText(html, 10)).toHaveLength(10)
  })
})
