// Generated from this folder's *.graphql by scripts/graphql-types.mjs (ADR-0033). Do not edit.

/** One block of a note (§4.1). `position` orders cards (a fractional index: compare as plain strings, then by id). */
export interface Card {
  id: string
  type: CardType
  position: string
  /** Shape depends on `type` (@lvn/contracts/validation CARD_CONTENT) */
  content: unknown
  /** Send it back as baseRevision when changing or deleting the card (§13.2) */
  revision: number
  /** The file of an image, video, audio or file card; null for other cards, or when the file is gone */
  media?: MediaFile | null
}

export interface CardConnection {
  edges: Array<CardEdge>
  pageInfo: PageInfo
}

export interface CardEdge {
  cursor: string
  node: Card
}

/** A card as the client has it. Ids are UUIDs the client makes, so cards created offline keep their id. */
export interface CardInput {
  id: string
  type: CardType
  position: string
  content: unknown
}

export interface CardOpInput {
  kind: CardOpKind
  id: string
  type?: CardType | null
  position?: string | null
  content?: unknown | null
  /** The card's revision the client last saw; omitted for new cards */
  baseRevision?: number | null
}

export type CardOpKind = 'UPSERT' | 'MOVE' | 'DELETE'

export interface CardOpResult {
  id: string
  status: CardOpStatus
  /** The card's revision after the save */
  revision: number | null
  message: string | null
}

export type CardOpStatus = 'APPLIED' | 'APPLIED_WITH_CONFLICT' | 'REJECTED'

/** The sixteen card types (§4.1); content is validated per type (@lvn/contracts/validation) */
export type CardType = 'text' | 'heading' | 'markdown' | 'code' | 'image' | 'video' | 'audio' | 'file' | 'diagram' | 'quote' | 'callout' | 'checklist' | 'table' | 'question' | 'quiz' | 'flashcard'

export interface ChangeNoteVisibilityInput {
  noteId: string
  visibility: Visibility
}

export interface CreateFolderInput {
  name: string
  parentId?: string | null
}

export interface CreateNoteInput {
  title?: string | null
  folderId?: string | null
  kind?: NoteKind | null
  cards?: Array<CardInput> | null
  tagNames?: Array<string> | null
  topicIds?: Array<string> | null
}

export interface CreateUploadIntentInput {
  /** Shown to people; never part of the storage key */
  fileName: string
  mimeType: string
  sizeBytes: number
  purpose: FilePurpose
  parentId?: string | null
}

/** Fixed error vocabulary (§6.2) */
export type ErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL'

/** What an upload is for: AVATAR, VERIFICATION_DOCUMENT, and ATTACHMENT (a picture, video, audio or PDF for a note you can edit, given as parentId). Other purposes arrive with their features. */
export type FilePurpose = 'ATTACHMENT' | 'COVER' | 'VOICE_NOTE' | 'AVATAR' | 'IMPORT' | 'EXPORT' | 'VERIFICATION_DOCUMENT'

/** The viewer's folder; nested up to 5 levels */
export interface Folder {
  id: string
  name: string
  parentId: string | null
  /** Live notes directly in this folder */
  noteCount: number
}

export interface FolderPayload {
  folder: Folder | null
  userErrors: Array<UserError>
}

/** Where a copy came from (§4.4, ADR-0010). Every reader sees the author; the origin itself only those who can open it. */
export interface ForkCredit {
  author: User
  note: Note | null
  title: string | null
}

export interface IdInput {
  id: string
}

/** A file a media card shows. The url works for 15 minutes (until expiresAt); load the card again for a new one. */
export interface MediaFile {
  id: string
  url: string
  expiresAt: Date
  mimeType: string
  fileName: string
  sizeBytes: number
  width: number | null
  height: number | null
  durationMs: number | null
}

export interface MutationCreateUploadIntentArgs {
  input: CreateUploadIntentInput
}

export interface MutationCompleteUploadArgs {
  fileId: string
}

export interface MutationCreateNoteArgs {
  input: CreateNoteInput
}

export interface MutationUpdateNoteDraftArgs {
  input: UpdateNoteDraftInput
}

export interface MutationPublishNoteArgs {
  input: NoteIdInput
}

export interface MutationRestoreNoteVersionArgs {
  input: RestoreNoteVersionInput
}

export interface MutationDeleteNoteArgs {
  input: NoteIdInput
}

