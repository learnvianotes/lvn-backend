import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { OpenAiProvider } from '../../src/infrastructure/openai'

/** Whisper goes to /audio/transcriptions as multipart, not the JSON chat call. */
describe('OpenAI transcriptions', () => {
  let server: Server
  let url: string
  let contentType = ''
  let body = ''

  beforeAll(async () => {
    server = createServer(async (req, res) => {
      contentType = String(req.headers['content-type'] ?? '')
      body = await read(req)
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ text: 'heard the lecture' }))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  })

  it('posts the wav as multipart and does not send a chat body', async () => {
    const heard = await new OpenAiProvider('OPENAI', url, 'sk-test', false).transcribe({ model: 'whisper-1', wav: Buffer.from('RIFF'), timeoutMs: 5_000 })
    expect(heard.text).toBe('heard the lecture')
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/)
    expect(body).toContain('name="model"')
    expect(body).toContain('whisper-1')
    expect(body).toContain('filename="audio.wav"')
    expect(body).not.toContain('"messages"')
  })
})

const read = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
