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

export interface VoiceNoteInput {
  noteId: string
  fileId?: string | null
  captions?: string | null
  transcript?: string | null
}

const TRANSCRIPT_CHARS = 20_000
const notesSchema = z.object({
  summary: z.string().min(1),
  title: z.string().min(1).max(200),
  sections: z.array(z.object({ heading: z.string().min(1), text: z.string().min(1) })).min(1).max(12),
})

/**
 * Voice notes: transcribe an uploaded recording, a short caption clip, or turn a transcript into a private note.
 * Uploads are scanned by completeUpload. Browser captions are text and are not stored.
 */
@Injectable()
export class VoiceNotesService {
  constructor(
    @Inject(FILES) private readonly files: Files,
    @Inject(NOTE_AI) private readonly notes: NoteAi,
    private readonly media: MediaInput,
    private readonly gateway: AiGateway,
  ) {}

  /** Describes the browser. The note must be one this person can read, or a public note when they are signed out. */
  async captureFor(userId: string | null, input: VoiceNoteInput) {
    await this.readable(userId, input.noteId)
    return VOICE_CAPTURE
  }

  async transcribeFile(userId: string, input: VoiceNoteInput): Promise<{ text: string; cut: boolean }> {
    await this.readable(userId, input.noteId)
    if (!input.fileId) throw Errors.validation('Upload the recording first.', ['input', 'fileId'])
    return this.recording(userId, input.noteId, input.fileId)
  }

  /** Browser captions when they are present. Otherwise the uploaded clip. */
  async transcribeCaption(userId: string, input: VoiceNoteInput): Promise<{ text: string; cut: boolean }> {
    await this.readable(userId, input.noteId)
    const captions = input.captions?.trim() ?? ''
    if (captions) return { text: captions.slice(0, TRANSCRIPT_CHARS), cut: captions.length > TRANSCRIPT_CHARS }
    if (input.fileId) return this.recording(userId, input.noteId, input.fileId)
    throw Errors.validation('Send the captions or the clip.', ['input', 'captions'])
  }

  /** A private note: a summary, then a heading and text for each section. The transcript is capped at 20,000 characters. */
  async notesFromTranscript(userId: string, input: VoiceNoteInput): Promise<{ noteId: string; title: string; summary: string }> {
    await this.readable(userId, input.noteId)
    const written = (input.transcript ?? input.captions ?? '').trim()
    const heard = written ? { text: written, cut: written.length > TRANSCRIPT_CHARS } : input.fileId ? await this.recording(userId, input.noteId, input.fileId) : null
    const text = heard?.text.trim().slice(0, TRANSCRIPT_CHARS) ?? ''
    if (!text) throw Errors.validation('There is nothing to turn into notes.', ['input', 'transcript'])
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

  private async readable(userId: string | null, noteId: string): Promise<void> {
    const source = userId ? await this.notes.source(userId, noteId) : await this.notes.publicSource(noteId)
    if (!source) throw Errors.notFound('Note not found.')
  }

  private async recording(userId: string, noteId: string, fileId: string): Promise<{ text: string; cut: boolean }> {
    const [file] = await this.files.describe([fileId])
    if (!file || file.ownerId !== userId || file.status !== 'READY') throw Errors.notFound('Recording not found.')
    if (file.parentId && file.parentId !== noteId && file.parentId !== userId) throw Errors.validation('That recording belongs to another note.', ['input', 'fileId'])
    if (file.purpose !== 'VOICE_NOTE' && file.purpose !== 'ATTACHMENT') throw Errors.validation('That file is not a recording.', ['input', 'fileId'])
    if (!file.mimeType.startsWith('audio/') && !file.mimeType.startsWith('video/')) throw Errors.validation('That file is not a recording.', ['input', 'fileId'])
    return this.media.transcribe(fileId, { userId, private: true })
  }
}
