import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { loadWorkerConfig } from '@lvn-backend/config'
import { LegacySnapshots } from '@lvn-backend/legacy'
import { Queues } from '@lvn-backend/queue'
import { Storage } from '@lvn-backend/storage'
import { firestoreLegacySource, snapshotOldSite } from '@lvn-backend/users'
import { WorkerModule } from './worker.module'

const USAGE = `Usage: cli.js <command>
  legacy:snapshot              copy the old learnvianotes.in data into the restricted bucket (ADR-0023); re-runnable
  queues                       each queue's waiting, delayed, active and failed jobs
  queue:failed <queue>         the last 20 failed jobs with their reasons
  queue:retry <queue>          retry every failed job (each job is idempotent, §9.2)
  queue:pause <queue>          stop taking jobs; they wait (a provider is down)
  queue:resume <queue>
  queue:run <queue> <job>      run a scheduled job now, e.g. queue:run users.maintenance delete-accounts`

/**
 * One-off commands run by an operator (docs/runbooks/drain-a-queue.md), e.g. `pnpm --filter @lvn-backend/worker
 * legacy:snapshot`, or in the worker's container `node apps/worker/dist/cli.js queues`.
 */
async function main(command: string | undefined, args: string[]) {
  const config = loadWorkerConfig()
  if (command?.startsWith('queue')) return queueCommand(new Queues(config.REDIS_URL), command, args)
  if (command !== 'legacy:snapshot') throw new Error(USAGE)
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

/** Queue commands (ADR-0089), straight on BullMQ: they work while the worker is stopped. */
async function queueCommand(queues: Queues, command: string, [name, job]: string[]) {
  try {
    if (command === 'queues') {
      const client = await queues.queue('users.maintenance').getBackend().client
      const names = new Set<string>()
      let cursor = '0'
      do {
        const [next, keys] = await client.scan(cursor, { MATCH: 'bull:*:meta', COUNT: 1000 })
        cursor = next
        for (const key of keys) names.add(key.slice('bull:'.length, -':meta'.length))
      } while (cursor !== '0')
      for (const queue of [...names].sort()) {
        const q = queues.queue(queue)
        const c = await q.getJobCounts('waiting', 'delayed', 'active', 'failed')
        console.log(`${queue.padEnd(28)} ${c.waiting} waiting, ${c.delayed} delayed, ${c.active} active, ${c.failed} failed${(await q.isPaused()) ? ' (paused)' : ''}`)
      }
      return
    }
    if (!name) throw new Error(USAGE)
    const queue = queues.queue(name)
    if (command === 'queue:failed') {
      for (const j of await queue.getFailed(0, 19)) console.log(`${j.id} ${j.name} ${new Date(j.finishedOn ?? j.timestamp).toISOString()} ${j.failedReason}`)
    } else if (command === 'queue:retry') {
      await queue.retryJobs({ state: 'failed' })
      console.log(`retrying the failed jobs of ${name}`)
    } else if (command === 'queue:pause') {
      await queue.pause()
      console.log(`${name} paused`)
    } else if (command === 'queue:resume') {
      await queue.resume()
      console.log(`${name} resumed`)
    } else if (command === 'queue:run' && job) {
      const added = await queue.add(job, {})
      console.log(`${name}/${job} queued as ${added.id}`)
    } else throw new Error(USAGE)
  } finally {
    await queues.onApplicationShutdown()
  }
}

main(process.argv[2], process.argv.slice(3)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
