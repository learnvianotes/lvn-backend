import { Client } from 'pg'

/** Empties every table of the context schemas (not the migrations table), so each test file starts clean. */
export async function resetDatabase(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    const { rows } = await client.query<{ name: string }>(
      `SELECT format('%I.%I', schemaname, tablename) AS name FROM pg_tables WHERE schemaname IN ('users', 'notes', 'core', 'ai', 'comms')`,
    )
    if (rows.length) await client.query(`TRUNCATE ${rows.map((r) => r.name).join(', ')} CASCADE`)
  } finally {
    await client.end()
  }
}
