import { startFakeAnthropic, startFakeOpenAi, type FakeProvider } from '@lvn-backend/testing'
import { AnthropicProvider } from '../../src/infrastructure/anthropic'
import { OpenAiProvider } from '../../src/infrastructure/openai'

/**
 * Any model a provider lists can be chosen on /admin/ai and answer (ADR-0065): every model is listed, page after page;
 * an older Claude that writes fewer tokens is asked for its own maximum; a model without JSON-schema answers is asked
 * for JSON with the schema in its instructions. Against local stand-ins for Anthropic's and OpenAI's APIs.
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

  it('asks a model without JSON-schema answers for JSON, with the schema in its instructions', async () => {
    openai.answer = (req) => ((req.body.response_format as { type: string }).type === 'json_schema' ? { status: 400, body: JSON.stringify({ error: { message: "Invalid parameter: 'response_format' of type 'json_schema' is not supported with this model." } }) } : '{"answer":"OK"}')
    const schema = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] }
    const res = await new OpenAiProvider('OPENAI', openai.url, 'sk-test', false).chat({ model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: 'Hi' }], schema, timeoutMs: 5_000 })
    expect(res.text).toBe('{"answer":"OK"}')
    const retry = openai.requests[1]!.body
    expect(retry.response_format).toEqual({ type: 'json_object' })
    expect((retry.messages as { role: string; content: string }[])[0]).toEqual({ role: 'system', content: expect.stringContaining('"required":["answer"]') })
  })
})
