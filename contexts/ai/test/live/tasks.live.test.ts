import { z } from 'zod'
import { PromptLibrary } from '../../src/application/prompts'
import { TASKS } from '../../src/domain/tasks'
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

  it.each(Object.values(TASKS).map((def) => [def.task, def] as const))('%s gives a usable result', async (_, def) => {
    const rendered = prompts.render(def.prompt, { language: 'English', target: 'Hindi', sentences: 4 }, { title: 'Shortest paths', body: NOTE })
    const answer = await ollama.chat({ model: 'gemma4', messages: rendered.messages, schema: z.toJSONSchema(def.schema) as object, timeoutMs: 180_000 })
    const parsed = def.schema.safeParse(JSON.parse(answer.text))
    expect(parsed.success ? null : parsed.error.issues.slice(0, 3)).toBeNull()
    const result = def.result(parsed.data, 'Shortest paths')
    // "No mistakes found." is a fine answer about a correct note.
    if ('markdown' in result) expect(result.markdown.length).toBeGreaterThan(10)
    else expect(result.cards.length).toBeGreaterThan(0)
  }, 240_000)
})
