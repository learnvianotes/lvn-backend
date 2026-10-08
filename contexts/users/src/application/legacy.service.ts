import { Inject, Injectable, Logger } from '@nestjs/common'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { countsOf, isEmpty, LegacySnapshots, type LegacyCounts, type LegacyIndex } from '@lvn-backend/legacy'
import { PrismaService } from '@lvn-backend/prisma-base'
import { Storage } from '@lvn-backend/storage'
import { USERS_CONFIG, type UsersConfig } from '../users.config'

const INDEX_TTL_MS = 5 * 60_000

export interface LegacyStatus {
  status: 'NOT_FOUND' | 'AVAILABLE' | 'CLAIMED' | 'DECLINED'
  counts: LegacyCounts | null
  claimedAt: Date | null
}

/**
 * Old learnvianotes.in data (ADR-0023). Google accounts carry their Firebase UID, so their data is matched and
 * attached automatically (they can remove it); email accounts are matched by their verified email and the learner
 * confirms first. Claiming emits LegacyDataClaimed: core and notes import their parts from the snapshot.
 */
@Injectable()
export class LegacyService {
  private readonly log = new Logger('Legacy')
  private readonly snapshots: LegacySnapshots
  private index: { at: number; value: LegacyIndex | null } | null = null

  constructor(
    private readonly db: PrismaService,
    storage: Storage,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(USERS_CONFIG) config: UsersConfig,
  ) {
    this.snapshots = new LegacySnapshots(storage, config.legacy.bucket, config.legacy.env)
  }

  /**
   * Looks for old data once an identity is proven. Never fails sign-in: a missing or unreadable snapshot is logged
   * and the learner simply has nothing to claim.
   */
  async match(userId: string, identity: { firebaseUid?: string; verifiedEmail?: string }): Promise<void> {
    try {
      if (await this.db.legacyImport.findUnique({ where: { userId }, select: { userId: true } })) return
      const index = await this.readIndex()
      if (!index) return
      const byUid = identity.firebaseUid ? index.users.find((u) => u.uid === identity.firebaseUid) : undefined
      const byEmail = !byUid && identity.verifiedEmail ? index.users.find((u) => u.email?.toLowerCase() === identity.verifiedEmail!.toLowerCase()) : undefined
      const entry = byUid ?? byEmail
      if (!entry) return
      // One old account goes to one new account.
      if (await this.db.legacyImport.findFirst({ where: { legacyUid: entry.uid }, select: { userId: true } })) return
      const snapshot = await this.snapshots.readUser(entry.uid)
      if (!snapshot) return
      const counts = countsOf(snapshot)
      if (isEmpty(counts)) return

      const automatic = !!byUid
      await this.db.legacyImport.create({
        data: {
          userId,
          legacyUid: entry.uid,
          status: automatic ? 'CLAIMED' : 'AVAILABLE',
          counts: { ...counts },
          snapshotKey: this.snapshots.userKey(entry.uid),
          matchedBy: automatic ? 'FIREBASE_UID' : 'EMAIL',
          claimedAt: automatic ? new Date() : null,
        },
      })
      if (automatic) await this.events.publish('LegacyDataClaimed', { userId, legacyUid: entry.uid })
    } catch (err) {
      this.log.warn(`old-site match failed for ${userId}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async status(userId: string): Promise<LegacyStatus> {
    const row = await this.db.legacyImport.findUnique({ where: { userId } })
    if (!row) return { status: 'NOT_FOUND', counts: null, claimedAt: null }
    return { status: row.status, counts: (row.counts as unknown as LegacyCounts | null) ?? null, claimedAt: row.claimedAt }
  }

  async claim(userId: string): Promise<void> {
    const row = await this.db.legacyImport.findUnique({ where: { userId } })
    if (!row?.legacyUid || row.status === 'NOT_FOUND') throw Errors.notFound('There is no old-site data for this account.')
    if (row.status === 'CLAIMED') return
    if (row.status === 'DECLINED') throw Errors.conflict('You removed your old-site data.')
    await this.db.legacyImport.update({ where: { userId }, data: { status: 'CLAIMED', claimedAt: new Date() } })
    await this.events.publish('LegacyDataClaimed', { userId, legacyUid: row.legacyUid })
  }

  /** Declines (or, after an automatic claim, removes) the old data; contexts delete what they imported. */
  async decline(userId: string): Promise<void> {
    const row = await this.db.legacyImport.findUnique({ where: { userId } })
    if (!row?.legacyUid || row.status === 'NOT_FOUND') throw Errors.notFound('There is no old-site data for this account.')
    if (row.status === 'DECLINED') return
    await this.db.legacyImport.update({ where: { userId }, data: { status: 'DECLINED', declinedAt: new Date() } })
    await this.events.publish('LegacyDataDeclined', { userId, legacyUid: row.legacyUid })
  }

  private async readIndex(): Promise<LegacyIndex | null> {
    if (this.index && Date.now() - this.index.at < INDEX_TTL_MS) return this.index.value
    const value = await this.snapshots.readIndex()
    this.index = { at: Date.now(), value }
    return value
  }
}
