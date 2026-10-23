import { createHash } from 'node:crypto'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Action, can } from '@lvn/contracts/domain'
import { Errors } from '@lvn-backend/errors'
import { EVENT_BUS, type EventBus } from '@lvn-backend/event-bus'
import { AI_DATA_EXPORT, CORE_DATA_EXPORT, FILES, MAILER, NOTES_DATA_EXPORT, type DataExportPart, type ExportFile, type Files, type Mailer } from '@lvn-backend/facades'
import { newId, PrismaService } from '@lvn-backend/prisma-base'
import { Queues } from '@lvn-backend/queue'
import { zipSync, type Zippable } from 'fflate'
import { USERS_CONFIG, type UsersConfig } from '../users.config'
import { PolicyService } from './policy.service'

export const USERS_EXPORT_QUEUE = 'users.export'
const DAY_MS = 86_400_000
const KEEP_DAYS = 7
/** Media originals are included up to this much per archive; larger files are listed instead (ADR-0018). */
const MEDIA_BUDGET_BYTES = 300 * 1024 ** 2
/** Already-compressed media is stored, not deflated again. */
const STORED = /\.(png|jpe?g|webp|gif|mp4|webm|mov|mp3|m4a|ogg|wav|pdf|zip)$/i

const json = (v: unknown) => new TextEncoder().encode(JSON.stringify(v, null, 2))
const html = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/**
 * Settings → Data → Export (ADR-0018, §15.2): one request a day; apps/worker gathers every context's part, packs one
 * ZIP (README.html, manifest.json with checksums, notes/, data/), keeps it 7 days in the restricted bucket and emails
 * the person. Downloads use 15-minute links issued per request.
 */
@Injectable()
export class DataExportService {
  private readonly log = new Logger('DataExport')

  constructor(
    private readonly db: PrismaService,
    private readonly queues: Queues,
    private readonly policy: PolicyService,
    @Inject(FILES) private readonly files: Files,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(NOTES_DATA_EXPORT) private readonly notes: DataExportPart,
    @Inject(CORE_DATA_EXPORT) private readonly core: DataExportPart,
    @Inject(AI_DATA_EXPORT) private readonly ai: DataExportPart,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(USERS_CONFIG) private readonly config: UsersConfig,
  ) {}

  async request(userId: string) {
    if (!can(await this.policy.actor(userId), Action.ACCOUNT_EXPORT_DATA)) throw Errors.forbidden()
    const recent = await this.db.dataExport.findFirst({ where: { userId, status: { in: ['PENDING', 'READY'] }, requestedAt: { gt: new Date(Date.now() - DAY_MS) } }, orderBy: { requestedAt: 'desc' } })
    if (recent) throw Errors.validation(recent.status === 'PENDING' ? 'Your export is being prepared.' : 'You can ask for one export a day; your latest one is ready below.')
    const row = await this.db.dataExport.create({ data: { id: newId(), userId } })
    await this.queues.queue(USERS_EXPORT_QUEUE).add('build-export', { exportId: row.id }, { jobId: row.id })
    await this.events.publish('DataExportRequested', { exportId: row.id, userId })
    return row
  }

  /** The person's latest exports, with a fresh download link for ready ones. */
  async list(userId: string) {
    const rows = await this.db.dataExport.findMany({ where: { userId }, orderBy: { requestedAt: 'desc' }, take: 5 })
    return Promise.all(
      rows.map(async (r) => ({
        ...r,
        sizeBytes: r.sizeBytes === null ? null : Number(r.sizeBytes),
        downloadUrl: r.status === 'READY' && r.fileId && r.expiresAt && r.expiresAt > new Date() ? (await this.files.readUrl(r.fileId)).url : null,
      })),
    )
  }

