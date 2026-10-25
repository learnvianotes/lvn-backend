import { request as httpRequest } from 'node:http'
import type { IncomingHttpHeaders } from 'node:http'
import { randomBytes } from 'node:crypto'
import { SCAN_HEADERS, sha256Bytes, sign } from '@lvn-backend/scanner-protocol'

export function signedHeaders(secret: string, body: Buffer, mime: string, fields?: { timestamp: string; nonce: string }): Record<string, string> {
  const signed = {
    timestamp: fields?.timestamp ?? String(Math.floor(Date.now() / 1000)),
    nonce: fields?.nonce ?? randomBytes(16).toString('hex'),
    sha256: sha256Bytes(body),
    contentLength: String(body.length),
    mime,
  }
  return {
    [SCAN_HEADERS.timestamp]: signed.timestamp,
    [SCAN_HEADERS.nonce]: signed.nonce,
    [SCAN_HEADERS.sha256]: signed.sha256,
    [SCAN_HEADERS.signature]: sign(secret, signed),
    [SCAN_HEADERS.mime]: signed.mime,
    'content-length': signed.contentLength,
  }
}

/** node:http, so Content-Length is the signed length (fetch may drop it on a GET). */
export function signedRequest(url: string, secret: string, body: Buffer, mime: string, headers = signedHeaders(secret, body, mime)): Promise<{ status: number; body: string; headers: IncomingHttpHeaders }> {
  const target = new URL(url)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      target,
      { method: body.length || target.pathname === '/v1/scan' ? 'POST' : 'GET', headers },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), headers: res.headers }))
      },
    )
    req.on('error', reject)
    req.end(body)
  })
}
