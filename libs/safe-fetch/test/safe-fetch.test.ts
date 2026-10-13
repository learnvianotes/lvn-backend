import type { ServerResponse } from 'node:http'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { gzipSync } from 'node:zlib'
import { InvalidUrlError, isBlockedAddress, isbn13, normaliseUrl, readPageMeta, SafeFetcher, SafeFetchError } from '../src'

describe('blocked addresses (ADR-0074)', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.20.0.5',
    '192.168.1.10',
    '100.70.234.41',
    '169.254.169.254',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    '::ffff:127.0.0.1',
    '::ffff:a9fe:a9fe',
    'fd00::1',
    'fe80::1',
    '2002:7f00:1::',
    'not an address',
  ])('refuses %s', (address) => expect(isBlockedAddress(address)).toBe(true))

  it.each(['93.184.215.14', '8.8.8.8', '151.101.1.69', '2606:4700::6810:84e5', '2a00:1450:4001:82a::200e'])('allows %s', (address) => expect(isBlockedAddress(address)).toBe(false))
})

describe('normaliseUrl', () => {
  it('keeps one form of a link: case, port, fragment, trailing slash, sorted parameters, no tracking or affiliate codes', () => {
    expect(normaliseUrl(' HTTPS://Www.Example.COM:443/Books/Clean-Code/?utm_source=x&b=2&a=1&fbclid=abc#reviews ')).toBe('https://www.example.com/Books/Clean-Code?a=1&b=2')
    expect(normaliseUrl('https://www.amazon.in/dp/0132350882?tag=someone-21&linkCode=ll1&ref_=as_li')).toBe('https://www.amazon.in/dp/0132350882')
    expect(normaliseUrl('http://example.com')).toBe('http://example.com/')
    expect(normaliseUrl('https://example.com/watch?v=abc&t=10')).toBe('https://example.com/watch?t=10&v=abc')
  })

  it.each([
    ['ftp://example.com/file', 'Use a web address that starts with http:// or https://.'],
    ['javascript:alert(1)', 'Use a web address that starts with http:// or https://.'],
    ['https://user:pass@example.com/', 'Leave the user name and password out of the address.'],
    ['http://localhost:3000/', 'That is not a public web address.'],
    ['not a url', 'That is not a web address.'],
  ])('refuses %s', (raw, message) => expect(() => normaliseUrl(raw)).toThrow(new InvalidUrlError(message)))
})

describe('isbn13', () => {
  it('turns ISBN-10 into ISBN-13 and checks both check digits', () => {
    expect(isbn13('0-13-235088-2')).toBe('9780132350884')
    expect(isbn13('978-0-13-235088-4')).toBe('9780132350884')
    expect(isbn13('080442957X')).toBe('9780804429573')
    expect(isbn13('0132350883')).toBeNull()
    expect(isbn13('9780132350885')).toBeNull()
    expect(isbn13('12345')).toBeNull()
  })
})

describe('readPageMeta', () => {
  it('prefers OpenGraph, decodes entities and makes the picture absolute', () => {
    const html = `<!doctype html><html><head>
      <title>Plain title</title>
      <meta name="description" content="Plain description">
      <meta property="og:title" content="Clean Code &amp; Craft">
      <meta property='og:description' content="A handbook of agile &#8220;craftsmanship&#8221;">
      <meta property="og:image" content="/covers/clean-code.jpg">
      <meta property="og:site_name" content="Example Books">
      <meta property="og:type" content="book">
      <meta property="book:isbn" content="9780132350884">
      <meta name="author" content="Robert C. Martin">
      </head><body><meta property="og:title" content="Not this one"></body></html>`
    expect(readPageMeta(html, 'https://books.example.com/clean-code')).toEqual({
      title: 'Clean Code & Craft',
      description: 'A handbook of agile “craftsmanship”',
      image: 'https://books.example.com/covers/clean-code.jpg',
      siteName: 'Example Books',
      type: 'book',
      isbn: '9780132350884',
      author: 'Robert C. Martin',
    })
  })

  it('falls back to the title tag, and ignores pictures that are not web addresses and authors that are links', () => {
    const meta = readPageMeta('<head><title> A   course </title><meta property="og:image" content="javascript:alert(1)"><meta name="author" content="https://example.com/me"></head>', 'https://example.com/')
    expect(meta).toMatchObject({ title: 'A course', description: null, image: null, author: null })
  })
})

