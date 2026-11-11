import { Inject, Injectable, Logger } from '@nestjs/common'
import { FILES, type Files } from '@lvn-backend/facades'
import { PrismaService } from '@lvn-backend/prisma-base'
import { FIREBASE_DIRECTORY, type FirebaseDeleteResult, type FirebaseDirectory } from './firebase-directory'

/** Counts only. The log line is this shape so an address, a token or an installation id cannot appear in it. */
export interface MinorPurgeReport {
  firebaseAuth: FirebaseDeleteResult[]
  fcmTokens: number
  installations: number
  r2Objects: number
}

export function minorPurgeLog(userId: string, report: MinorPurgeReport): string {
  return `minor purge user=${userId} firebase=${report.firebaseAuth.join('|') || 'none'} fcm=${report.fcmTokens} installations=${report.installations} r2=${report.r2Objects}`
}

/**
 * Extra deletion for a minor's account (ADR-0110), on top of the usual erase. Deletes the Firebase Auth user, FCM
 * tokens, Firebase installation registrations and the user's R2 objects, then clears the parent email on
 * GuardianConsent without deleting that row. Each step is safe to run again: a record Google no longer has, or a
 * file already marked deleted, is a success. A thrown error leaves the remaining rows so the next run continues.
 */
@Injectable()
export class MinorPurgeService {
  private readonly log = new Logger('MinorPurge')

  constructor(
    private readonly db: PrismaService,
    @Inject(FILES) private readonly files: Files,
    @Inject(FIREBASE_DIRECTORY) private readonly firebase: FirebaseDirectory,
  ) {}

  async purge(userId: string): Promise<MinorPurgeReport> {
    const [providers, tokens, installations] = await Promise.all([
      this.db.oAuthAccount.findMany({ where: { userId, provider: 'GOOGLE' }, select: { providerSubject: true } }),
      this.db.deviceToken.findMany({ where: { userId }, select: { token: true } }),
      this.db.firebaseInstallation.findMany({ where: { userId }, select: { fid: true } }),
    ])

    const firebaseAuth: FirebaseDeleteResult[] = []
    for (const provider of providers) firebaseAuth.push(await this.firebase.deleteAuthUser(provider.providerSubject))

    let fcmTokens = 0
    for (const { token } of tokens) {
      await this.firebase.deleteRegistration(token)
      const removed = await this.db.deviceToken.deleteMany({ where: { token, userId } })
      fcmTokens += removed.count
    }

    let installationCount = 0
    for (const { fid } of installations) {
      await this.firebase.deleteInstallation(fid)
      const removed = await this.db.firebaseInstallation.deleteMany({ where: { fid, userId } })
      installationCount += removed.count
    }

    const { objects } = await this.files.purgeOwner(userId)
    // The row stays. The address is the only personal data it holds.
    await this.db.guardianConsent.updateMany({ where: { userId }, data: { parentEmail: null } })

    const report: MinorPurgeReport = { firebaseAuth, fcmTokens, installations: installationCount, r2Objects: objects }
    this.log.log(minorPurgeLog(userId, report))
    return report
  }
}
