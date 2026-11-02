import { UseGuards } from '@nestjs/common'
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { VoiceNotesService } from '../application/voice-notes.service'

type TranscriptPayload = { transcript: { text: string; cut: boolean } | null; userErrors: UserError[] }
type NotesPayload = { notes: { noteId: string; title: string; summary: string } | null; userErrors: UserError[] }

/** Transcription and notes made from a transcript. */
@Resolver()
export class VoiceResolver {
  constructor(private readonly voice: VoiceNotesService) {}

  @Query('voiceCapture')
  voiceCapture() {
    return this.voice.capture()
  }

  @Mutation('transcribeAudio')
  @UseGuards(SignedInGuard)
  transcribeAudio(@Args('fileId') fileId: string, @CurrentViewer() viewer: Viewer): Promise<TranscriptPayload> {
    return withUserErrors<TranscriptPayload>(async () => ({ transcript: await this.voice.transcribeFile(viewer.userId, fileId) }), { transcript: null })
  }

  @Mutation('transcribeCaptionClip')
  @UseGuards(SignedInGuard)
  transcribeCaptionClip(@Args('input') input: { audioBase64: string; mimeType: string }, @CurrentViewer() viewer: Viewer): Promise<TranscriptPayload> {
    return withUserErrors<TranscriptPayload>(async () => ({ transcript: await this.voice.transcribeClip(viewer.userId, input.audioBase64, input.mimeType) }), { transcript: null })
  }

  @Mutation('makeNotesFromTranscript')
  @UseGuards(SignedInGuard)
  makeNotesFromTranscript(@Args('transcript') transcript: string, @CurrentViewer() viewer: Viewer): Promise<NotesPayload> {
    return withUserErrors<NotesPayload>(async () => ({ notes: await this.voice.notesFromTranscript(viewer.userId, transcript) }), { notes: null })
  }
}
