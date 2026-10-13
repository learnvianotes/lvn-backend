import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fakeEmbedding, type FakeChatAnswer } from './ollama'

/** One request a stand-in provider received: its path, headers and JSON body. */
export interface FakeProviderRequest {
  path: string
  headers: IncomingMessage['headers']
  body: Record<string, unknown>
}

export interface FakeProvider {
  /** The base URL a connection points at (OpenAI's ends in /v1) */
  url: string
  requests: FakeProviderRequest[]
  /** Answers chats; by default "OK" */
  answer: (req: FakeProviderRequest) => FakeChatAnswer
  /** OpenAI-style only: refuse `temperature` (as OpenAI's reasoning models do) */
  refuseTemperature: boolean
  /** OpenAI-style only: refuse `dimensions`, giving vectors of `nativeDimensions` */
  refuseDimensions: boolean
  nativeDimensions: number
  models: string[]
  stop(): Promise<void>
}

const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let data = ''
    req.on('data', (c: Buffer) => (data += c.toString()))
    req.on('end', () => resolve(data))
  })

const words = (text: string) => text.split(/\s+/).filter(Boolean).length
const contentText = (content: unknown): string => (typeof content === 'string' ? content : Array.isArray(content) ? content.map((p: { text?: string }) => p.text ?? '').join(' ') : '')

async function serve(fake: Omit<FakeProvider, 'url' | 'stop'>, handle: (req: FakeProviderRequest, res: ServerResponse) => void, prefix: string): Promise<FakeProvider> {
  const server: Server = createServer(async (req, res) => {
    const raw = await readBody(req)
    const request: FakeProviderRequest = { path: (req.url ?? '').split('?')[0]!, headers: req.headers, body: raw ? (JSON.parse(raw) as Record<string, unknown>) : {} }
    fake.requests.push(request)
    handle(request, res)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return Object.assign(fake, { url: `http://127.0.0.1:${port}${prefix}`, stop: () => new Promise<void>((resolve) => (server.close(() => resolve()), server.closeAllConnections())) }) as FakeProvider
}

const defaults = (): Omit<FakeProvider, 'url' | 'stop'> => ({ requests: [], answer: () => 'OK', refuseTemperature: false, refuseDimensions: false, nativeDimensions: 768, models: [] })

/**
 * A stand-in for OpenAI's Chat Completions and Embeddings API (ADR-0065), as OpenAI, Gemini's compatible endpoint and a
 * LiteLLM proxy speak it: /v1/chat/completions (streamed as server-sent events with a last usage chunk, or not),
 * /v1/embeddings (deterministic vectors, deliberately not of length 1) and /v1/models.
 */
export function startFakeOpenAi(): Promise<FakeProvider> {
  const fake = { ...defaults(), models: ['gpt-test', 'text-embedding-test'] }
  return serve(
    fake,
    (req, res) => {
      const json = (status: number, body: unknown) => void res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body))
      if (req.path === '/v1/models') return json(200, { object: 'list', data: fake.models.map((id) => ({ id, object: 'model' })) })
      if (req.path === '/v1/embeddings') {
        if (fake.refuseDimensions && req.body.dimensions !== undefined) return json(400, { error: { message: 'This model does not support specifying dimensions.' } })
        const inputs = (Array.isArray(req.body.input) ? req.body.input : [req.body.input]) as string[]
        const size = (req.body.dimensions as number | undefined) ?? fake.nativeDimensions
        return json(200, { data: inputs.map((t, index) => ({ index, embedding: fakeEmbedding(t, size).map((x) => x * 3) })).reverse(), usage: { prompt_tokens: words(inputs.join(' ')) } })
      }
      if (req.path !== '/v1/chat/completions') return void res.writeHead(404).end()
      if (fake.refuseTemperature && req.body.temperature !== undefined) return json(400, { error: { message: "Unsupported value: 'temperature' does not support 0 with this model." } })
      const answer = fake.answer(req)
      if (typeof answer !== 'string') return void res.writeHead(answer.status).end(answer.body ?? '')
      const usage = { prompt_tokens: words((req.body.messages as { content: unknown }[]).map((m) => contentText(m.content)).join(' ')), completion_tokens: words(answer) }
      if (!req.body.stream) return json(200, { choices: [{ index: 0, message: { role: 'assistant', content: answer } }], usage })
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      for (const piece of answer.match(/\S+\s*/g) ?? []) res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: piece } }] })}\n\n`)
      res.write(`data: ${JSON.stringify({ choices: [], usage })}\n\n`)
      res.end('data: [DONE]\n\n')
    },
    '/v1',
  )
}

/**
 * A stand-in for Anthropic's Messages API (ADR-0065): /v1/messages answers a forced tool call with the answer parsed as
 * the tool's input, or text (streamed as Anthropic's events, or not); /v1/models lists models.
 */
export function startFakeAnthropic(): Promise<FakeProvider> {
  const fake = { ...defaults(), models: ['claude-test'] }
  return serve(
    fake,
    (req, res) => {
      const json = (status: number, body: unknown) => void res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body))
      if (req.path === '/v1/models') return json(200, { data: fake.models.map((id) => ({ id, type: 'model' })), has_more: false })
      if (req.path !== '/v1/messages') return void res.writeHead(404).end()
      if (!req.headers['x-api-key']) return json(401, { type: 'error', error: { type: 'authentication_error', message: 'x-api-key header is required' } })
      const answer = fake.answer(req)
      if (typeof answer !== 'string') return void res.writeHead(answer.status).end(answer.body ?? '')
      const usage = { input_tokens: words([req.body.system ?? '', ...(req.body.messages as { content: unknown }[]).map((m) => contentText(m.content))].join(' ')), output_tokens: words(answer) }
      const tools = req.body.tools as { name: string }[] | undefined
      if (tools?.length) return json(200, { type: 'message', role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: tools[0]!.name, input: JSON.parse(answer) as unknown }], stop_reason: 'tool_use', usage })
      if (!req.body.stream) return json(200, { type: 'message', role: 'assistant', content: [{ type: 'text', text: answer }], stop_reason: 'end_turn', usage })
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      const send = (type: string, data: object) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`)
      send('message_start', { message: { type: 'message', usage: { input_tokens: usage.input_tokens, output_tokens: 1 } } })
      send('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
      for (const piece of answer.match(/\S+\s*/g) ?? []) send('content_block_delta', { index: 0, delta: { type: 'text_delta', text: piece } })
      send('content_block_stop', { index: 0 })
      send('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: usage.output_tokens } })
      send('message_stop', {})
      res.end()
    },
    '',
  )
}