export interface MutationRestoreNoteArgs {
  input: NoteIdInput
}

export interface MutationDeleteNoteForeverArgs {
  input: NoteIdInput
}

export interface MutationCreateFolderArgs {
  input: CreateFolderInput
}

export interface MutationUpdateFolderArgs {
  input: UpdateFolderInput
}

export interface MutationDeleteFolderArgs {
  input: IdInput
}

export interface MutationRenameTagArgs {
  input: RenameTagInput
}

export interface MutationDeleteTagArgs {
  input: IdInput
}

export interface MutationProposeTopicArgs {
  input: ProposeTopicInput
}

export interface MutationChangeNoteVisibilityArgs {
  input: ChangeNoteVisibilityInput
}

export interface MutationShareNoteArgs {
  input: ShareNoteInput
}

export interface MutationUnshareNoteArgs {
  input: UnshareNoteInput
}

export interface MutationForkNoteArgs {
  input: NoteIdInput
}

export interface MutationSetNoteForkingArgs {
  input: SetNoteForkingInput
}

/** A note (§4.1). Load it in two steps (§6.3): these fields and the outline first, then `cards` page by page. Editors get
 * the draft; readers get the published version. Notes the viewer cannot read are null, exactly as if they did not exist. */
export interface Note {
  id: string
  kind: NoteKind
  /** Empty when untitled */
  title: string
  /** URL part of the title, set when published */
  slug: string
  visibility: Visibility
  owner: User
  viewerAccess: NoteAccess
  viewerCan: NotePermissions
  /** The owner's folder; null for anyone else */
  folder: Folder | null
  /** The owner's tags; empty for anyone else */
  tags: Array<Tag>
  topics: Array<Topic>
  /** Editors only: bumped by every change to the draft */
  draftRevision: number | null
  /** Editors only */
  draftUpdatedAt: Date | null
  publishedVersion: NoteVersion | null
  publishedAt: Date | null
  forkingEnabled: boolean
  cardCount: number
  /** The first words of the note (at most 180 characters), for lists and previews */
  excerpt: string
  /** The headings, for navigation */
  outline: Array<OutlineItem>
  /** In order; at most 100 per page */
  cards: CardConnection
  /** Editors only: newest first */
  versions: NoteVersionConnection | null
  /** Editors only: one version of this note, to preview or restore */
  version: NoteVersion | null
  createdAt: Date
  updatedAt: Date
  /** Set while the note is in the trash (owner only) */
  deletedAt: Date | null
  /** Owner only: the people the note is shared with; null for anyone else */
  shares?: Array<NoteShare> | null
  /** Set on a copy of another note; it cannot be removed */
  forkedFrom?: ForkCredit | null
}

export interface NoteCardsArgs {
  first?: number | null
  after?: string | null
}

export interface NoteVersionsArgs {
  first?: number | null
  after?: string | null
}

export interface NoteVersionArgs {
  id: string
}

/** OWNER and EDITOR work on the draft; READER sees the published version (§4.3) */
export type NoteAccess = 'OWNER' | 'EDITOR' | 'READER'

export interface NoteConnection {
  edges: Array<NoteEdge>
  pageInfo: PageInfo
}

export interface NoteEdge {
  cursor: string
  node: Note
}

export interface NoteFilter {
  /** Notes in this folder (not its subfolders) */
  folderId?: string | null
  /** Notes in no folder */
  unfiled?: boolean | null
  tagId?: string | null
  topicId?: string | null
  kind?: NoteKind | null
  /** The trash instead of the live notes */
  trashed?: boolean | null
}

export interface NoteIdInput {
  noteId: string
}

/** What a note is presented as (ADR-0014, ADR-0015). Phase 2 creates NOTE only. */
export type NoteKind = 'NOTE' | 'BLOG' | 'POST' | 'PROJECT'

export interface NotePayload {
  note: Note | null
  userErrors: Array<UserError>
}

/** What the viewer may do with a note, to show or hide controls; the API checks again on every mutation. */
export interface NotePermissions {
  edit: boolean
  publish: boolean
  changeVisibility: boolean
  delete: boolean
  share: boolean
  fork: boolean
}

/** A person a note is shared with; EDITORs work on the draft, VIEWERs read the published version */
export interface NoteShare {
  user: User
  role: NoteShareRole
  createdAt: Date
}

