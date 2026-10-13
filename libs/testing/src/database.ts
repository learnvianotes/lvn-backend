import { Client } from 'pg'

/**
 * Jest runs test files in parallel workers. Each worker gets its own database, cloned from the migrated one, so one
 * file's reset never empties tables another file is using.
 */
export async function workerDatabase(migratedUrl: string, workerId = process.env.JEST_WORKER_ID ?? '1'): Promise<string> {
  const url = new URL(migratedUrl)
  const template = url.pathname.slice(1)
  const name = `${template}_w${workerId.replace(/\D/g, '')}`
  const admin = new Client({ connectionString: Object.assign(new URL(migratedUrl), { pathname: '/postgres' }).toString() })
  await admin.connect()
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    if (!rowCount) await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${template}"`)
  } finally {
    await admin.end()
  }
  url.pathname = `/${name}`
  return url.toString()
}

/**
 * Reference data that migrations insert — the FREE plan and its entitlements (ADR-0024), the curated subjects and
 * topics (§4.1); resets keep it, except topics that users proposed.
 */
export const SEEDED_TABLES = ['users.Plan', 'users.Entitlement', 'notes.Subject', 'notes.Topic']

/** Empties every table of the context schemas (and learning events, ADR-0067) except migration-seeded reference data, so each test file starts clean. */
export async function resetDatabase(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    const { rows } = await client.query<{ name: string }>(
      `SELECT format('%I.%I', schemaname, tablename) AS name FROM pg_tables
       WHERE schemaname IN ('users', 'notes', 'core', 'ai', 'comms', 'learning') AND schemaname || '.' || tablename <> ALL($1)`,
      [SEEDED_TABLES],
    )
    if (rows.length) await client.query(`TRUNCATE ${rows.map((r) => r.name).join(', ')}`)
    await client.query(`DELETE FROM "notes"."Topic" WHERE "origin" = 'PROPOSED'`)
  } finally {
    await client.end()
  }
}
