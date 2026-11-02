import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { VoiceNotesService, type VoiceNoteInput } from '../application/voice-notes.service'

type CapturePayload = { voiceCapture: { api: string; interimResults: boolean; continuous: boolean; languages: readonly string[]; streamingFallback: string } | null; userErrors: UserError[] }
type TranscriptPayload = { transcript: { text: string; cut: boolean } | null; userErrors: UserError[] }
type NotesPayload = { notes: { noteId: string; title: string; summary: string } | null; userErrors: UserError[] }

/** Transcription and notes made from a transcript. */
@Resolver()
export class VoiceResolver {
  constructor(private readonly voice: VoiceNotesService) {}

  @Query('voiceCapture')
  voiceCapture(@Args('input') input: VoiceNoteInput, @CurrentViewer() viewer: Viewer | null): Promise<CapturePayload> {
    return withUserErrors<CapturePayload>(async () => ({ voiceCapture: await this.voice.captureFor(viewer?.userId ?? null, input) }), { voiceCapture: null })
  }

  @Mutation('transcribeAudio')
  @UseGuards(SignedInGuard)
  transcribeAudio(@Args('input') input: VoiceNoteInput, @CurrentViewer() viewer: Viewer): Promise<TranscriptPayload> {
    return withUserErrors<TranscriptPayload>(async () => ({ transcript: await this.voice.transcribeFile(viewer.userId, input) }), { transcript: null })
  }

  @Mutation('transcribeCaptionClip')
  @UseGuards(SignedInGuard)
  transcribeCaptionClip(@Args('input') input: VoiceNoteInput, @CurrentViewer() viewer: Viewer): Promise<TranscriptPayload> {
    return withUserErrors<TranscriptPayload>(async () => ({ transcript: await this.voice.transcribeCaption(viewer.userId, input) }), { transcript: null })
  }

  @Mutation('makeNotesFromTranscript')
  @UseGuards(SignedInGuard)
  makeNotesFromTranscript(@Args('input') input: VoiceNoteInput, @CurrentViewer() viewer: Viewer): Promise<NotesPayload> {
    return withUserErrors<NotesPayload>(async () => ({ notes: await this.voice.notesFromTranscript(viewer.userId, input) }), { notes: null })
  }
}
