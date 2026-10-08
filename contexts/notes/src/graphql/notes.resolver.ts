import { UseGuards } from '@nestjs/common'
import { Args, Context, Mutation, Parent, Query, ResolveField, Resolver, ResolveReference } from '@nestjs/graphql'
import { CurrentViewer, SignedInGuard, type RequestContext, type Viewer } from '@lvn-backend/auth-guard'
import { withUserErrors, type UserError } from '@lvn-backend/errors'
import { connection, requestLoader } from '@lvn-backend/graphql'
import { notePermissions, type NoteAccessRow } from '../domain/note-access'
import { AttachmentsService } from '../application/attachments.service'
import { DraftsService, type CardOpResult } from '../application/drafts.service'
import { NotesService, type NoteRow, type OpenedNote } from '../application/notes.service'
import { OrganiseService } from '../application/organise.service'
import type {
  MutationCreateNoteArgs,
  MutationDeleteNoteArgs,
  MutationDeleteNoteForeverArgs,
  MutationPublishNoteArgs,
  MutationRestoreNoteArgs,
  MutationRestoreNoteVersionArgs,
  MutationUpdateNoteDraftArgs,
  NoteCardsArgs,
  NoteVersionArgs,
  NoteVersionsArgs,
  OkPayload,
  QueryMyNotesArgs,
  QueryNoteArgs,
} from './schema.types'

/** A note as the parent of its fields: the row's columns, and how the viewer opened it. */
export type NoteParent = NoteRow & { opened: OpenedNote }
export const toNote = (opened: OpenedNote): NoteParent => ({ ...opened.note, opened })
const userRef = (id: string) => ({ __typename: 'User', id })

type NotePayload = { note: NoteParent | null; userErrors: UserError[] }

@Resolver('Note')
export class NotesResolver {
  constructor(
    private readonly notes: NotesService,
    private readonly drafts: DraftsService,
    private readonly organise: OrganiseService,
    private readonly attachments: AttachmentsService,
  ) {}

  // ── Queries ──────────────────────────────────────────────────────────────────────────────────────────────

  @Query('note')
  async note(@Args() { id }: QueryNoteArgs, @CurrentViewer() viewer: Viewer | null): Promise<NoteParent | null> {
    const opened = await this.notes.open(viewer?.userId ?? null, id)
    return opened ? toNote(opened) : null
  }

  @Query('myNotes')
  @UseGuards(SignedInGuard)
  async myNotes(@Args() { filter, first, after }: QueryMyNotesArgs, @CurrentViewer() viewer: Viewer) {
    const actor = await this.notes.actor(viewer.userId)
    const { rows, size } = await this.notes.list(viewer.userId, filter, first, after)
    return connection(rows, size, (n) => [n.draftUpdatedAt.toISOString(), n.id], (n) => toNote({ note: n, access: 'OWNER', shareRole: null, actor }))
  }

  // Apollo calls this with (reference, context, info); see UserReferenceResolver for why there are no decorators.
  @ResolveReference()
  async resolveReference(reference: { id: string }, context: RequestContext): Promise<NoteParent | null> {
    const opened = await this.notes.open(context.viewer?.userId ?? null, reference.id)
    return opened ? toNote(opened) : null
  }

  // ── Fields ───────────────────────────────────────────────────────────────────────────────────────────────

  @ResolveField('owner')
  owner(@Parent() n: NoteParent) {
    return userRef(n.ownerId)
  }

  @ResolveField('viewerAccess')
  viewerAccess(@Parent() n: NoteParent) {
    return n.opened.access
  }

  @ResolveField('viewerCan')
  viewerCan(@Parent() n: NoteParent) {
    return notePermissions(n.opened.actor, n as NoteAccessRow, n.opened.shareRole)
  }

  @ResolveField('folder')
  folder(@Parent() n: NoteParent, @Context() context: RequestContext) {
    if (n.opened.access !== 'OWNER' || !n.folderId) return null
    return requestLoader<string, unknown>(context, 'notes.folder', async (ids) => {
      const folders = await this.organise.folders(n.ownerId)
      return ids.map((id) => folders.find((f) => f.id === id) ?? null)
    }).load(n.folderId)
  }

  @ResolveField('tags')
  async tags(@Parent() n: NoteParent, @Context() context: RequestContext) {
    if (n.opened.access !== 'OWNER') return []
    return requestLoader<string, unknown[]>(context, 'notes.tags', async (noteIds) => {
      const links = await this.organise.tagsOfNotes([...noteIds])
      return noteIds.map((id) => links.get(id) ?? [])
    }).load(n.id)
  }

  @ResolveField('topics')
  topics(@Parent() n: NoteParent, @Context() context: RequestContext) {
    return requestLoader<string, unknown[]>(context, 'notes.topics', async (noteIds) => {
      const links = await this.organise.topicsOfNotes([...noteIds])
      return noteIds.map((id) => links.get(id) ?? [])
    }).load(n.id)
  }

  @ResolveField('draftRevision')
  draftRevision(@Parent() n: NoteParent) {
    return n.opened.access === 'READER' ? null : n.draftRevision
  }

  @ResolveField('draftUpdatedAt')
  draftUpdatedAt(@Parent() n: NoteParent) {
    return n.opened.access === 'READER' ? null : n.draftUpdatedAt
  }