describe('SafeFetcher', () => {
  let server: Server
  let base: string
  const routes = new Map<string, (res: ServerResponse) => void>()
  beforeAll(async () => {
    server = createServer((req, res) => {
      const handle = routes.get(req.url ?? '')
      if (handle) handle(res)
      else res.writeHead(404).end()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    routes.set('/page', (res) => res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<head><title>Hello</title></head>'))
    routes.set('/json', (res) => res.writeHead(200, { 'content-type': 'application/json' }).end('{}'))
    routes.set('/big', (res) => res.writeHead(200, { 'content-type': 'text/html' }).end('x'.repeat(2_000)))
    routes.set('/bomb', (res) => res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' }).end(gzipSync(Buffer.alloc(5_000_000))))
    routes.set('/gzip', (res) => res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' }).end(gzipSync('<title>zipped</title>')))
    routes.set('/slow', () => undefined)
    routes.set('/to-page', (res) => res.writeHead(302, { location: '/page' }).end())
    routes.set('/loop', (res) => res.writeHead(302, { location: '/loop' }).end())
    routes.set('/to-metadata', (res) => res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' }).end())
    routes.set('/to-localhost', (res) => res.writeHead(301, { location: `http://localhost:${(server.address() as AddressInfo).port}/page` }).end())
    routes.set('/missing', (res) => res.writeHead(410).end())
  })
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  const allowed = () => new SafeFetcher({ userAgent: 'LearnViaNotes-test', allowHosts: ['127.0.0.1'], timeoutMs: 1_000 })
  const html = (url: string, maxBytes = 1_000) => ({ url, accept: 'text/html', maxBytes, types: /^text\/html$/ })
  const failure = async (p: Promise<unknown>) => {
    try {
      await p
    } catch (err) {
      return err instanceof SafeFetchError ? err.code : String(err)
    }
    return 'resolved'
  }

  it('refuses this machine and private networks, by number or by name, and unusual ports, without allowing hosts', async () => {
    const strict = new SafeFetcher({ userAgent: 'LearnViaNotes-test', timeoutMs: 1_000 })
    expect(await failure(strict.fetch(html('http://127.0.0.1/page')))).toBe('BLOCKED')
    expect(await failure(strict.fetch(html('http://[::1]/page')))).toBe('BLOCKED')
    expect(await failure(strict.fetch(html('http://169.254.169.254/latest/meta-data/')))).toBe('BLOCKED')
    expect(await failure(strict.fetch(html('http://localhost/page')))).toBe('BLOCKED')
    expect(await failure(strict.fetch(html(`${base}/page`)))).toBe('BLOCKED')
    expect(await failure(strict.fetch(html('https://example.com:8443/')))).toBe('BLOCKED')
    expect(await failure(strict.fetch(html('file:///etc/passwd')))).toBe('INVALID_URL')
    expect(await failure(strict.fetch(html('https://user:pw@example.com/')))).toBe('INVALID_URL')
  })

  it('fetches an allowed host, follows a redirect, and reads gzip', async () => {
    const res = await allowed().fetch(html(`${base}/to-page`))
    expect(res).toMatchObject({ url: `${base}/page`, contentType: 'text/html' })
    expect(res.body.toString()).toBe('<head><title>Hello</title></head>')
    expect((await allowed().fetch(html(`${base}/gzip`))).body.toString()).toBe('<title>zipped</title>')
  })

  it('checks every redirect again: to the metadata service, or to a name that is not allowed', async () => {
    expect(await failure(allowed().fetch(html(`${base}/to-metadata`)))).toBe('BLOCKED')
    expect(await failure(allowed().fetch(html(`${base}/to-localhost`)))).toBe('BLOCKED')
    expect(await failure(allowed().fetch(html(`${base}/loop`)))).toBe('REDIRECTS')
  })

  it('bounds size (after decompression), time and type, and reports refusals', async () => {
    expect(await failure(allowed().fetch(html(`${base}/big`)))).toBe('TOO_LARGE')
    expect(await failure(allowed().fetch(html(`${base}/bomb`, 1_000_000)))).toBe('TOO_LARGE')
    expect(await failure(allowed().fetch(html(`${base}/slow`)))).toBe('TIMEOUT')
    expect(await failure(allowed().fetch(html(`${base}/json`)))).toBe('TYPE')
    const gone = await allowed().fetch(html(`${base}/missing`)).catch((e: SafeFetchError) => e)
    expect(gone).toMatchObject({ code: 'HTTP', status: 410 })
  })
})