  /** The worker's job: gather, pack, store, tell. */
  async build(exportId: string): Promise<void> {
    const row = await this.db.dataExport.findUnique({ where: { id: exportId }, include: { user: true } })
    if (!row || row.status !== 'PENDING') return
    try {
      const parts = await Promise.all([this.usersPart(row.userId), this.notes.exportFor(row.userId, MEDIA_BUDGET_BYTES), this.core.exportFor(row.userId, 0), this.ai.exportFor(row.userId, 0)])
      const files = parts.flatMap((p) => p.files)
      const counts = Object.assign({}, ...parts.map((p) => p.counts)) as Record<string, number>
      const omitted = parts.flatMap((p) => p.omitted)
      const now = new Date()
      const manifest = {
        format: 'lvn-export/1',
        createdAt: now.toISOString(),
        account: { id: row.userId, handle: row.user.handle },
        counts,
        omitted,
        files: files.map((f) => ({ path: f.path, bytes: f.bytes.length, sha256: createHash('sha256').update(f.bytes).digest('hex') })),
      }
      const archive: Zippable = {}
      for (const f of [...files, { path: 'manifest.json', bytes: json(manifest) }, { path: 'README.html', bytes: new TextEncoder().encode(this.readme(row.user.displayName, now, counts, omitted, files)) }]) {
        archive[f.path] = [f.bytes, { level: STORED.test(f.path) ? 0 : 6 }]
      }
      const zip = zipSync(archive)
      const expiresAt = new Date(now.getTime() + KEEP_DAYS * DAY_MS)
      const fileId = await this.files.store(row.userId, {
        purpose: 'EXPORT',
        parent: { type: 'DATA_EXPORT', id: row.id },
        fileName: `learnvianotes-export-${now.toISOString().slice(0, 10)}.zip`,
        mimeType: 'application/zip',
        bytes: zip,
        restricted: true,
        expiresAt,
      })
      await this.db.dataExport.update({ where: { id: row.id }, data: { status: 'READY', fileId, sizeBytes: BigInt(zip.length), readyAt: new Date(), expiresAt } })
      await this.events.publish('DataExportReady', { exportId: row.id, userId: row.userId, fileId, expiresAt: expiresAt.toISOString() })
      await this.mailer.send(row.user.email, 'dataExportReady', { displayName: row.user.displayName, link: `${this.config.webUrl}/profile#your-data`, expiresOn: expiresAt.toUTCString().slice(0, 16) })
    } catch (e) {
      this.log.error(`export ${exportId} failed: ${(e as Error).message}`)
      await this.db.dataExport.update({ where: { id: row.id }, data: { status: 'FAILED', error: (e as Error).message.slice(0, 500) } })
    }
  }

  /** Daily: archives past their 7 days are deleted. */
  async expire(now = new Date()): Promise<number> {
    const due = await this.db.dataExport.findMany({ where: { status: 'READY', expiresAt: { lt: now } } })
    if (!due.length) return 0
    await this.files.delete(due.flatMap((d) => (d.fileId ? [d.fileId] : [])))
    await this.db.dataExport.updateMany({ where: { id: { in: due.map((d) => d.id) } }, data: { status: 'EXPIRED' } })
    return due.length
  }

