import { Inject, Injectable, Logger } from '@nestjs/common'
import { Action, can, Visibility, type NoteFacts } from '@lvn/contracts/domain'
import { NOTE_LIMITS, positionsBetween } from '@lvn/contracts/validation'
import { PEOPLE, POLICY, type People, type Policy } from '@lvn-backend/facades'
import { newId, PrismaService, type Prisma } from '@lvn-backend/prisma-base'
import { contentHash, problemNote, topicNote, type ConvertedNote, type LegacyProblem, type LegacyTopic } from '../domain/legacy-content'
import { DraftsService } from './drafts.service'
import { NotesService } from './notes.service'
import { SharingService } from './sharing.service'

/**
 * The old learnvianotes.in study content into Postgres (ADR-0098): the catalogue (subjects, topic groups, topics) into
 * the curated Subject and Topic rows, and every topic and Sheet 150 problem into a PUBLIC note owned by the
 * LearnViaNotes account and filed under its curated topic. Accounts are not imported (people sign in again with
 * Google); their old progress and personal notes stay with the snapshot and claim of ADR-0023.
 *
 * Idempotent: LegacyContentItem remembers what each old document became, so a re-run writes only what changed, and
 * leaves alone a note someone has since edited, unpublished or trashed in the app. A dry run reads everything,
 * converts everything and writes nothing.
 *
 * The deploy path is the Markdown catalogue under `content/study` (`study-content-sync`), not this class. The
 * Firestore reader and the `content:import-legacy` command are retired (ADR-0098).
 */

/** The old catalogue document (`catalog/current`, old repo content-build/catalog.json). */
export interface LegacyCatalog {
  subjects: { id: string; title: string; kind: 'notes' | 'problems'; order: number; topics: { id: string; title: string; group?: string }[] }[]
}

/** The old content's version document (`meta/content`). */
export interface LegacyContentMeta {
  version: string
  generatedAt?: string
  subjects?: number
  topics?: number
  problems?: number
}

/** Read-only access to the old content (Firestore, or a fake in tests). */
export interface LegacyContentSource {
  /** Where the content comes from, for the report */
  readonly name: string
  meta(): Promise<LegacyContentMeta | null>
  catalog(): Promise<LegacyCatalog>
  topics(subjectId: string): Promise<LegacyTopic[]>
  problems(subjectId: string): Promise<LegacyProblem[]>
}

export interface LegacyContentOptions {
  /** The verified account that owns the notes, by handle or email; a dry run may leave it out */
  owner?: string | null
  dryRun: boolean
  /** Only these subjects' notes (old ids such as dsa-basics); the whole catalogue is always brought up to date */
  subjects?: string[]
}

export interface LegacyContentReport {
  source: string
  contentVersion: string | null
  dryRun: boolean
  owner: string | null
  catalog: { subjectsAdded: string[]; subjectsChanged: string[]; topicsAdded: string[]; topicsChanged: string[]; notInSource: string[] }
  notes: {
    created: number
    updated: number
    unchanged: number
    /** Edited, unpublished or made non-public in the app since the import: left alone */
    editedInApp: string[]
    /** In the owner's trash: left alone */
    trashed: string[]
    /** Held by moderation (ADR-0037): readable once a platform admin approves them in /admin/moderation */
    held: string[]
    /** Documents that are not what the old schema says, with the reason */
    invalid: { key: string; reason: string }[]
  }
  cards: number
  /** What the conversion could not carry over, by kind (e.g. one inline SVG diagram) */
  leftOut: Record<string, number>
}

const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'topic'

interface Item {
  key: string
  topicKeys: string[]
  convert: () => ConvertedNote
}

@Injectable()
export class LegacyContentImport {
  private readonly log = new Logger('LegacyContent')

  constructor(
    private readonly db: PrismaService,
    private readonly drafts: DraftsService,
    private readonly notes: NotesService,
    private readonly sharing: SharingService,
    @Inject(PEOPLE) private readonly people: People,
    @Inject(POLICY) private readonly policy: Policy,
  ) {}

