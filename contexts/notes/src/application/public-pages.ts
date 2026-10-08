import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { NOTES_CONFIG, type NotesConfig } from '../notes.config'

/**
 * Public note pages are rendered and cached by the web app (`/n/[slug]-[id]`, P2d). When what the public can read of a
 * note changes — published, made public, held, hidden, trashed — the web app is told to drop its copy of that note
 * and of the sitemap list (Next.js on-demand revalidation by tag). Off unless WEB_REVALIDATE_URL and
 * REVALIDATE_SECRET are set; a failed call only delays the refresh to the page's revalidation window.
 */
@Injectable()
export class PublicPages implements OnModuleInit {
  private readonly log = new Logger('PublicPages')

  constructor(
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(NOTES_CONFIG) private readonly config: NotesConfig,
  ) {}

  onModuleInit(): void {
    if (!this.config.revalidate) return
    this.events.subscribe('NotePublished', (e) => (e.payload.visibility === 'PUBLIC' ? this.refresh(e.payload.noteId) : undefined))
    this.events.subscribe('NoteUnpublished', (e) => this.refresh(e.payload.noteId))
  }

  async refresh(noteId: string): Promise<void> {
    const target = this.config.revalidate
    if (!target) return
    try {
      const res = await fetch(target.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-revalidate-secret': target.secret },
        body: JSON.stringify({ tags: [`note:${noteId}`, 'public-notes'] }),
        signal: AbortSignal.timeout(5_000),
      })
      if (!res.ok) this.log.warn(`revalidation of note ${noteId} answered HTTP ${res.status}`)
    } catch (e) {
      this.log.warn(`revalidation of note ${noteId} failed: ${(e as Error).message}`)
    }
  }
}
