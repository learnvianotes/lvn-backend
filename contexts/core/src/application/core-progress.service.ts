import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { LegacySnapshots, type LegacyUserSnapshot } from '@lvn-backend/legacy'
import { PrismaService } from '@lvn-backend/prisma-base'
import { Storage } from '@lvn-backend/storage'
import { CORE_CONFIG, type CoreConfig } from '../core.config'

/** The old site had one problem sheet; its problem marks are keyed by problem id alone. */
export const LEGACY_PROBLEM_SUBJECT = 'sheet-150'

export interface TopicProgress {
  topicKey: string
  completed: boolean
  revisit: boolean
  secondsStudied: number
  lastStudiedAt: Date | null
}

export interface SubjectProgress {
  subjectId: string
  topics: TopicProgress[]
  problems: { problemId: string; mark: 'SOLVED' | 'REVISIT' }[]
}

const subjectOf = (topicKey: string): string => topicKey.slice(0, topicKey.indexOf('/'))
const isTopicKey = (key: string): boolean => /^[a-z0-9][a-z0-9_-]*\/[a-z0-9][a-z0-9_-]*$/i.test(key)

/**
 * Progress on the /core study content (ADR-0023): the old site's history plus everything recorded since. Old data
 * arrives when a learner claims it (LegacyDataClaimed) and leaves when they decline it (LegacyDataDeclined).
 */
@Injectable()
export class CoreProgressService implements OnModuleInit {
  private readonly log = new Logger('CoreProgress')
  private readonly snapshots: LegacySnapshots

  constructor(
    private readonly db: PrismaService,
    storage: Storage,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(CORE_CONFIG) config: CoreConfig,
  ) {
    this.snapshots = new LegacySnapshots(storage, config.legacy.bucket, config.legacy.env)
  }

  onModuleInit(): void {
    this.events.subscribe('LegacyDataClaimed', async (e) => {
      await this.importLegacy(e.payload.userId, e.payload.legacyUid)
    })
    this.events.subscribe('LegacyDataDeclined', (e) => this.removeLegacy(e.payload.userId))
  }

  async forSubject(userId: string, subjectId: string): Promise<SubjectProgress> {
    const [topics, problems] = await Promise.all([
      this.db.coreTopicProgress.findMany({ where: { userId, subjectId } }),
      this.db.coreProblemMark.findMany({ where: { userId, subjectId }, orderBy: { markedAt: 'asc' } }),
    ])
    // One entry per topic across origins: done if done anywhere, time added up, the latest visit.
    const byTopic = new Map<string, TopicProgress>()
    for (const t of topics) {
      const p = byTopic.get(t.topicKey) ?? { topicKey: t.topicKey, completed: false, revisit: false, secondsStudied: 0, lastStudiedAt: null }
      p.completed ||= t.completed
      p.revisit ||= t.revisit
      p.secondsStudied += t.secondsStudied
      if (t.lastStudiedAt && (!p.lastStudiedAt || t.lastStudiedAt > p.lastStudiedAt)) p.lastStudiedAt = t.lastStudiedAt
      byTopic.set(t.topicKey, p)
    }
    // The newest mark wins (LVN marks are newer than the old site's).
    const byProblem = new Map<string, 'SOLVED' | 'REVISIT'>()
    for (const p of problems) byProblem.set(p.problemId, p.mark)
    return {
      subjectId,
      topics: [...byTopic.values()].sort((a, b) => a.topicKey.localeCompare(b.topicKey)),
      problems: [...byProblem].map(([problemId, mark]) => ({ problemId, mark })),
    }
  }

  /** Imports the progress part of an old-site snapshot as LEGACY rows; running it twice changes nothing. */
  async importLegacy(userId: string, legacyUid: string): Promise<number> {
    const snapshot = await this.snapshots.readUser(legacyUid)
    if (!snapshot) {
      this.log.warn(`no snapshot for claimed old account ${legacyUid}`)
      return 0
    }
    const topics = topicRows(snapshot)
    const problems = Object.entries(snapshot.user?.progress.problems ?? {}).map(([problemId, mark]) => ({
      problemId,
      mark: mark === 'solved' ? ('SOLVED' as const) : ('REVISIT' as const),
    }))
    await this.db.$transaction([
      this.db.coreTopicProgress.deleteMany({ where: { userId, origin: 'LEGACY' } }),
      this.db.coreProblemMark.deleteMany({ where: { userId, origin: 'LEGACY' } }),
      this.db.coreTopicProgress.createMany({ data: topics.map((t) => ({ ...t, userId, subjectId: subjectOf(t.topicKey), origin: 'LEGACY' as const })) }),
      this.db.coreProblemMark.createMany({
        data: problems.map((p) => ({ ...p, userId, subjectId: LEGACY_PROBLEM_SUBJECT, origin: 'LEGACY' as const, markedAt: new Date(0) })),
      }),
    ])
    await this.events.publish('LegacyImportPartDone', { userId, context: 'core', items: topics.length + problems.length })
    return topics.length + problems.length
  }

  async removeLegacy(userId: string): Promise<void> {
    await this.db.$transaction([
      this.db.coreTopicProgress.deleteMany({ where: { userId, origin: 'LEGACY' } }),
      this.db.coreProblemMark.deleteMany({ where: { userId, origin: 'LEGACY' } }),
    ])
  }
}

/** One row per old topic: read-to-the-end and revisit marks, and the time studied across every day. */
function topicRows(s: LegacyUserSnapshot): TopicProgress[] {
  const rows = new Map<string, TopicProgress>()
  const row = (key: string) => {
    let r = rows.get(key)
    if (!r) rows.set(key, (r = { topicKey: key, completed: false, revisit: false, secondsStudied: 0, lastStudiedAt: null }))
    return r
  }
  for (const key of Object.keys(s.user?.progress.topics ?? {})) if (isTopicKey(key)) row(key).completed = true
  for (const key of Object.keys(s.user?.progress.revisitTopics ?? {})) if (isTopicKey(key)) row(key).revisit = true
  for (const day of Object.values(s.days)) {
    for (const [key, visit] of Object.entries(day.topics)) {
      if (!isTopicKey(key)) continue
      const r = row(key)
      r.secondsStudied += Math.round(visit.sec)
      const last = new Date(visit.last)
      if (!r.lastStudiedAt || last > r.lastStudiedAt) r.lastStudiedAt = last
    }
  }
  return [...rows.values()]
}