  async run(source: LegacyContentSource, options: LegacyContentOptions): Promise<LegacyContentReport> {
    const owner = options.owner ? await this.owner(options.owner) : null
    if (!owner && !options.dryRun) throw new Error('Name the account that owns the notes: --owner <handle or email>.')
    const meta = await source.meta()
    const catalog = await source.catalog()
    const report: LegacyContentReport = {
      source: source.name,
      contentVersion: meta?.version ?? null,
      dryRun: options.dryRun,
      owner: owner ? `@${owner.handle}` : null,
      catalog: { subjectsAdded: [], subjectsChanged: [], topicsAdded: [], topicsChanged: [], notInSource: [] },
      notes: { created: 0, updated: 0, unchanged: 0, editedInApp: [], trashed: [], held: [], invalid: [] },
      cards: 0,
      leftOut: {},
    }
    const topicIds = await this.catalog(catalog, report, options.dryRun)
    const only = options.subjects?.length ? new Set(options.subjects) : null
    for (const unknown of options.subjects ?? []) if (!catalog.subjects.some((s) => s.id === unknown)) throw new Error(`No subject "${unknown}" in the old catalogue.`)
    for (const subject of [...catalog.subjects].sort((a, b) => a.order - b.order)) {
      if (only && !only.has(subject.id)) continue
      const items: Item[] =
        subject.kind === 'problems'
          ? (await source.problems(subject.id)).map((p) => ({ key: `problem:${subject.id}/${p.id}`, topicKeys: [`${subject.id}/${p.category}`], convert: () => problemNote(this.checkProblem(p)) }))
          : (await source.topics(subject.id)).map((t) => ({ key: `topic:${subject.id}/${t.id}`, topicKeys: [`${subject.id}/${t.id}`], convert: () => topicNote(this.checkTopic(t)) }))
      for (const item of items) await this.item(item, topicIds, owner?.id ?? null, report, options.dryRun)
      this.log.log(`${subject.id}: ${items.length} ${subject.kind === 'problems' ? 'problems' : 'topics'}`)
    }
    return report
  }

  /** The owner must be able to publish public notes: a verified adult account (§5, ADR-0017). */
  private async owner(handleOrEmail: string) {
    const person = await this.people.find(handleOrEmail)
    if (!person) throw new Error(`No account ${handleOrEmail}: sign it up first (docs/runbooks/legacy-content.md).`)
    const actor = await this.policy.actor(person.id)
    const publicNote: NoteFacts = { ownerId: person.id, visibility: Visibility.PUBLIC, forkingEnabled: true }
    if (!actor || !can(actor, Action.NOTE_PUBLISH, { kind: 'note', note: publicNote })) {
      throw new Error(`@${person.handle} cannot publish public notes: it must be a verified adult account that is not suspended (docs/runbooks/legacy-content.md).`)
    }
    return person
  }

  private checkTopic(t: LegacyTopic): LegacyTopic {
    if (!t?.id || !t.title || !Array.isArray(t.content)) throw new InvalidDocument('a topic needs an id, a title and its content')
    return t
  }

  private checkProblem(p: LegacyProblem): LegacyProblem {
    if (!p?.id || !p.title || !p.category) throw new InvalidDocument('a problem needs an id, a title and a category')
    return p
  }

  // ── The catalogue ────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Subjects by slug, topic groups as parent topics and topics under them, as scripts/curated-topics.mjs first seeded
   * them: added when new, renamed or moved when changed, never removed (notes and resources point at them). Returns
   * "subjectId/topicId" → Topic id.
   */
  private async catalog(catalog: LegacyCatalog, report: LegacyContentReport, dryRun: boolean): Promise<Map<string, string>> {
    const ids = new Map<string, string>()
    const subjects = new Map((await this.db.subject.findMany()).map((s) => [s.slug, s]))
    for (const [i, s] of [...catalog.subjects].sort((a, b) => a.order - b.order).entries()) {
      const position = i + 1
      let subject = subjects.get(s.id)
      if (!subject) {
        report.catalog.subjectsAdded.push(s.id)
        subject = { id: newId(), slug: s.id, title: s.title, position, createdAt: new Date() }
        if (!dryRun) await this.db.subject.create({ data: { id: subject.id, slug: s.id, title: s.title, position } })
      } else if (subject.title !== s.title || subject.position !== position) {
        report.catalog.subjectsChanged.push(s.id)
        if (!dryRun) await this.db.subject.update({ where: { id: subject.id }, data: { title: s.title, position } })
      }
      const existing = new Map((await this.db.topic.findMany({ where: { subjectId: subject.id } })).map((t) => [t.slug, t]))
      const seen = new Set<string>()
      const topic = async (slug: string, title: string, parentId: string | null, at: number): Promise<string> => {
        seen.add(slug)
        const name = title.trim().slice(0, NOTE_LIMITS.topicTitle)
        const row = existing.get(slug)
        if (!row) {
          report.catalog.topicsAdded.push(`${s.id}/${slug}`)
          const id = newId()
          if (!dryRun) await this.db.topic.create({ data: { id, subjectId: subject.id, parentId, slug, title: name, position: at, origin: 'CURATED' } })
          return id
        }
        // A topic someone proposed with the same slug is the same topic; only curated ones follow the catalogue.
        if (row.origin === 'CURATED' && (row.title !== name || row.parentId !== parentId || row.position !== at)) {
          report.catalog.topicsChanged.push(`${s.id}/${slug}`)
          if (!dryRun) await this.db.topic.update({ where: { id: row.id }, data: { title: name, parentId, position: at } })
        }
        return row.id
      }
      const slugs = new Set(s.topics.map((t) => t.id))
      const groups = new Map<string, string>()
      for (const [j, t] of s.topics.entries()) {
        let parentId: string | null = null
        if (t.group) {
          if (!groups.has(t.group)) {
            let slug = slugify(t.group)
            if (slugs.has(slug)) slug = `${slug}-group`
            groups.set(t.group, await topic(slug, t.group, null, groups.size + 1))
          }
          parentId = groups.get(t.group)!
        }
        ids.set(`${s.id}/${t.id}`, await topic(t.id, t.title, parentId, j + 1))
      }
      for (const row of existing.values()) if (row.origin === 'CURATED' && !seen.has(row.slug)) report.catalog.notInSource.push(`${s.id}/${row.slug}`)
    }
    return ids
  }

