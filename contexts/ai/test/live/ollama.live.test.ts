import { OllamaProvider } from '../../src/infrastructure/ollama'

/**
 * The Ollama adapter against a real local model (ADR-0058). Runs only with LVN_TEST_OLLAMA_URL (for example
 * http://127.0.0.1:11434) and the models of the local environment pulled: gemma4 and embeddinggemma.
 */
const url = process.env.LVN_TEST_OLLAMA_URL
;(url ? describe : describe.skip)('Ollama, live', () => {
  const ollama = new OllamaProvider(url ?? '')

  it('answers in a JSON schema, streams text, and embeds', async () => {
    const schema = { type: 'object', properties: { concepts: { type: 'array', items: { type: 'string' } } }, required: ['concepts'] }
    const shaped = await ollama.chat({ model: 'gemma4', messages: [{ role: 'user', content: 'List two key concepts of binary heaps.' }], schema, timeoutMs: 120_000 })
    expect((JSON.parse(shaped.text) as { concepts: string[] }).concepts.length).toBeGreaterThan(0)
    expect(shaped.promptTokens).toBeGreaterThan(0)
    const pieces: string[] = []
    const streamed = await ollama.chat({ model: 'gemma4', messages: [{ role: 'user', content: 'Say "ready" and nothing else.' }], timeoutMs: 120_000 }, (t) => pieces.push(t))
    expect(streamed.text.toLowerCase()).toContain('ready')
    expect(pieces.join('')).toBe(streamed.text)
    const embedded = await ollama.embed('embeddinggemma', ['a heap', 'a priority queue'], 60_000)
    expect(embedded.vectors.map((v) => v.length)).toEqual([768, 768])
  }, 240_000)
})
