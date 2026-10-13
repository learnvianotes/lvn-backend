import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { blocksText, blocksToCards, pageSchema } from '../../src/application/page-vision'
import { PromptLibrary } from '../../src/application/prompts'
import { batchText, isRepair } from '../../src/domain/clean-up'
import { repairs } from '../../src/domain/tasks'
import { OllamaProvider } from '../../src/infrastructure/ollama'

/**
 * The AI stages of PDF conversion against the real local model (ADR-0063): gemma4 reads a scanned page word for word
 * into blocks of our card types, and mends text that conversion broke without rewriting it. Runs only with
 * LVN_TEST_OLLAMA_URL; the page needs poppler's pdftoppm (as 144 dpi, the engine's rendering).
 */
const url = process.env.LVN_TEST_OLLAMA_URL
const SCAN = path.join(__dirname, '../../../../workers/pdf-engine/tests/fixtures/scanned.pdf')
const pdftoppm = ['/usr/bin/pdftoppm', '/usr/local/bin/pdftoppm'].find(existsSync)

;(url ? describe : describe.skip)('PDF pages and clean-up, live', () => {
  const ollama = new OllamaProvider(url ?? '')
  const prompts = new PromptLibrary()
  let dir: string
  beforeAll(() => void (dir = mkdtempSync(path.join(tmpdir(), 'lvn-live-pdf-'))))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  ;(pdftoppm ? it : it.skip)('reads a scanned page word for word, as cards of our types', async () => {
    execFileSync(pdftoppm!, ['-png', '-r', '144', '-f', '1', '-l', '1', '-singlefile', SCAN, path.join(dir, 'page')])
    const rendered = prompts.render('read-page')
    const messages = rendered.messages.map((m, i) => (i === rendered.messages.length - 1 ? { ...m, images: [readFileSync(path.join(dir, 'page.png')).toString('base64')] } : m))
    const answer = await ollama.chat({ model: 'gemma4', messages, schema: z.toJSONSchema(pageSchema) as object, temperature: 0, timeoutMs: 180_000 })
    const parsed = pageSchema.safeParse(JSON.parse(answer.text))
    expect(parsed.success ? null : parsed.error.issues.slice(0, 2)).toBeNull()
    const cards = blocksToCards(parsed.data!.blocks)
    expect(cards[0]).toMatchObject({ type: 'heading' })
    const words = blocksText(parsed.data!.blocks).replace(/\s+/g, ' ')
    for (const phrase of ['Chapter 4: Respiration', 'Respiration releases the energy stored in glucose', 'Aerobic respiration needs oxygen']) expect(words).toContain(phrase)
  }, 240_000)

  it('mends words conversion broke and leaves the rest as it is', async () => {
    const passages = [
      { text: 'Respiration releases the en- ergy stored in glucose.' },
      { text: 'Cells use tbis energy to grow, move 14 Biology Class X and repair themselves.' },
      { text: 'Aerobic respiration needs oxygen.' },
    ]
    const rendered = prompts.render('clean-up', {}, { passages: batchText(passages) })
    const answer = await ollama.chat({ model: 'gemma4', messages: rendered.messages, schema: z.toJSONSchema(repairs) as object, temperature: 0, timeoutMs: 180_000 })
    const { changes } = repairs.parse(JSON.parse(answer.text))
    const taken = changes.filter((c) => passages[c.n - 1] && isRepair(passages[c.n - 1]!.text, c.text))
    const after = (n: number) => taken.find((c) => c.n === n)?.text ?? passages[n - 1]!.text
    expect(after(1)).toContain('energy stored')
    expect(after(2)).toContain('this energy')
    expect(after(2)).not.toContain('Biology Class X')
    expect(after(3)).toBe('Aerobic respiration needs oxygen.')
  }, 240_000)
})
