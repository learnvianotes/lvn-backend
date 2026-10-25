import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'

function ncAvailable(): boolean {
  try {
    execFileSync('sh', ['-c', 'command -v nc'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const suite = ncAvailable() ? describe : describe.skip

suite('clamd reload after freshclam', () => {
  jest.setTimeout(20_000)

  it('sends RELOAD when the daily file is newer than the loaded database, and stops once it catches up', async () => {
    let version = 'ClamAV 1.5.4/100/Sat, 01 Jan 2020 00:00:00 GMT'
    let reloads = 0
    const server = createServer((socket) => {
      let buf = ''
      socket.on('data', (d: Buffer) => {
        buf += d.toString('utf8')
        if (!buf.includes('\n')) return
        const cmd = buf.trim()
        buf = ''
        if (cmd === 'nPING') socket.end('PONG\n')
        else if (cmd === 'nVERSION') socket.end(`${version}\n`)
        else if (cmd === 'nRELOAD') {
          reloads += 1
          version = 'ClamAV 1.5.4/200/Sat, 25 Oct 2026 00:00:00 GMT'
          socket.end('RELOADING\n')
        } else socket.end('UNKNOWN\n')
      })
    })
    const port = await listen(server)
    const dir = await mkdtemp(path.join(tmpdir(), 'lvn-clamdb-'))
    await writeFile(path.join(dir, 'daily.cvd'), 'ClamAV-VDB:25 Oct 2026 00-00 +0000:200:1:1:abc:def:builder:1\n')
    const child = spawn('sh', [path.join(__dirname, '../../clamd-reload.sh')], {
      env: {
        ...process.env,
        CLAMAV_HOST: '127.0.0.1',
        CLAMAV_PORT: String(port),
        CLAMAV_DB: dir,
        CLAMAV_RELOAD_INTERVAL: '1',
        CLAMAV_RELOAD_DEADLINE: '15',
      },
    })
    const output: Buffer[] = []
    child.stdout.on('data', (c: Buffer) => output.push(c))
    const code = await new Promise<number>((resolve) => child.on('exit', (status) => resolve(status ?? 1)))
    server.close()
    expect(code).toBe(0)
    expect(reloads).toBe(1)
    expect(Buffer.concat(output).toString()).toContain('database 200 is current')
  })
})

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('no port')
      resolve(address.port)
    })
  })
}