export type NoteShareRole = 'EDITOR' | 'VIEWER'

/** An immutable snapshot of a note's cards (§4.3) */
export interface NoteVersion {
  id: string
  number: number
  kind: NoteVersionKind
  title: string
  createdBy: User
  createdAt: Date
  cards: CardConnection
}

export interface NoteVersionCardsArgs {
  first?: number | null
  after?: string | null
}

export interface NoteVersionConnection {
  edges: Array<NoteVersionEdge>
  pageInfo: PageInfo
}

export interface NoteVersionEdge {
  cursor: string
  node: NoteVersion
}

/** PUBLISHED: what readers see. CONFLICT: the losing side of a card edited on two devices. DRAFT: the draft before a restore. */
export type NoteVersionKind = 'PUBLISHED' | 'CONFLICT' | 'DRAFT'

export interface OkPayload {
  ok: boolean
  userErrors: Array<UserError>
}

export interface OutlineItem {
  cardId: string
  level: number
  text: string
}

export interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export interface ProposeTopicInput {
  subjectId: string
  parentId?: string | null
  title: string
}

export interface QueryNoteArgs {
  id: string
}

export interface QueryMyNotesArgs {
  filter?: NoteFilter | null
  first?: number | null
  after?: string | null
}

export interface QuerySubjectArgs {
  slug: string
}

export interface QueryFindTopicsArgs {
  query: string
  subjectId?: string | null
}

export interface QuerySharedWithMeArgs {
  first?: number | null
  after?: string | null
}

export interface RenameTagInput {
  id: string
  name: string
}

export interface RestoreNoteVersionInput {
  noteId: string
  versionId: string
}

export interface SetNoteForkingInput {
  noteId: string
  enabled: boolean
}

export interface ShareNoteInput {
  noteId: string
  /** A handle (@asha or asha) or an email address */
  person: string
  role: NoteShareRole
}

export interface Subject {
  id: string
  slug: string
  title: string
  /** Top-level topics: curated ones and the viewer's proposals */
  topics: Array<Topic>
}

/** The viewer's tag; names are unique ignoring case */
export interface Tag {
  id: string
  name: string
  noteCount: number
}

export interface TagPayload {
  tag: Tag | null
  userErrors: Array<UserError>
}

/** A topic within a subject; curated by LVN or proposed by a user (usable by its proposer until curated) */
export interface Topic {
  id: string
  slug: string
  title: string
  origin: TopicOrigin
  subject: Subject
  parentId: string | null
  children: Array<Topic>
}

export type TopicOrigin = 'CURATED' | 'PROPOSED'

export interface TopicPayload {
  topic: Topic | null
  userErrors: Array<UserError>
}

export interface UnshareNoteInput {
  noteId: string
  userId: string
}

/** Omitted fields stay as they are; `parentId: null` moves the folder to the top level */
export interface UpdateFolderInput {
  id: string
  name?: string | null
  parentId?: string | null
}

/** One save of the draft (autosave). Title, folder, tags and topics are last-writer-wins; card operations are checked per
 * card (§13.2) and reported in `results`. Omitted fields stay as they are; `folderId: null` moves the note out of folders. */
export interface UpdateNoteDraftInput {
  noteId: string
  title?: string | null
  folderId?: string | null
  tagNames?: Array<string> | null
  topicIds?: Array<string> | null
  ops?: Array<CardOpInput> | null
}

export interface UpdateNoteDraftPayload {
  note: Note | null
  results: Array<CardOpResult>
  /** The other device's version of conflicting cards, restorable from version history */
  conflictVersion: NoteVersion | null
  userErrors: Array<UserError>
}

export interface UploadHeader {
  name: string
  value: string
}

/** Upload the bytes with PUT to uploadUrl and exactly these headers within 10 minutes, then call completeUpload. */
export interface UploadIntent {
  fileId: string
  uploadUrl: string
  uploadHeaders: Array<UploadHeader>
  expiresAt: Date
}

export interface UploadIntentPayload {
  intent: UploadIntent | null
  userErrors: Array<UserError>
}

/** A person, owned by the users subgraph; notes refer to people by id. */
export interface User {
  id: string
}

export interface UserError {
  field: Array<string> | null
  message: string
  code: ErrorCode
}

/** Who can read a note (§4.2) */
export type Visibility = 'PRIVATE' | 'SHARED' | 'PUBLIC'
