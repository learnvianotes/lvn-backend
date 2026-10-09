import { createServer, type Server } from 'node:net'

/** The EICAR test string every antivirus treats as a virus. */
export const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'

/**
 * A PDF the real ClamAV calls infected: EICAR as the body of a stream object, which clamd unpacks and scans on its own
 * (EICAR elsewhere in a file is not matched, as the test string must start what is scanned). Checked against ClamAV
 * 1.5.4 on the local environment: `Eicar-Signature FOUND`.
 */
export const EICAR_PDF = Buffer.from(`%PDF-1.7\n1 0 obj\n<< /Length ${EICAR.length} >>\nstream\n${EICAR}\nendstream\nendobj\ntrailer << >>\n%%EOF\n`, 'latin1')

/**
 * A stand-in for ClamAV's clamd (ADR-0041): speaks zINSTREAM and finds the EICAR string anywhere in the stream. The
 * real clamd runs on the local environment; this keeps tests fast and offline.
 */
export async function startFakeClamd(): Promise<{ url: string; scans: number; close: () => Promise<void> }> {
  const state = { scans: 0 }
  const server: Server = createServer((socket) => {
    let buffer = Buffer.alloc(0)
    let started = false
    const chunks: Buffer[] = []
    socket.on('data', (d: Buffer) => {
      buffer = Buffer.concat([buffer, d])
      if (!started) {
        const end = buffer.indexOf(0)
        if (end < 0) return
        if (buffer.subarray(0, end).toString() !== 'zINSTREAM') return void socket.end('UNKNOWN COMMAND\0')
        buffer = buffer.subarray(end + 1)
        started = true
      }
      while (buffer.length >= 4) {
        const size = buffer.readUInt32BE(0)
        if (size === 0) {
          state.scans++
          const body = Buffer.concat(chunks).toString('latin1')
          socket.end(body.includes(EICAR) ? 'stream: Eicar-Test-Signature FOUND\0' : 'stream: OK\0')
          return
        }
        if (buffer.length < 4 + size) return
        chunks.push(buffer.subarray(4, 4 + size))
        buffer = buffer.subarray(4 + size)
      }
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as { port: number }
  return {
    url: `tcp://127.0.0.1:${port}`,
    get scans() {
      return state.scans
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
