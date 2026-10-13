import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { Inject, Injectable } from '@nestjs/common'
import { FILES, type Files } from '@lvn-backend/facades'
import { AiGateway } from './ai-gateway'

const run = promisify(execFile)
/** One piece the model hears at a time (ADR-0062) */
export const PIECE_SECONDS = 30
/** The most of a recording that is transcribed */
export const MAX_SECONDS = 30 * 60
/** Photos a quick note reads, and their longest side */
export const MAX_IMAGES = 4
const IMAGE_SIDE = 1280
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
