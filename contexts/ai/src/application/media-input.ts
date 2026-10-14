import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { Inject, Injectable } from '@nestjs/common'
import { QuickNoteLimits } from '@lvn/contracts/domain'
import { FILES, type Files } from '@lvn-backend/facades'
import { REDIS } from '@lvn-backend/redis'
import type Redis from 'ioredis'
import { getDocumentProxy } from 'unpdf'
import { AiGateway } from './ai-gateway'
import { blocksMarkdown, pageSchema, plainSymbols } from './page-vision'

const run = promisify(execFile)
/** One piece the model hears at a time (ADR-0062) */
export const PIECE_SECONDS = 30
/** The most of a recording that is transcribed */
export const MAX_SECONDS = 30 * 60
/**
 * Photos a quick note reads (ADR-0084), and how many go to the model with the request: more are each read on their own
 * first, as a PDF page is, so ten fit a small model's context (a photo is about 540 of a local model's 4,096 tokens).
 */
export const MAX_IMAGES = QuickNoteLimits.files
export const IMAGES_TOGETHER = 4
/** PDFs a quick note reads the words of, and the pages read of each */
export const MAX_PDFS = QuickNoteLimits.files
export const PDF_PAGES = 60
/** A photo's longest side as the model sees it */
const IMAGE_SIDE = 1280
/** How long what a photo says is kept, so a photo is read once for all its note's tasks (ADR-0085) */
const PHOTO_TEXT_SECONDS = 30 * 24 * 3600
const FFMPEG_TIMEOUT_MS = 10 * 60_000

/**
 * Recordings and pictures as the local model takes them (ADR-0058, ADR-0062). A recording is cut with ffmpeg into
 * 30-second pieces of 16 kHz mono WAV, each transcribed in order; a picture becomes a JPEG of at most 1,280 pixels.
 * Both arrive as the chat message's `images`, as Ollama passes every attachment to a multimodal model.
 */
@Injectable()
export class MediaInput {
  constructor(
    @Inject(FILES) private readonly files: Files,
    private readonly gateway: AiGateway,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** What a recording (an audio or video file) says; `cut` when it ran past MAX_SECONDS. */
  async transcribe(fileId: string, who: { userId: string | null; private: boolean }): Promise<{ text: string; cut: boolean }> {
    return this.inTemp(async (dir) => {
      const source = path.join(dir, 'source')
      await this.files.download(fileId, source, 'audio')
      const seconds = await duration(source)
      await run('ffmpeg', ['-v', 'error', '-y', '-i', source, '-t', String(MAX_SECONDS), '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', '-f', 'segment', '-segment_time', String(PIECE_SECONDS), path.join(dir, 'piece%03d.wav')], { timeout: FFMPEG_TIMEOUT_MS })
      const pieces = (await readdir(dir)).filter((f) => f.startsWith('piece')).sort()
      const texts: string[] = []
      for (const [i, piece] of pieces.entries()) {
        const sound = (await readFile(path.join(dir, piece))).toString('base64')
        const heard = await this.gateway.generate({ task: 'TRANSCRIBE', userId: who.userId, private: who.private, prompt: 'transcribe', vars: { part: i + 1, parts: pieces.length }, images: [sound], temperature: 0 })
        // The prompt's fence rule mentions <content> tags; with nothing fenced, a model may wrap its answer in them.
        texts.push(heard.output.replace(/<\/?content>/g, '').trim())
      }
      return { text: texts.filter(Boolean).join('\n\n'), cut: seconds !== null && seconds > MAX_SECONDS }
    })
  }

  /** Pictures as base64 JPEGs, from their medium size when it was made. */
  async images(fileIds: string[]): Promise<string[]> {
    return this.inTemp(async (dir) => {
      const out: string[] = []
      for (const [i, fileId] of fileIds.slice(0, MAX_IMAGES).entries()) {
        const source = path.join(dir, `image${i}`)
        const jpeg = path.join(dir, `image${i}.jpg`)
        await this.files.download(fileId, source, 'medium')
        await run('ffmpeg', ['-v', 'error', '-y', '-i', source, '-vf', `scale='min(${IMAGE_SIDE},iw)':-2`, '-frames:v', '1', '-q:v', '3', jpeg], { timeout: 60_000 })
        out.push((await readFile(jpeg)).toString('base64'))
      }
      return out
    })
  }

  /**
   * What a photo says, read on its own as a PDF page is (READ_PAGE's model and prompt, ADR-0063), as the work of
   * whoever asked (ADR-0084). The reading is kept for PHOTO_TEXT_SECONDS by file, so the note's other tasks do not read
   * it again (ADR-0085).
   */
  async readPhoto(fileId: string, who: { userId: string | null; private: boolean }): Promise<string> {
    const key = `ai:photo-text:${fileId}`
    const kept = await this.redis.get(key).catch(() => null)
    // Readings kept before symbols were made plain (ADR-0086) are made plain as they are read.
    if (kept !== null) return plainSymbols(kept)
    const [jpeg] = await this.images([fileId])
    const read = await this.gateway.generate({ task: 'READ_PAGE', userId: who.userId, private: who.private, prompt: 'read-page', images: [jpeg!], schema: pageSchema, temperature: 0 })
    const text = blocksMarkdown(read.output.blocks)
    await this.redis.set(key, text, 'EX', PHOTO_TEXT_SECONDS).catch(() => undefined)
    return text
  }

  /**
   * A PDF's words, page by page up to PDF_PAGES (ADR-0084). Empty when it has none (a scan, which Convert PDF reads),
   * cannot be opened (a password) or is not a PDF.
   */
  async pdfText(fileId: string): Promise<string> {
    return this.inTemp(async (dir) => {
      const source = path.join(dir, 'source.pdf')
      const { mimeType } = await this.files.download(fileId, source)
      if (mimeType !== 'application/pdf') return ''
      try {
        const pdf = await getDocumentProxy(new Uint8Array(await readFile(source)))
        const pages: string[] = []
        for (let i = 1; i <= Math.min(pdf.numPages, PDF_PAGES); i++) {
          const content = await (await pdf.getPage(i)).getTextContent()
          pages.push(content.items.map((item) => ('str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '')).join('').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim())
        }
        return pages.filter(Boolean).join('\n\n')
      } catch {
        return ''
      }
    })
  }

  private async inTemp<T>(work: (dir: string) => Promise<T>): Promise<T> {
    const dir = await mkdtemp(path.join(tmpdir(), 'lvn-ai-media-'))
    try {
      return await work(dir)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }
}

async function duration(file: string): Promise<number | null> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { timeout: 60_000 })
  const seconds = Number.parseFloat(stdout.trim())
  return Number.isFinite(seconds) ? seconds : null
}
