import { randomBytes } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { EMPTY_SHA256, SCAN_HEADERS, sign } from '@lvn-backend/scanner-protocol'
import { loadScannerConfig } from './config'

/**
 * Container health check. Signs an empty GET /readyz the same way a caller does, and exits non-zero unless the
 * scanner reports ready (clamd answering, signatures fresh). node:http keeps the Content-Length the signature covers.
 */
async function main(): Promise<void> {
  const config = loadScannerConfig(process.env)
  const host = config.bind === '0.0.0.0' || config.bind === '::' ? '127.0.0.1' : config.bind
  const fields = {
    timestamp: String(Math.floor(Date.now() / 1000)),
    nonce: randomBytes(16).toString('hex'),
    sha256: EMPTY_SHA256,
    contentLength: '0',
    mime: 'application/octet-stream',
  }
  const signature = sign(config.secret, fields)
  const status = await new Promise<number>((resolve, reject) => {
    const req = httpRequest(
      {
        host,
        port: config.port,
        path: '/readyz',
        method: 'GET',
        headers: {
          [SCAN_HEADERS.timestamp]: fields.timestamp,
          [SCAN_HEADERS.nonce]: fields.nonce,
          [SCAN_HEADERS.sha256]: fields.sha256,
          [SCAN_HEADERS.signature]: signature,
          [SCAN_HEADERS.mime]: fields.mime,
          'content-length': '0',
        },
        timeout: 8_000,
      },
      (res) => {
        res.resume()
        res.on('end', () => resolve(res.statusCode ?? 0))
      },
    )
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('readyz timed out')))
    req.end()
  })
  process.exit(status === 200 ? 0 : 1)
}

main().catch(() => process.exit(1))
