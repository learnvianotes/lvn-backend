import { execFile, execFileSync } from 'node:child_process'
import { connect } from 'node:net'
import { promisify } from 'node:util'
import { loadScannerConfig } from '../../src/config'
import { createScanServer } from '../../src/server'
import { signedRequest } from '../unit/signed'

const run = promisify(execFile)
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
const SECRET = 'integration-secret-integration-secret'

function dockerAvailable(): boolean {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore', timeout: 15_000 })
    return true
  } catch {
    return false
  }
}

/** Real ClamAV, in Docker when it is available. The HTTP service under test is this package. */
const suite = dockerAvailable() ? describe : describe.skip

suite('ClamAV EICAR', () => {
  jest.setTimeout(360_000)
  const name = `lvn-scanner-eicar-${process.pid}`
  let url = ''
  let close = async () => {}

  beforeAll(async () => {
    await run('docker', ['rm', '-f', name]).catch(() => undefined)
    await run('docker', [
      'run', '-d', '--name', name, '--memory', '1600m', '-p', '127.0.0.1::3310',
      '-e', 'CLAMD_CONF_StreamMaxLength=20M',
      '-e', 'CLAMD_CONF_MaxScanSize=20M',
      '-e', 'CLAMD_CONF_MaxFileSize=20M',
      '-e', 'CLAMD_CONF_ConcurrentDatabaseReload=no',
      'clamav/clamav:1.5.4',
    ])
    const started = Date.now()
    let port = ''
    while (Date.now() - started < 300_000) {
      const mapped = await run('docker', ['port', name, '3310']).then((r) => r.stdout.trim()).catch(() => '')
      port = mapped.split(':').pop() ?? ''
      if (port && await ping(Number(port))) break
      await new Promise((r) => setTimeout(r, 3_000))
    }
    if (!port || !(await ping(Number(port)))) {
      const logs = await run('docker', ['logs', '--tail', '80', name]).then((r) => `${r.stdout}\n${r.stderr}`).catch(() => '')
      throw new Error(`clamd did not become ready\n${logs}`)
    }
    const startedServer = createScanServer(loadScannerConfig({
      SCANNER_SECRET: SECRET,
      CLAMAV_URL: `tcp://127.0.0.1:${port}`,
      SCANNER_SIGNATURE_MAX_AGE_HOURS: '72',
    }))
    await new Promise<void>((resolve) => startedServer.server.listen(0, '127.0.0.1', resolve))
    const address = startedServer.server.address()
    if (!address || typeof address === 'string') throw new Error('no port')
    url = `http://127.0.0.1:${address.port}`
    close = () => startedServer.close()
  })

  afterAll(async () => {
    await close()
    await run('docker', ['rm', '-f', name]).catch(() => undefined)
  })

  it('quarantine-classifies the EICAR test file and accepts a clean buffer', async () => {
    const infected = await signedRequest(`${url}/v1/scan`, SECRET, Buffer.from(EICAR), 'text/plain')
    expect(infected.status).toBe(200)
    expect(JSON.parse(infected.body)).toMatchObject({ result: 'infected', signature: expect.stringMatching(/Eicar/i) })
    const clean = await signedRequest(`${url}/v1/scan`, SECRET, Buffer.from('hello from the scanner\n'), 'text/plain')
    expect(clean.status).toBe(200)
    expect(JSON.parse(clean.body)).toEqual({ result: 'clean', pageCount: null })
  })
})

function ping(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port }, () => {
      socket.write('zPING\0')
    })
    let data = ''
    const timer = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, 2_000)
    socket.on('data', (d: Buffer) => {
      data += d.toString()
      if (data.includes('PONG')) {
        clearTimeout(timer)
        socket.destroy()
        resolve(true)
      }
    })
    socket.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
  })
}
