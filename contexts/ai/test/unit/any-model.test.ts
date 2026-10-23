import { startFakeAnthropic, startFakeOpenAi, type FakeProvider } from '@lvn-backend/testing'
import { AnthropicProvider } from '../../src/infrastructure/anthropic'
import { OpenAiProvider } from '../../src/infrastructure/openai'

/**
 * Any model a provider lists can be chosen on /admin/ai and answer (ADR-0065): every model is listed, page after page;
 * an older Claude that writes fewer tokens is asked for its own maximum; a Claude that rejects a forced tool is asked
 * again with tool_choice auto; a model without JSON-schema answers is asked for JSON, and one that also refuses a JSON
 * object is asked with the schema in its instructions. Against local stand-ins for Anthropic's and OpenAI's APIs.
 */
describe('any model the account lists', () => {
  let claude: FakeProvider
  let openai: FakeProvider

  beforeAll(async () => {
    ;[claude, openai] = await Promise.all([startFakeAnthropic(), startFakeOpenAi()])
  })
  afterAll(async () => {
    await Promise.all([claude?.stop(), openai?.stop()])
  })
  beforeEach(() => {
    claude.requests.length = 0
    openai.requests.length = 0
    claude.answer = () => 'OK'
    openai.answer = () => 'OK'
    openai.modelPageSize = null
    openai.models = ['gpt-test', 'text-embedding-test']
  })

  it('lists every OpenAI model, following pages of 12, with no cap and no preset filter', async () => {
    openai.modelPageSize = 12
    openai.models = [...Array.from({ length: 148 }, (_, i) => `gpt-page-${String(i).padStart(3, '0')}`), 'gpt-image-1', 'brand-new-model']
    const listed = await new OpenAiProvider('OPENAI', openai.url, 'sk-test', false).models(5_000)
    expect(listed).toHaveLength(150)
    expect(listed).toEqual([...openai.models].sort())
    const pages = openai.requests.filter((r) => r.path === '/v1/models')
    expect(pages).toHaveLength(13)
    expect(pages[0]!.query.get('after')).toBeNull()
    expect(pages[1]!.query.get('after')).toBe('gpt-page-011')
    expect(pages[12]!.query.get('after')).toBe('gpt-page-143')
  })

  it('lists every Claude model, following the pages', async () => {
    claude.models = Array.from({ length: 2345 }, (_, i) => `claude-${String(i).padStart(4, '0')}`)
    const listed = await new AnthropicProvider(claude.url, 'sk-test', false).models(5_000)
    expect(listed).toHaveLength(2345)
    expect(claude.requests.map((r) => r.query.get('after_id'))).toEqual([null, 'claude-0999', 'claude-1999'])
    claude.models = ['claude-test']
  })

  it('asks an older Claude again for no more than its own maximum of tokens', async () => {
    claude.answer = (req) =>
      (req.body.max_tokens as number) > 4096 ? { status: 400, body: JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'max_tokens: 8192 > 4096, which is the maximum allowed number of output tokens for claude-3-haiku-20240307' } }) } : 'OK'
    const res = await new AnthropicProvider(claude.url, 'sk-test', false).chat({ model: 'claude-3-haiku-20240307', messages: [{ role: 'user', content: 'Hi' }], timeoutMs: 5_000 })
    expect(res.text).toBe('OK')
    expect(claude.requests.map((r) => r.body.max_tokens)).toEqual([8192, 4096])
  })

  it('still fails in the provider’s words when a retry cannot help', async () => {
    claude.answer = () => ({ status: 400, body: '{"type":"error","error":{"message":"model: not_a_model"}}' })
    await expect(new AnthropicProvider(claude.url, 'sk-test', false).chat({ model: 'not_a_model', messages: [{ role: 'user', content: 'Hi' }], timeoutMs: 5_000 })).rejects.toThrow(/400.*not_a_model/)
    expect(claude.requests).toHaveLength(1)
  })

  const FORCED_TOOL = JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'tool_choice: type "tool" and "any" are not supported for this model.' } })
  const schema = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] }

  it.each(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'])('asks %s again with tool_choice auto when it rejects a forced tool', async (model) => {
    const provider = new AnthropicProvider(claude.url, 'sk-test', false)
    claude.answer = (req) => ((req.body.tool_choice as { type?: string } | undefined)?.type === 'tool' ? { status: 400, body: FORCED_TOOL } : '{"answer":"OK"}')
    const res = await provider.chat({ model, messages: [{ role: 'user', content: 'Hi' }], schema, timeoutMs: 5_000 })
    expect(res.text).toBe('{"answer":"OK"}')
    expect(claude.requests.map((r) => (r.body.tool_choice as { type: string }).type)).toEqual(['tool', 'auto'])
    expect(claude.requests[1]!.body.tools).toHaveLength(1)
    expect(claude.requests[0]!.body.system).toBeUndefined()
    expect(claude.requests[1]!.body.system).toEqual(expect.stringContaining('calling the answer tool'))
    // The next call starts in the mode this model accepts.
    claude.requests.length = 0
    await provider.chat({ model, messages: [{ role: 'user', content: 'Hi again' }], schema, timeoutMs: 5_000 })
    expect(claude.requests.map((r) => (r.body.tool_choice as { type: string }).type)).toEqual(['auto'])
  })

  it('still forces the tool for an older Claude that accepts it', async () => {
    claude.answer = () => '{"answer":"OK"}'
    await new AnthropicProvider(claude.url, 'sk-test', false).chat({ model: 'claude-sonnet-4-5', messages: [{ role: 'user', content: 'Hi' }], schema, timeoutMs: 5_000 })
    expect(claude.requests).toHaveLength(1)
    expect(claude.requests[0]!.body.tool_choice).toEqual({ type: 'tool', name: 'answer' })
  })

  it('asks once with tool_choice auto and then stops when that is refused too', async () => {
    claude.answer = () => ({ status: 400, body: FORCED_TOOL })
    await expect(new AnthropicProvider(claude.url, 'sk-test', false).chat({ model: 'claude-sonnet-5-5', messages: [{ role: 'user', content: 'Hi' }], schema, timeoutMs: 5_000 })).rejects.toThrow(/400/)
    expect(claude.requests.map((r) => (r.body.tool_choice as { type: string }).type)).toEqual(['tool', 'auto'])
  })

  it('asks a model without JSON-schema answers for JSON, with the schema in its instructions', async () => {
    openai.answer = (req) => ((req.body.response_format as { type: string }).type === 'json_schema' ? { status: 400, body: JSON.stringify({ error: { message: "Invalid parameter: 'response_format' of type 'json_schema' is not supported with this model." } }) } : '{"answer":"OK"}')
    const schema = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] }
    const res = await new OpenAiProvider('OPENAI', openai.url, 'sk-test', false).chat({ model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: 'Hi' }], schema, timeoutMs: 5_000 })
    expect(res.text).toBe('{"answer":"OK"}')
    const retry = openai.requests[1]!.body
    expect(retry.response_format).toEqual({ type: 'json_object' })
    expect((retry.messages as { role: string; content: string }[])[0]).toEqual({ role: 'system', content: expect.stringContaining('"required":["answer"]') })
  })

  it('asks for JSON with no response format when the model rejects both json_schema and json_object', async () => {
    openai.answer = (req) => {
      const format = (req.body.response_format as { type?: string } | undefined)?.type
      if (format === 'json_schema' || format === 'json_object') return { status: 400, body: JSON.stringify({ error: { message: `Invalid parameter: 'response_format' of type '${format}' is not supported with this model.` } }) }
      return '{"answer":"OK"}'
    }
    const shape = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] }
    const res = await new OpenAiProvider('OPENAI', openai.url, 'sk-test', false).chat({ model: 'gpt-old', messages: [{ role: 'user', content: 'Hi' }], schema: shape, timeoutMs: 5_000 })
    expect(res.text).toBe('{"answer":"OK"}')
    expect(openai.requests.map((r) => (r.body.response_format as { type?: string } | undefined)?.type)).toEqual(['json_schema', 'json_object', undefined])
    expect((openai.requests[2]!.body.messages as { content: string }[])[0]!.content).toEqual(expect.stringContaining('"required":["answer"]'))
  })

  it('does not retry an OpenAI 400 that is not about the response format', async () => {
    openai.answer = () => ({ status: 400, body: JSON.stringify({ error: { message: 'model not found' } }) })
    await expect(new OpenAiProvider('OPENAI', openai.url, 'sk-test', false).chat({ model: 'missing', messages: [{ role: 'user', content: 'Hi' }], schema: { type: 'object' }, timeoutMs: 5_000 })).rejects.toThrow(/400/)
    expect(openai.requests).toHaveLength(1)
  })
})
