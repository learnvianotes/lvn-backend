import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { callProvider, serverSentEvents } from '../../src/infrastructure/http'
import { isMetadataAddress, parseProviderUrl, ProviderUrlError } from '../../src/domain/provider-url'
import { ProviderError } from '../../src/domain/provider'

function listen(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<{ server: Server; url: string }> {
  const server = createServer(handler)
  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('no port')
      resolve({ server, url: `http://127.0.0.1:${address.port}` })
    })
  })
}

describe('provider addresses', () => {
  it('accepts a public provider, a private host and loopback', () => {
    expect(parseProviderUrl('https://api.openai.com/v1').hostname).toBe('api.openai.com')
    expect(parseProviderUrl('http://gpu-host:11434').origin).toBe('http://gpu-host:11434')
    expect(parseProviderUrl('http://10.0.0.5:11434/v1').hostname).toBe('10.0.0.5')
    expect(parseProviderUrl('http://127.0.0.1:9').hostname).toBe('127.0.0.1')
    expect(parseProviderUrl('http://[::1]:11434/').hostname).toBe('[::1]')
    expect(isMetadataAddress('10.1.2.3')).toBe(false)
    expect(isMetadataAddress('127.0.0.1')).toBe(false)
  })

  it('refuses metadata and link-local addresses, in every spelling Node would connect to', () => {
    const refused = [
      'http://169.254.169.254/latest/meta-data/',
      'http://169.254.170.2/',
      'http://2852039166/latest/meta-data/',
      'http://0xa9fea9fe/',
      'http://0251.0376.0251.0376/',
      'http://[::ffff:169.254.169.254]/',
      'http://[fd00:ec2::254]/latest/meta-data/',
      'http://[fe80::1]/',
      'http://100.100.100.200/latest/meta-data/',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://metadata.goog/',
    ]
    for (const url of refused) expect(() => parseProviderUrl(url)).toThrow(ProviderUrlError)
    expect(isMetadataAddress('169.254.169.254')).toBe(true)
    expect(isMetadataAddress('::ffff:a9fe:a9fe')).toBe(true)
    expect(isMetadataAddress('fd00:ec2::254')).toBe(true)
    expect(isMetadataAddress('fe80::1')).toBe(true)
    expect(isMetadataAddress('100.100.100.200')).toBe(true)
    expect(isMetadataAddress('100.64.0.1')).toBe(false)
  })

  it('refuses a scheme or credentials that are not an http(s) provider', () => {
    expect(() => parseProviderUrl('file:///etc/passwd')).toThrow(/http or https/)
    expect(() => parseProviderUrl('http://user:secret@api.openai.com/v1')).toThrow(/user name or password/)
    expect(() => parseProviderUrl('not a url')).toThrow(ProviderUrlError)
  })

  it('reads a streamed answer from a loopback stand-in', async () => {
    const { server, url } = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.end('data: {"ok":true}\n\n')
    })
    try {
      const res = await callProvider('TEST', `${url}/v1/chat`, {}, { n: 1 }, 2_000)
      const events: string[] = []
      for await (const event of serverSentEvents(res)) events.push(event)
      expect(events).toEqual(['{"ok":true}'])
    } finally {
      server.close()
    }
  })

  it('does not follow a redirect, including one aimed at another host', async () => {
    let nextHits = 0
    const next = await listen((_req, res) => {
      nextHits += 1
      res.end('credentials')
    })
    const { server, url } = await listen((_req, res) => {
      res.writeHead(302, { location: `${next.url}/latest/meta-data/` })
      res.end()
    })
    try {
      const error = await callProvider('TEST', `${url}/v1`, {}, {}, 2_000).then(
        () => null,
        (e: unknown) => e,
      )
      expect(error).toBeInstanceOf(ProviderError)
      expect((error as ProviderError).retryable).toBe(false)
      expect((error as ProviderError).message).toMatch(/redirected/)
      expect(nextHits).toBe(0)
    } finally {
      server.close()
      next.server.close()
    }
  })

  it('resolves a loopback name and still reaches the stand-in', async () => {
    const { server, url } = await listen((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')
    })
    const port = new URL(url).port
    try {
      const res = await callProvider('TEST', `http://localhost:${port}/v1`, {}, {}, 2_000)
      expect(await res.json()).toEqual({ ok: true })
    } finally {
      server.close()
    }
  })

  it('does not call a metadata address that was stored before the check', async () => {
    const started = Date.now()
    const error = await callProvider('TEST', 'http://169.254.169.254/latest/meta-data/', {}, {}, 2_000).then(
      () => null,
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(ProviderError)
    expect((error as ProviderError).retryable).toBe(false)
    expect((error as ProviderError).message).toMatch(/metadata or link-local/)
    expect(Date.now() - started).toBeLessThan(1_000)
  })
})
