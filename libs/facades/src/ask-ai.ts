import type { LiveEventKind } from '@lvn/contracts/notifications'
import type { Visibility } from '@lvn/contracts/domain'

/**
 * What Ask AI needs from other contexts (§10.2, ADR-0060). `ai` embeds text for `notes` (EMBEDDINGS); `notes` finds the
 * nearest chunks of the notes a person may read (NOTE_RETRIEVAL); `core` says whether they may read a workspace doubt
 * and what it says (DOUBTS); `communication` tells their sockets an answer grew (LIVE).
 */
export const EMBEDDINGS = Symbol('EMBEDDINGS')
export const NOTE_RETRIEVAL = Symbol('NOTE_RETRIEVAL')
export const DOUBTS = Symbol('DOUBTS')
export const LIVE = Symbol('LIVE')

export interface Embeddings {
  /** The model embeddings come from now, or null when AI is off or not answering: then nothing is embedded. */
  model(): Promise<string | null>
  /** One vector per text. `userId` null is the platform's own work (no quota); `private`: material that is not public. */
  embed(texts: string[], who: { userId: string | null; private: boolean; task: string }): Promise<{ model: string; vectors: number[][] }>
}

/** Where to look, within what the asker may read: a workspace is a group whose shared notes a doubt is asked over. */
export type RetrievalScope = { kind: 'MY_NOTES' } | { kind: 'MY_PLACES' } | { kind: 'PUBLIC' } | { kind: 'WORKSPACE'; groupId: string }

export interface RetrievedChunk {
  noteId: string
  versionId: string
  title: string
  visibility: Visibility
  cardIds: string[]
  text: string
  /** Cosine similarity, 1 is the same direction */
  similarity: number
}

export interface NoteRetrieval {
  /**
   * The chunks nearest to `embedding` among the notes `viewerId` may read in `scope` (decided in Postgres, before the
   * search), best first; at most `limit`.
   */
  nearest(viewerId: string, embedding: number[], scope: RetrievalScope, limit: number): Promise<RetrievedChunk[]>
}

export interface DoubtForAi {
  groupId: string
  title: string
  /** The doubt's words, then its answers' */
  text: string
}

export interface Doubts {
  /** The doubt as `viewerId` may read it (on the workspace's team, or its mentor), or null. */
  forAi(viewerId: string, doubtId: string): Promise<DoubtForAi | null>
}

export interface Live {
  /** Tells `userId`'s open sockets that something of theirs changed: a kind and an id, nothing else (ADR-0042). */
  notify(userId: string, kind: LiveEventKind, id: string): Promise<void>
}
