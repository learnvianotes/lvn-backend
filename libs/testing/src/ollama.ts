import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

export interface FakeChatRequest {
  model: string
  messages: { role: string; content: string; images?: string[] }[]
  stream?: boolean
  format?: unknown
}

/** What the stand-in answers: text (JSON text when a format was asked), or an HTTP status to fail with. */
export type FakeChatAnswer = string | { status: number; body?: string }

export interface FakeOllama {
  url: string
  /** Every chat request, in order */
  chats: FakeChatRequest[]
  /** Answers chats; by default echoes the last message's first 40 characters */
  answer: (req: FakeChatRequest) => FakeChatAnswer
  stop(): Promise<void>
}

const body = (req: IncomingMessage) => new Promise<string>((resolve) => {
  let data = ''
  req.on('data', (c: Buffer) => (data += c.toString()))
  req.on('end', () => resolve(data))
})

/** A deterministic vector for a text: similar words make similar vectors (a bag of hashed words). */
export function fakeEmbedding(text: string, dims = 768): number[] {
  const v = new Array<number>(dims).fill(0)
  for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    let h = 2166136261
    for (const ch of word) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619)
    v[Math.abs(h) % dims]! += 1
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
  return v.map((x) => x / norm)
}

/**
 * A stand-in for Ollama's HTTP API (ADR-0058) in tests: /api/chat (streamed or not, with token counts) and /api/embed
 * (deterministic vectors). Tests set `answer` to script the model.
 */
export async function startFakeOllama(): Promise<FakeOllama> {
  const fake: Omit<FakeOllama, 'url' | 'stop'> = { chats: [], answer: (req) => req.messages.at(-1)!.content.slice(0, 40) }
  const server: Server = createServer(async (req, res) => {
    const json = JSON.parse((await body(req)) || '{}') as Record<string, unknown>
    if (req.url === '/api/embed') {
      const inputs = (Array.isArray(json.input) ? json.input : [json.input]) as string[]
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ embeddings: inputs.map((t) => fakeEmbedding(t)), prompt_eval_count: inputs.join(' ').split(/\s+/).length }))
      return
    }
    if (req.url !== '/api/chat') return void res.writeHead(404).end()
    const chat = json as unknown as FakeChatRequest
    fake.chats.push(chat)
    const answer = fake.answer(chat)
    if (typeof answer !== 'string') return void res.writeHead(answer.status).end(answer.body ?? '')
    const promptTokens = chat.messages.map((m) => m.content).join(' ').split(/\s+/).length
    const completionTokens = answer.split(/\s+/).length
    if (!chat.stream) {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ message: { role: 'assistant', content: answer }, done: true, prompt_eval_count: promptTokens, eval_count: completionTokens }))
      return
    }
    res.writeHead(200, { 'content-type': 'application/x-ndjson' })
    for (const piece of answer.match(/\S+\s*/g) ?? []) res.write(`${JSON.stringify({ message: { role: 'assistant', content: piece }, done: false })}\n`)
    res.end(`${JSON.stringify({ message: { role: 'assistant', content: '' }, done: true, prompt_eval_count: promptTokens, eval_count: completionTokens })}\n`)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return Object.assign(fake, { url: `http://127.0.0.1:${port}`, stop: () => new Promise<void>((resolve) => (server.close(() => resolve()), server.closeAllConnections())) }) as FakeOllama
}