  @ResolveField('deletedAt')
  deletedAt(@Parent() n: NoteParent) {
    return n.opened.access === 'OWNER' ? n.deletedAt : null
  }

  @ResolveField('publishedVersion')
  publishedVersion(@Parent() n: NoteParent) {
    return n.publishedVersionId ? this.drafts.version(n.publishedVersionId) : null
  }

  @ResolveField('cardCount')
  cardCount(@Parent() n: NoteParent) {
    return this.drafts.cardCount(n.opened)
  }

  @ResolveField('excerpt')
  excerpt(@Parent() n: NoteParent, @Context() context: RequestContext) {
    return requestLoader<OpenedNote, string>(context, 'notes.excerpt', async (opened) => {
      const map = await this.drafts.excerpts([...opened])
      return opened.map((o) => map.get(o.note.id) ?? '')
    }).load(n.opened)
  }

  @ResolveField('outline')
  outline(@Parent() n: NoteParent) {
    return this.drafts.outline(n.opened)
  }

  @ResolveField('cards')
  async cards(@Parent() n: NoteParent, @Args() { first, after }: NoteCardsArgs) {
    const { rows, size, cursorOf } = await this.drafts.cards(n.opened, first, after)
    // Card.media needs the note the card is on (published cards are snapshots without it).
    return connection(rows, size, cursorOf, (c) => ({ ...c, noteId: n.id }))
  }

  @ResolveField('versions')
  async versions(@Parent() n: NoteParent, @Args() { first, after }: NoteVersionsArgs) {
    if (n.opened.access === 'READER') return null
    const { rows, size } = await this.drafts.versions(n.opened, first, after)
    return connection(rows, size, (v) => [v.number], (v) => v)
  }

  @ResolveField('version')
  async version(@Parent() n: NoteParent, @Args() { id }: NoteVersionArgs) {
    if (n.opened.access === 'READER') return null
    const version = await this.drafts.version(id)
    return version && version.noteId === n.id ? version : null
  }

  // ── Mutations ────────────────────────────────────────────────────────────────────────────────────────────

  @Mutation('createNote')
  @UseGuards(SignedInGuard)
  createNote(@Args() { input }: MutationCreateNoteArgs, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => ({ note: toNote(await this.notes.create(viewer.userId, input)) }), { note: null })
  }

  @Mutation('updateNoteDraft')
  @UseGuards(SignedInGuard)
  updateNoteDraft(@Args() { input }: MutationUpdateNoteDraftArgs, @CurrentViewer() viewer: Viewer) {
    type Payload = { note: NoteParent | null; results: CardOpResult[]; conflictVersion: unknown; userErrors: UserError[] }
    return withUserErrors<Payload>(
      async () => {
        const { opened, results, conflictVersionId } = await this.drafts.update(viewer.userId, input)
        return { note: toNote(opened), results, conflictVersion: conflictVersionId ? await this.drafts.version(conflictVersionId) : null }
      },
      { note: null, results: [], conflictVersion: null },
    )
  }

  @Mutation('publishNote')
  @UseGuards(SignedInGuard)
  publishNote(@Args() { input }: MutationPublishNoteArgs, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => ({ note: toNote(await this.drafts.publish(viewer.userId, input.noteId)) }), { note: null })
  }

  @Mutation('restoreNoteVersion')
  @UseGuards(SignedInGuard)
  restoreNoteVersion(@Args() { input }: MutationRestoreNoteVersionArgs, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => ({ note: toNote(await this.drafts.restoreVersion(viewer.userId, input.noteId, input.versionId)) }), { note: null })
  }

  @Mutation('deleteNote')
  @UseGuards(SignedInGuard)
  deleteNote(@Args() { input }: MutationDeleteNoteArgs, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => ({ note: toNote(await this.notes.trash(viewer.userId, input.noteId)) }), { note: null })
  }

  @Mutation('restoreNote')
  @UseGuards(SignedInGuard)
  restoreNote(@Args() { input }: MutationRestoreNoteArgs, @CurrentViewer() viewer: Viewer): Promise<NotePayload> {
    return withUserErrors<NotePayload>(async () => ({ note: toNote(await this.notes.restore(viewer.userId, input.noteId)) }), { note: null })
  }

  @Mutation('deleteNoteForever')
  @UseGuards(SignedInGuard)
  deleteNoteForever(@Args() { input }: MutationDeleteNoteForeverArgs, @CurrentViewer() viewer: Viewer): Promise<OkPayload> {
    return withUserErrors<OkPayload>(async () => {
      await this.attachments.purgeUnlinked(await this.notes.destroy(viewer.userId, input.noteId))
      return { ok: true }
    }, { ok: false })
  }
}

/** Fields of NoteVersion. A version is only reachable through a note the viewer may see it on. */
@Resolver('NoteVersion')
export class NoteVersionResolver {
  constructor(private readonly drafts: DraftsService) {}

  @ResolveField('createdBy')
  createdBy(@Parent() v: { createdById: string }) {
    return userRef(v.createdById)
  }

  @ResolveField('cards')
  async cards(@Parent() v: { id: string; noteId: string }, @Args() { first, after }: NoteCardsArgs) {
    const { rows, size, cursorOf } = await this.drafts.versionCards(v.id, first, after)
    return connection(rows, size, cursorOf, (c) => ({ ...c, noteId: v.noteId }))
  }
}
