import { createReadStream } from 'node:fs'
import { connect } from 'node:net'

export type ScanOutcome = { result: 'CLEAN' } | { result: 'INFECTED'; signature: string }

/**
 * Scans a file with ClamAV's clamd over TCP (ADR-0041): `zINSTREAM`, the file in length-prefixed chunks, a zero-length
 * chunk, then one answer — `stream: OK` or `stream: <signature> FOUND`. Anything else (a size limit, a dropped
 * connection, a timeout) is an error the caller retries.
 */
export function clamdScan(target: { host: string; port: number }, path: string, timeoutMs = 120_000): Promise<ScanOutcome> {
  return new Promise((resolve, reject) => {
    const socket = connect(target)
    let answer = ''
    let settled = false
    const done = (fn: () => void) => {
      if (settled) return
      settled = true
      socket.destroy()
      fn()
    }
    socket.setTimeout(timeoutMs, () => done(() => reject(new Error('clamd did not answer in time'))))
    socket.on('error', (e) => done(() => reject(e)))
    socket.on('data', (d) => {
      answer += d.toString('utf8')
      if (!answer.includes('\0') && !answer.includes('\n')) return
      const text = answer.replace(/[\0\n]+$/, '').trim()
      const found = /^stream: (.+) FOUND$/.exec(text)
      if (text === 'stream: OK') done(() => resolve({ result: 'CLEAN' }))
      else if (found) done(() => resolve({ result: 'INFECTED', signature: found[1]! }))
      else done(() => reject(new Error(`clamd: ${text.slice(0, 200)}`)))
    })
    socket.on('close', () => done(() => reject(new Error(`clamd closed the connection${answer ? `: ${answer.slice(0, 200)}` : ''}`))))
    socket.on('connect', () => {
      void (async () => {
        try {
          socket.write('zINSTREAM\0')
          for await (const chunk of createReadStream(path, { highWaterMark: 64 * 1024 }) as AsyncIterable<Buffer>) {
            const size = Buffer.alloc(4)
            size.writeUInt32BE(chunk.length)
            if (!socket.write(Buffer.concat([size, chunk]))) await new Promise((r) => socket.once('drain', r))
            if (settled) return
          }
          socket.write(Buffer.alloc(4))
        } catch (e) {
          done(() => reject(e as Error))
        }
      })()
    })
  })
}
