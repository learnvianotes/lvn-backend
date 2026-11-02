import { Inject, Injectable } from '@nestjs/common'
import { z } from 'zod'
import { CardType } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { FILES, NOTE_AI, type Files, type NoteAi } from '@lvn-backend/facades'
import { doc, inline, valid } from '../domain/tasks'
import { AiGateway } from './ai-gateway'
import { MediaInput } from './media-input'

/** What the web and mobile apps use for live captions. SpeechRecognition is in the browser; the clip mutation is the fallback. */
export const VOICE_CAPTURE = {
  api: 'SpeechRecognition',
  interimResults: true,
  continuous: true,
  languages: ['en-US', 'en-IN', 'hi-IN', 'te-IN'],
  streamingFallback: 'transcribeCaptionClip',
} as const

const TRANSCRIPT_CHARS = 20_000
const notesSchema = z.object({
  summary: z.string().min(1),
  title: z.string().min(1).max(200),
  sections: z.array(z.object({ heading: z.string().min(1), text: z.string().min(1) })).min(1).max(12),
})

/**
 * Voice notes: transcribe an uploaded recording, a short caption clip, or turn a transcript into a private note.
 * Uploads are scanned by completeUpload. Caption clips are not stored.
 */
@Injectable()
export class VoiceNotesService {
  constructor(
    @Inject(FILES) private readonly files: Files,
    @Inject(NOTE_AI) private readonly notes: NoteAi,
    private readonly media: MediaInput,
    private readonly gateway: AiGateway,
  ) {}

  capture() {
    return VOICE_CAPTURE
  }

  async transcribeFile(userId: string, fileId: string): Promise<{ text: string; cut: boolean }> {
    const [file] = await this.files.describe([fileId])
    if (!file || file.ownerId !== userId || file.status !== 'READY') throw Errors.notFound('Recording not found.')
    if (file.purpose !== 'VOICE_NOTE' && file.purpose !== 'ATTACHMENT') throw Errors.validation('That file is not a recording.', ['fileId'])
    if (!file.mimeType.startsWith('audio/') && !file.mimeType.startsWith('video/')) throw Errors.validation('That file is not a recording.', ['fileId'])
    return this.media.transcribe(fileId, { userId, private: true })
  }

  async transcribeClip(userId: string, audioBase64: string, mimeType: string): Promise<{ text: string; cut: boolean }> {
    let bytes: Buffer
    try {
      bytes = Buffer.from(audioBase64, 'base64')
    } catch {
      throw Errors.validation('The clip is not base64.', ['input', 'audioBase64'])
    }
    if (!bytes.length) throw Errors.validation('The clip is empty.', ['input', 'audioBase64'])
    return this.media.transcribeClip(bytes, mimeType, { userId, private: true })
  }

  /** A private note: a summary, then a heading and text for each section. The transcript is capped at 20,000 characters. */
  async notesFromTranscript(userId: string, transcript: string): Promise<{ noteId: string; title: string; summary: string }> {
    const text = transcript.trim().slice(0, TRANSCRIPT_CHARS)
    if (!text) throw Errors.validation('There is nothing to turn into notes.', ['transcript'])
    const generated = await this.gateway.generate({
      task: 'NOTES_FROM_TRANSCRIPT',
      userId,
      private: true,
      prompt: 'notes-from-transcript',
      content: { transcript: text },
      schema: notesSchema,
      temperature: 0.2,
    })
    const { title, summary, sections } = generated.output
    const cards = valid([
      { type: CardType.TEXT, content: { doc: doc(summary) } },
      ...sections.flatMap((section) => [
        { type: CardType.HEADING, content: { level: 2, content: inline(section.heading) } },
        { type: CardType.TEXT, content: { doc: doc(section.text) } },
      ]),
    ])
    if (!cards.length) throw Errors.unavailable('The AI’s answer could not be used. Try again.')
    const noteId = await this.notes.createNote(userId, { title: title.slice(0, 200), cards })
    return { noteId, title: title.slice(0, 200), summary }
  }
}
