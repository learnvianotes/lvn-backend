import { createReadStream } from 'node:fs'
import { connect } from 'node:net'

export type ClamdTarget = { host: string; port: number }
export type ClamdOutcome = { result: 'CLEAN' } | { result: 'INFECTED'; signature: string }

/** One clamd command (`zPING`, `zVERSION`) and its reply, without a file. */
export function clamdCommand(target: ClamdTarget, command: string, timeoutMs: number): Promise<string> {
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
    socket.setTimeout(timeoutMs, () => done(() => reject(new Error(`clamd ${command} timed out`))))
    socket.on('error', (e) => done(() => reject(e)))
    socket.on('data', (d) => {
      answer += d.toString('utf8')
      if (answer.includes('\0') || answer.includes('\n')) done(() => resolve(answer.replace(/[\0\n]+$/, '').trim()))
    })
    socket.on('close', () => done(() => reject(new Error(`clamd closed the connection${answer ? `: ${answer.slice(0, 200)}` : ''}`))))
    socket.on('connect', () => socket.write(`z${command}\0`))
  })
}

/**
 * Scans a file with clamd `zINSTREAM` (ADR-0041): length-prefixed chunks and a zero-length chunk. `stream: OK` is
 * clean; `stream: <signature> FOUND` is infected. Anything else is an error the caller retries.
 */
export function clamdScan(target: ClamdTarget, file: string, timeoutMs: number): Promise<ClamdOutcome> {
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
      const signature = /^stream: (.+) FOUND$/.exec(text)?.[1]
      if (text === 'stream: OK') done(() => resolve({ result: 'CLEAN' }))
      else if (signature) done(() => resolve({ result: 'INFECTED', signature: signature.slice(0, 200) }))
      else done(() => reject(new Error(`clamd: ${text.slice(0, 200)}`)))
    })
    socket.on('close', () => done(() => reject(new Error(`clamd closed the connection${answer ? `: ${answer.slice(0, 200)}` : ''}`))))
    socket.on('connect', () => {
      void (async () => {
        try {
          socket.write('zINSTREAM\0')
          for await (const chunk of createReadStream(file, { highWaterMark: 64 * 1024 }) as AsyncIterable<Buffer>) {
            const size = Buffer.alloc(4)
            size.writeUInt32BE(chunk.length)
            if (!socket.write(Buffer.concat([size, chunk]))) await new Promise((r) => socket.once('drain', r))
            if (settled) return
          }
          socket.write(Buffer.alloc(4))
        } catch (e) {
          done(() => reject(e instanceof Error ? e : new Error('clamd stream failed')))
        }
      })()
    })
  })
}

/** Hours since the date in a `VERSION` reply (`ClamAV 1.5.4/27600/Sun Oct 25 08:32:00 2026`). Null when it has none. */
export function signatureAgeHours(version: string, now = Date.now()): number | null {
  const date = version.split('/').slice(2).join('/').trim()
  const ms = Date.parse(date)
  if (!Number.isFinite(ms)) return null
  return (now - ms) / 3_600_000
}
