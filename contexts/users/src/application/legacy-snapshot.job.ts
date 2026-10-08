import { Logger } from '@nestjs/common'
import { legacyUserSnapshot, type LegacyIndex, type LegacyUserSnapshot } from '@lvn-backend/legacy'

/** One account of the old site, as Firebase Auth lists it. */
export interface LegacyAccount {
  uid: string
  email: string | null
  emailVerified: boolean
  providers: string[]
}

/** Read-only access to the old Firestore project (ADR-0023). */
export interface LegacySource {
  accounts(): AsyncIterable<LegacyAccount>
  userDoc(uid: string): Promise<unknown | null>
  days(uid: string): Promise<Record<string, unknown>>
  notes(uid: string): Promise<unknown[]>
  /** Raw event batches; their `events` arrays are flattened into the archive */
  eventBatches(uid: string): Promise<{ events?: unknown[] }[]>
}

/** Where snapshots go (LegacySnapshots, or a fake in tests). */
export interface LegacySink {
  writeUser(snapshot: LegacyUserSnapshot): Promise<void>
  writeEvents(uid: string, lines: string[]): Promise<void>
  writeIndex(index: LegacyIndex): Promise<void>
}

export interface SnapshotReport {
  accounts: number
  written: number
  /** Accounts whose data did not match the old schema; skipped, with the reason logged */
  invalid: { uid: string; reason: string }[]
}

/**
 * The one-off snapshot of ADR-0023: every old account's documents into the restricted bucket as one JSON per user,
 * plus an index for matching. Safe to re-run until the old site is switched off; the index is written last, so a
 * half-finished run never points at missing snapshots.
 */
export async function snapshotOldSite(source: LegacySource, sink: LegacySink, now = new Date()): Promise<SnapshotReport> {
  const log = new Logger('LegacySnapshot')
  const index: LegacyIndex = { version: 1, generatedAt: now.toISOString(), users: [] }
  const report: SnapshotReport = { accounts: 0, written: 0, invalid: [] }
  for await (const account of source.accounts()) {
    report.accounts++
    const [user, days, notes, batches] = await Promise.all([source.userDoc(account.uid), source.days(account.uid), source.notes(account.uid), source.eventBatches(account.uid)])
    const parsed = legacyUserSnapshot.safeParse({
      version: 1,
      uid: account.uid,
      email: account.email,
      emailVerified: account.emailVerified,
      providers: account.providers,
      user: user ?? null,
      days,
      notes,
    })
    if (!parsed.success) {
      const reason = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      report.invalid.push({ uid: account.uid, reason })
      log.warn(`skipped ${account.uid}: ${reason}`)
      continue
    }
    await sink.writeUser(parsed.data)
    await sink.writeEvents(account.uid, batches.flatMap((b) => b.events ?? []).map((e) => JSON.stringify(e)))
    index.users.push({ uid: account.uid, email: account.email, emailVerified: account.emailVerified, providers: account.providers })
    report.written++
  }
  await sink.writeIndex(index)
  log.log(`snapshot: ${report.written}/${report.accounts} accounts, ${report.invalid.length} skipped`)
  return report
}

/**
 * The old project through firebase-admin with a read-only service account (GOOGLE_APPLICATION_CREDENTIALS, held in
 * Secrets Manager). Loaded lazily: only the snapshot command needs it.
 */
export async function firestoreLegacySource(projectId: string): Promise<LegacySource> {
  const { initializeApp, applicationDefault } = await import('firebase-admin/app')
  const { getAuth } = await import('firebase-admin/auth')
  const { getFirestore } = await import('firebase-admin/firestore')
  const app = initializeApp({ projectId, credential: applicationDefault() }, `lvn-legacy-${projectId}`)
  const db = getFirestore(app)
  const auth = getAuth(app)
  return {
    async *accounts() {
      let pageToken: string | undefined
      do {
        const page = await auth.listUsers(1000, pageToken)
        for (const u of page.users) {
          yield { uid: u.uid, email: u.email ?? null, emailVerified: u.emailVerified, providers: u.providerData.map((p) => p.providerId) }
        }
        pageToken = page.pageToken
      } while (pageToken)
    },
    async userDoc(uid) {
      const snap = await db.doc(`users/${uid}`).get()
      return snap.exists ? snap.data() ?? null : null
    },
    async days(uid) {
      const snaps = await db.collection(`users/${uid}/days`).get()
      return Object.fromEntries(snaps.docs.map((d) => [d.id, d.data()]))
    },
    async notes(uid) {
      return (await db.collection(`users/${uid}/notes`).get()).docs.map((d) => d.data())
    },
    async eventBatches(uid) {
      return (await db.collection(`users/${uid}/events`).get()).docs.map((d) => d.data() as { events?: unknown[] })
    },
  }
}
