import { z } from 'zod'
import { PromptLibrary } from '../../src/application/prompts'
import { TASKS } from '../../src/domain/tasks'
import { scriptShare } from '../../src/domain/translate'
import { OllamaProvider } from '../../src/infrastructure/ollama'

/**
 * Every AI task's prompt against the real local model (ADR-0058, ADR-0059): the answer parses as the task's schema
 * and gives Markdown or valid cards. Runs only with LVN_TEST_OLLAMA_URL.
 */
const url = process.env.LVN_TEST_OLLAMA_URL
const NOTE = `Dijkstra's algorithm finds the shortest paths from one vertex to every other vertex of a graph whose edge weights
are not negative. It keeps a priority queue of vertices ordered by their distance so far, and repeatedly settles the
closest unsettled vertex, relaxing its edges. With a binary heap it runs in O((V + E) log V). It fails with negative
edges; Bellman-Ford handles them. In Python, heapq gives the priority queue:

import heapq
heapq.heappush(queue, (0, source))`

;(url ? describe : describe.skip)('AI tasks, live', () => {
  const ollama = new OllamaProvider(url ?? '')
  const prompts = new PromptLibrary()

  // Transcribe hears a recording and Clean up mends batches: media.live and pdf-ai.live test them with what they read.
  const OWN_TESTS = new Set(['TRANSCRIBE', 'CLEAN_UP'])
  it.each(Object.values(TASKS).filter((def) => !OWN_TESTS.has(def.task)).map((def) => [def.task, def] as const))('%s gives a usable result', async (_, def) => {
    const rendered = prompts.render(def.prompt, { language: 'English', target: 'Hindi', sentences: 4, insist: '' }, { title: 'Shortest paths', body: NOTE })
    // A plain task (TRANSLATE, ADR-0086) is answered in text, not JSON.
    const answer = await ollama.chat({ model: 'gemma4', messages: rendered.messages, ...(def.plain ? { temperature: 0.2 } : { schema: z.toJSONSchema(def.schema) as object }), timeoutMs: 180_000 })
    const parsed = def.schema.safeParse(def.plain ? answer.text : JSON.parse(answer.text))
    expect(parsed.success ? null : parsed.error.issues.slice(0, 3)).toBeNull()
    const result = def.result(parsed.data, 'Shortest paths')
    // "No mistakes found." is a fine answer about a correct note.
    if ('markdown' in result) expect(result.markdown.length).toBeGreaterThan(10)
    else if ('cards' in result) expect(result.cards.length).toBeGreaterThan(0)
    else expect(Array.isArray(result.changes)).toBe(true)
  }, 240_000)

  // App screens and short labels are what the model most often leaves in English (ADR-0086).
  it.each([
    ['TELUGU', 'Telugu'],
    ['HINDI', 'Hindi'],
  ] as const)('translates short labels and sentences into %s script', async (language, target) => {
    const body = 'Alternate Travel Plan\nGet confirmed ticket or 3x Refund\n\n## Alternate Tickets\n\nBook available tickets for the same train from other stations on your route.\n\n## More trains from nearby stations\n\n- Filters\n- AC only\n- Recommended'
    const rendered = prompts.render('translate', { target, insist: '' }, { title: 'Quick note', body })
    const answer = await ollama.chat({ model: 'gemma4', messages: rendered.messages, temperature: 0.2, timeoutMs: 180_000 })
    expect(scriptShare(answer.text, language)).toBeGreaterThan(0.5)
  }, 240_000)
})