  /** The users context's part: the account and everything recorded about it, never secrets (hashes, tokens). */
  private async usersPart(userId: string): Promise<{ files: ExportFile[]; counts: Record<string, number>; omitted: string[] }> {
    const [user, sessions, providers, institutional, memberships, consents, verification, profile, plan, legacy, audit, teacher, teacherItems, identities] = await Promise.all([
      this.db.user.findUniqueOrThrow({ where: { id: userId } }),
      this.db.session.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.db.oAuthAccount.findMany({ where: { userId } }),
      this.db.institutionalEmail.findMany({ where: { userId } }),
      this.db.membership.findMany({ where: { userId }, include: { organization: true } }),
      this.db.consentRecord.findMany({ where: { userId }, orderBy: { acceptedAt: 'asc' } }),
      this.db.verificationRequest.findMany({ where: { userId } }),
      this.db.studentProfile.findUnique({ where: { userId } }),
      this.db.userPlan.findUnique({ where: { userId }, include: { plan: true } }),
      this.db.legacyImport.findUnique({ where: { userId } }),
      this.db.auditLog.findMany({ where: { OR: [{ actorId: userId }, { targetType: 'USER', targetId: userId }] }, orderBy: { createdAt: 'asc' } }),
      this.db.teacherProfile.findUnique({ where: { userId } }),
      this.db.teacherSkill.findMany({ where: { userId }, orderBy: [{ status: 'asc' }, { position: 'asc' }] }),
      this.db.externalIdentity.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ])
    const { passwordHash: _secret, ...account } = user
    const files: ExportFile[] = [
      { path: 'data/users/account.json', bytes: json({ ...account, hasPassword: !!_secret }) },
      { path: 'data/users/sign-in-providers.json', bytes: json(providers.map((p) => ({ provider: p.provider, providerSubject: p.providerSubject, since: p.createdAt }))) },
      { path: 'data/users/sessions.json', bytes: json(sessions.map((s) => ({ device: s.device, createdAt: s.createdAt, expiresAt: s.expiresAt, revokedAt: s.revokedAt }))) },
      { path: 'data/users/college-emails.json', bytes: json(institutional.map((i) => ({ email: i.email, domain: i.domain, verifiedAt: i.verifiedAt, replacedAt: i.replacedAt, createdAt: i.createdAt }))) },
      { path: 'data/users/organisations.json', bytes: json(memberships.map((m) => ({ organisation: m.organization.name, role: m.role, since: m.createdAt }))) },
      { path: 'data/users/consents.json', bytes: json(consents.map((c) => ({ kind: c.kind, version: c.version, acceptedAt: c.acceptedAt }))) },
      { path: 'data/users/verification-requests.json', bytes: json(verification.map((v) => ({ method: v.method, status: v.status, collegeIdCard: v.collegeIdCard, createdAt: v.createdAt, decidedAt: v.decidedAt }))) },
      { path: 'data/users/study-profile.json', bytes: json(profile ? { department: profile.department, yearOfStudy: profile.yearOfStudy, interestTopicIds: profile.interestTopicIds, showOnProfile: profile.showOnProfile } : null) },
      { path: 'data/users/plan.json', bytes: json(plan ? { plan: plan.plan.name, since: plan.startedAt } : null) },
      { path: 'data/users/old-site-import.json', bytes: json(legacy ? { status: legacy.status, counts: legacy.counts, claimedAt: legacy.claimedAt, declinedAt: legacy.declinedAt } : null) },
      // The Skills tab (ADR-0044, ADR-0077): every item with its source, and the identifiers without their codes.
      {
        path: 'data/users/teacher-profile.json',
        bytes: json(
          teacher || teacherItems.length || identities.length
            ? {
                headline: teacher?.headline ?? null,
                bio: teacher?.bio ?? null,
                items: teacherItems.map((s) => ({ kind: s.kind, name: s.name, detail: s.detail, source: s.source, status: s.status, sourceUrl: s.sourceUrl, fetchedAt: s.fetchedAt })),
                identifiers: identities.map((i) => ({ kind: i.kind, value: i.value, verifiedAt: i.verifiedAt, fetchedAt: i.fetchedAt })),
              }
            : null,
        ),
      },
      { path: 'data/users/activity-log.json', bytes: json(audit.map((a) => ({ action: a.action, by: a.actorId === userId ? 'you' : a.actorId ? 'someone else' : 'LearnViaNotes', targetType: a.targetType, targetId: a.targetId, details: a.metadata, at: a.createdAt }))) },
    ]
    return { files, counts: { sessions: sessions.length, consents: consents.length }, omitted: [] }
  }

  private readme(name: string, at: Date, counts: Record<string, number>, omitted: string[], files: ExportFile[]): string {
    const notes = files.filter((f) => f.path.endsWith('/index.md'))
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Your LearnViaNotes data</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#111827}code{background:#f1f4f8;padding:0 .25rem;border-radius:4px}li{margin:.2rem 0}</style></head><body>
<h1>Your LearnViaNotes data</h1>
<p>Prepared for ${html(name)} on ${html(at.toUTCString())}.</p>
<p>${counts.notes ?? 0} notes, ${counts.versions ?? 0} versions and ${counts.media ?? 0} files.</p>
<h2>What is inside</h2>
<ul>
<li><code>notes/&lt;kind&gt;/&lt;note&gt;/index.md</code> — each note as Markdown, with its details at the top. Other note apps open these.</li>
<li><code>notes/&lt;kind&gt;/&lt;note&gt;/note.json</code> — every card exactly as stored, with every published version. Import this archive into LearnViaNotes to bring the notes back.</li>
<li><code>notes/&lt;kind&gt;/&lt;note&gt;/media/</code> — pictures, video, audio and files from the notes.</li>
<li><code>data/</code> — everything else we hold about you, as JSON: your account with your date of birth and when you registered (<code>data/users/account.json</code>), the Terms and Privacy Policy versions you accepted (<code>data/users/consents.json</code>), your sign-ins, study progress, reports, the activity log, and every learning activity event (<code>data/learning/events.json</code>).</li>
<li><code>manifest.json</code> — every file with its size and SHA-256 checksum.</li>
</ul>
${omitted.length ? `<h2>Not included</h2><ul>${omitted.map((o) => `<li>${html(o)}</li>`).join('')}</ul>` : ''}
<h2>Your notes</h2>
<ul>${notes.map((n) => `<li><a href="${html(n.path)}">${html(n.path.split('/').slice(1, -1).join(' / '))}</a></li>`).join('')}</ul>
<p>This file contains personal data. Keep it somewhere safe.</p>
</body></html>`
  }
}
