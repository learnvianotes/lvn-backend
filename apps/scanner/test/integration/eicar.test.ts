import { execFile, execFileSync } from 'node:child_process'
import path from 'node:path'
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
  jest.setTimeout(600_000)
  const name = `lvn-scanner-eicar-${process.pid}`
  let url = ''
  let close = async () => {}

  beforeAll(async () => {
    await run('docker', ['rm', '-f', name]).catch(() => undefined)
    const root = path.resolve(__dirname, '../..')
    // The image database is old. The same entrypoint as compose reloads clamd after freshclam.
    await run('docker', [
      'run', '-d', '--name', name, '--memory', '1600m', '-p', '127.0.0.1::3310',
      '-e', 'CLAMD_CONF_StreamMaxLength=20M',
      '-e', 'CLAMD_CONF_MaxScanSize=20M',
      '-e', 'CLAMD_CONF_MaxFileSize=20M',
      '-e', 'CLAMD_CONF_ConcurrentDatabaseReload=no',
      '-v', `${path.join(root, 'clamd-entry.sh')}:/opt/lvn/clamd-entry.sh:ro`,
      '-v', `${path.join(root, 'clamd-reload.sh')}:/opt/lvn/clamd-reload.sh:ro`,
      '--entrypoint', '/bin/sh',
      'clamav/clamav:1.5.4',
      '/opt/lvn/clamd-entry.sh',
    ])
    const mapped = await waitFor(() => run('docker', ['port', name, '3310']).then((r) => r.stdout.trim().split(':').pop() ?? ''), 30_000)
    if (!mapped) throw new Error('clamd port was not published')
    const startedServer = createScanServer(loadScannerConfig({
      SCANNER_SECRET: SECRET,
      CLAMAV_URL: `tcp://127.0.0.1:${mapped}`,
      SCANNER_SIGNATURE_MAX_AGE_HOURS: '72',
    }))
    await new Promise<void>((resolve) => startedServer.server.listen(0, '127.0.0.1', resolve))
    const address = startedServer.server.address()
    if (!address || typeof address === 'string') throw new Error('no port')
    url = `http://127.0.0.1:${address.port}`
    close = () => startedServer.close()
    const ready = await waitFor(async () => {
      const res = await signedRequest(`${url}/readyz`, SECRET, Buffer.alloc(0), 'application/octet-stream').catch(() => null)
      return res?.status === 200 ? res.body : ''
    }, 540_000)
    if (!ready) {
      const logs = await run('docker', ['logs', '--tail', '120', name]).then((r) => `${r.stdout}\n${r.stderr}`).catch(() => '')
      throw new Error(`scanner stayed not-ready; freshclam did not reload clamd in time\n${logs}`)
    }
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

/** Poll until `read` returns a non-empty string, or the budget runs out. */
async function waitFor(read: () => Promise<string>, budgetMs: number): Promise<string> {
  const started = Date.now()
  while (Date.now() - started < budgetMs) {
    const value = await read().catch(() => '')
    if (value) return value
    await new Promise((r) => setTimeout(r, 5_000))
  }
  return ''
}
