import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { PromptLibrary } from '../../src/application/prompts'
import { TASKS } from '../../src/domain/tasks'
import { OllamaProvider } from '../../src/infrastructure/ollama'

/**
 * Voice and photos against the real local model (ADR-0062): gemma4 hears a recording through the chat's `images` and
 * writes what is said; it reads a photo of rough notes and writes a structured note. Runs only with
 * LVN_TEST_OLLAMA_URL; the transcription also needs LVN_TEST_SPEECH_WAV, a recording of the Open Speech Repository's
 * Harvard sentences list 1 (OSR_us_000_0010_8k.wav), and the photo a system font.
 */
const url = process.env.LVN_TEST_OLLAMA_URL
const speech = process.env.LVN_TEST_SPEECH_WAV
const FONT = ['/usr/share/fonts/TTF/DejaVuSans.ttf', '/usr/share/fonts/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'].find(existsSync)
const ffmpeg = (...args: string[]) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args])

;(url ? describe : describe.skip)('voice and photos, live', () => {
  const ollama = new OllamaProvider(url ?? '')
  const prompts = new PromptLibrary()
  let dir: string
  beforeAll(() => void (dir = mkdtempSync(path.join(tmpdir(), 'lvn-live-media-'))))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  ;(speech ? it : it.skip)('writes down what a recording says, from the first 30-second piece', async () => {
    const piece = path.join(dir, 'piece.wav')
    ffmpeg('-i', speech!, '-t', '30', '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', piece)
    const rendered = prompts.render('transcribe', { part: 1, parts: 1 })
    const messages = rendered.messages.map((m, i) => (i === rendered.messages.length - 1 ? { ...m, images: [readFileSync(piece).toString('base64')] } : m))
    const heard = await ollama.chat({ model: 'gemma4', messages, temperature: 0, timeoutMs: 180_000 })
    const words = heard.text.toLowerCase()
    for (const phrase of ['birch canoe', 'smooth planks', 'chicken leg', 'round bowls']) expect(words).toContain(phrase)
  }, 240_000)

  ;(FONT ? it : it.skip)('reads a photo of rough notes into a structured note', async () => {
    const photo = path.join(dir, 'notes.jpg')
    const lines = ['PHOTOSYNTHESIS', 'light -> chemical energy', 'in the chloroplast', 'chlorophyll absorbs red + blue']
    const draw = lines.map((l, i) => `drawtext=fontfile=${FONT}:text='${l}':x=60:y=${80 + i * 110}:fontsize=64:fontcolor=black`).join(',')
    ffmpeg('-f', 'lavfi', '-i', 'color=c=white:s=1280x560', '-vf', draw, '-frames:v', '1', photo)
    const def = TASKS.QUICK_NOTE
    const rendered = prompts.render(def.prompt, { language: 'English' }, { title: 'Untitled note', body: '(Only the photos.)' })
    const messages = rendered.messages.map((m, i) => (i === rendered.messages.length - 1 ? { ...m, images: [readFileSync(photo).toString('base64')] } : m))
    const answer = await ollama.chat({ model: 'gemma4', messages, schema: z.toJSONSchema(def.schema) as object, temperature: 0.2, timeoutMs: 180_000 })
    const parsed = def.schema.safeParse(JSON.parse(answer.text))
    expect(parsed.success ? null : parsed.error.issues.slice(0, 2)).toBeNull()
    const result = def.result(parsed.data, 'Untitled note')
    expect('cards' in result && result.cards.length).toBeGreaterThan(1)
    expect(answer.text.toLowerCase()).toMatch(/chloroplast|chlorophyll/)
  }, 240_000)
})
