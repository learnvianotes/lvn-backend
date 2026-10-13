import { PromptLibrary } from '../../src/application/prompts'
import { citedSources, rerank, sourcesBlock, type Passage } from '../../src/domain/ask'
import { OllamaProvider } from '../../src/infrastructure/ollama'

/**
 * Ask AI against the real local model (ADR-0058, ADR-0060): embeddinggemma ranks the passage that answers a question
 * first, and gemma4 answers from the numbered sources, cites them, streams, and says so when they do not cover the
 * question. Runs only with LVN_TEST_OLLAMA_URL.
 */
const url = process.env.LVN_TEST_OLLAMA_URL
const passage = (noteId: string, title: string, text: string): Passage => ({ noteId, versionId: 'v1', title, public: true, cardIds: [`${noteId}-c`], text })
const NOTES = [
  passage('dijkstra', 'Shortest paths', "Dijkstra's algorithm finds shortest paths from one vertex when no edge weight is negative. It keeps a priority queue ordered by distance and settles the closest vertex first. With a binary heap it runs in O((V + E) log V)."),
  passage('photo', 'Photosynthesis', 'Plants turn light into chemical energy in the chloroplast. Chlorophyll absorbs red and blue light; the light reactions split water and release oxygen.'),
  passage('french', 'French Revolution', 'The French Revolution began in 1789 with the Estates-General and the storming of the Bastille on 14 July.'),
]
const cosine = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0) / (Math.hypot(...a) * Math.hypot(...b))

;(url ? describe : describe.skip)('Ask AI, live', () => {
  const ollama = new OllamaProvider(url ?? '')
  const prompts = new PromptLibrary()
  const answer = async (question: string, sources: Passage[]) => {
    let streamed = ''
    const rendered = prompts.render('ask', {}, { question, sources: sourcesBlock(sources) })
    const res = await ollama.chat({ model: 'gemma4', messages: rendered.messages, temperature: 0.2, timeoutMs: 180_000 }, (d) => (streamed += d))
    return { text: res.text, streamed }
  }

  it('ranks the passage that answers first by meaning, with 768-dimension vectors', async () => {
    const { vectors } = await ollama.embed('embeddinggemma', ['Which algorithm finds the cheapest route in a weighted graph?', ...NOTES.map((n) => `${n.title}\n\n${n.text}`)], 120_000)
    expect(vectors[0]).toHaveLength(768)
    const ranked = NOTES.map((n, i) => ({ ...n, similarity: cosine(vectors[0]!, vectors[i + 1]!) }))
    expect(rerank('Which algorithm finds the cheapest route in a weighted graph?', ranked)[0]!.noteId).toBe('dijkstra')
  }, 180_000)

  it('answers from the sources, citing them by number, as a stream', async () => {
    const { text, streamed } = await answer('How fast is Dijkstra with a binary heap?', NOTES)
    expect(streamed).toBe(text)
    expect(text).toMatch(/log/i)
    expect(citedSources(text, NOTES).map((s) => s.noteId)).toContain('dijkstra')
  }, 240_000)

  it('says the notes do not cover a question they do not', async () => {
    const { text } = await answer('Who won the 1983 Cricket World Cup?', NOTES)
    expect(text.toLowerCase()).toMatch(/not (cover|mention|contain|include)|no information|do not|does not|don't|doesn't/)
  }, 240_000)
})
