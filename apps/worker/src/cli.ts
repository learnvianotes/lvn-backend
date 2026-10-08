import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { loadWorkerConfig } from '@lvn-backend/config'
import { LegacySnapshots } from '@lvn-backend/legacy'
import { Storage } from '@lvn-backend/storage'
import { firestoreLegacySource, snapshotOldSite } from '@lvn-backend/users'
import { WorkerModule } from './worker.module'

/**
 * One-off commands run by an operator, e.g. `pnpm --filter @lvn-backend/worker legacy:snapshot`.
 *   legacy:snapshot   copy the old learnvianotes.in data into the restricted bucket (ADR-0023); re-runnable
 */
async function main(command: string | undefined) {
  const config = loadWorkerConfig()
  if (command !== 'legacy:snapshot') throw new Error('Usage: cli.js legacy:snapshot')
  if (!config.LEGACY_FIREBASE_PROJECT_ID) throw new Error('Set LEGACY_FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS (read-only service account).')
  const app = await NestFactory.createApplicationContext(WorkerModule.forRoot(config, { jobs: false }), { logger: ['log', 'warn', 'error'] })
  try {
    const sink = new LegacySnapshots(app.get(Storage), config.S3_RESTRICTED_BUCKET, config.APP_ENV)
    const report = await snapshotOldSite(await firestoreLegacySource(config.LEGACY_FIREBASE_PROJECT_ID), sink)
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await app.close()
  }
}

main(process.argv[2]).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