  // ── Notes ────────────────────────────────────────────────────────────────────────────────────────────────────

  private async item(item: Item, topicIds: Map<string, string>, ownerId: string | null, report: LegacyContentReport, dryRun: boolean) {
    let note: ConvertedNote
    try {
      note = item.convert()
    } catch (err) {
      if (!(err instanceof InvalidDocument)) throw err
      report.notes.invalid.push({ key: item.key, reason: err.message })
      return
    }
    report.cards += note.cards.length
    for (const [k, v] of Object.entries(note.leftOut)) report.leftOut[k] = (report.leftOut[k] ?? 0) + v
    const topics = item.topicKeys.map((k) => topicIds.get(k)).filter((id): id is string => !!id)
    const hash = contentHash(note, topics)
    const done = await this.db.legacyContentItem.findUnique({ where: { key: item.key }, include: { note: true } })
    if (!done) {
      report.notes.created++
      if (!dryRun) await this.create(item.key, note, topics, hash, ownerId!, report)
      return
    }
    const current = done.note
    if (current.deletedAt) return void report.notes.trashed.push(item.key)
    // Someone changed it in the app since the import wrote it: their version stands.
    if (current.visibility !== 'PUBLIC' || current.publishedVersionId !== done.versionId || current.draftUpdatedAt > done.updatedAt) {
      return void report.notes.editedInApp.push(item.key)
    }
    if (done.sourceHash === hash) return void report.notes.unchanged++
    report.notes.updated++
    if (!dryRun) await this.update(item.key, current.id, current.ownerId, note, topics, hash, report)
  }

  private cardRows(noteId: string, note: ConvertedNote): Prisma.CardCreateManyInput[] {
    const positions = positionsBetween(null, null, note.cards.length)
    return note.cards.map((c, i) => ({ id: newId(), noteId, type: c.type, position: positions[i]!, content: c.content as Prisma.InputJsonValue }))
  }

  private async create(key: string, note: ConvertedNote, topics: string[], hash: string, ownerId: string, report: LegacyContentReport) {
    await this.notes.assertNotesOwned(ownerId)
    const id = newId()
    await this.db.$transaction(async (tx) => {
      await tx.note.create({ data: { id, ownerId, kind: 'NOTE', title: note.title, draftRevision: note.cards.length ? 1 : 0 } })
      if (note.cards.length) await tx.card.createMany({ data: this.cardRows(id, note) })
      if (topics.length) await tx.noteTopic.createMany({ data: topics.map((topicId) => ({ noteId: id, topicId })) })
    })
    // The same path as a person publishing and then making the note public: versions, moderation, search, audit.
    await this.drafts.publish(ownerId, id)
    await this.sharing.changeVisibility(ownerId, id, 'PUBLIC')
    await this.remember(key, id, hash, report)
  }

  private async update(key: string, id: string, ownerId: string, note: ConvertedNote, topics: string[], hash: string, report: LegacyContentReport) {
    await this.db.$transaction(async (tx) => {
      await tx.card.updateMany({ where: { noteId: id, deletedAt: null }, data: { deletedAt: new Date() } })
      if (note.cards.length) await tx.card.createMany({ data: this.cardRows(id, note) })
      await tx.noteTopic.deleteMany({ where: { noteId: id } })
      if (topics.length) await tx.noteTopic.createMany({ data: topics.map((topicId) => ({ noteId: id, topicId })) })
      await tx.note.update({ where: { id }, data: { title: note.title, draftRevision: { increment: 1 }, draftUpdatedAt: new Date() } })
    })
    await this.drafts.publish(ownerId, id)
    await this.remember(key, id, hash, report)
  }

  /** Written last, after the publish, so its time is later than the draft the import wrote. */
  private async remember(key: string, noteId: string, hash: string, report: LegacyContentReport) {
    const note = await this.db.note.findUniqueOrThrow({ where: { id: noteId }, select: { publishedVersionId: true, moderation: true } })
    await this.db.legacyContentItem.upsert({
      where: { key },
      create: { key, noteId, sourceHash: hash, versionId: note.publishedVersionId },
      update: { sourceHash: hash, versionId: note.publishedVersionId },
    })
    if (note.moderation !== 'OK') report.notes.held.push(key)
  }
}

class InvalidDocument extends Error {}
